import {
  MemoryManager as IMemoryManager,
  ShortTermMemory,
  LongTermMemory,
  PreferenceMemory,
  MemoryPrivacyConfig,
  Intent,
  ConversationContext,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { formatISO } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import { ensurePrivateDir, getAgentDataDir, writePrivateJsonAtomic } from '../security/SecureStorage';

interface MemoryManagerOptions {
  dataDir?: string;
  now?: () => Date;
  privacy?: Partial<MemoryPrivacyConfig>;
}

export class MemoryManager implements IMemoryManager {
  private shortTermMemory: ShortTermMemory | null = null;
  private longTermMemories: LongTermMemory[] = [];
  private preferences: PreferenceMemory;
  private privacy: MemoryPrivacyConfig;
  private readonly memoryDir: string;
  private readonly now: () => Date;
  private readonly memoryThresholds = {
    repetition_count: 3,
    time_window_days: 7,
  };

  constructor(options: MemoryManagerOptions = {}) {
    this.now = options.now || (() => new Date());
    this.memoryDir = path.join(options.dataDir || getAgentDataDir(), 'memory');
    this.preferences = this.defaultPreferences();
    this.privacy = {
      retention_days: 30,
      persist_short_term: false,
      auto_store_patterns: false,
      ...options.privacy,
    };
    this.normalizePrivacy();
    this.loadMemories();
    this.pruneLongTermMemories(this.privacy.retention_days);
  }

  getShortTermMemory(): ShortTermMemory | null {
    return this.shortTermMemory ? { ...this.shortTermMemory } : null;
  }

  updateShortTermMemory(data: Partial<ShortTermMemory>): void {
    this.shortTermMemory = {
      ...this.shortTermMemory,
      ...data,
      timestamp: formatISO(this.now()),
    } as ShortTermMemory;

    if (this.privacy.persist_short_term) this.saveShortTermMemory();
  }

  clearShortTermMemory(): void {
    this.shortTermMemory = null;
    this.deleteIfExists(this.shortTermPath());
  }

  getLongTermMemories(): LongTermMemory[] {
    return this.longTermMemories.map(memory => ({ ...memory, metadata: { ...(memory.metadata || {}) } }));
  }

  addLongTermMemory(memory: LongTermMemory): void {
    const existingIndex = this.longTermMemories.findIndex(
      item => item.description === memory.description && item.type === memory.type,
    );

    if (existingIndex >= 0) {
      this.longTermMemories[existingIndex] = {
        ...this.longTermMemories[existingIndex],
        frequency: this.longTermMemories[existingIndex].frequency + 1,
        last_occurrence: formatISO(this.now()),
        metadata: { ...this.longTermMemories[existingIndex].metadata, ...memory.metadata },
      };
    } else {
      this.longTermMemories.push({
        ...memory,
        id: memory.id || uuidv4(),
        frequency: Math.max(1, memory.frequency || 1),
        last_occurrence: formatISO(this.now()),
      });
    }

    this.pruneLongTermMemories(this.privacy.retention_days, false);
    this.saveLongTermMemories();
  }

  updateLongTermMemory(type: string, description: string): void {
    const memory = this.longTermMemories.find(item => item.type === type && item.description === description);
    if (!memory) return;
    memory.frequency += 1;
    memory.last_occurrence = formatISO(this.now());
    this.saveLongTermMemories();
  }

  pruneLongTermMemories(cutoffDays: number = this.privacy.retention_days, persist = true): void {
    const safeCutoff = Math.max(1, Math.min(3650, Math.floor(cutoffDays)));
    const now = this.now().getTime();
    const before = this.longTermMemories.length;
    this.longTermMemories = this.longTermMemories.filter(memory => {
      const time = new Date(memory.last_occurrence).getTime();
      if (!Number.isFinite(time)) return false;
      const ageDays = (now - time) / (1000 * 60 * 60 * 24);
      return ageDays <= safeCutoff;
    });
    if (persist && before !== this.longTermMemories.length) this.saveLongTermMemories();
  }

  deleteLongTermMemory(id: string): boolean {
    const before = this.longTermMemories.length;
    this.longTermMemories = this.longTermMemories.filter(memory => memory.id !== id);
    const deleted = this.longTermMemories.length !== before;
    if (deleted) this.saveLongTermMemories();
    return deleted;
  }

  clearLongTermMemories(): void {
    this.longTermMemories = [];
    this.deleteIfExists(this.longTermPath());
  }

  clearAllMemories(): void {
    this.clearShortTermMemory();
    this.clearLongTermMemories();
  }

  getPreferences(): PreferenceMemory {
    return { ...this.preferences };
  }

  updatePreferences(prefs: Partial<PreferenceMemory>): void {
    this.preferences = this.normalizePreferences({ ...this.preferences, ...prefs });
    this.savePreferences();
  }

  getPrivacyConfig(): MemoryPrivacyConfig {
    return { ...this.privacy };
  }

  updatePrivacyConfig(config: Partial<MemoryPrivacyConfig>): void {
    this.privacy = { ...this.privacy, ...config };
    this.normalizePrivacy();
    if (!this.privacy.persist_short_term) this.deleteIfExists(this.shortTermPath());
    this.pruneLongTermMemories(this.privacy.retention_days);
    this.savePrivacy();
  }

  shouldStoreMemory(intent: Intent, _context: ConversationContext): boolean {
    const text = intent.raw_text.toLocaleLowerCase();
    const explicitRemember = [
      'تذكر', 'ذاكر', 'من الآن فصاعدًا', 'من الان فصاعدا', 'احفظ',
      'remember', 'from now on',
      'hatırla', 'bundan sonra', 'kaydet',
    ].some(keyword => text.includes(keyword));

    if (explicitRemember) return true;
    if (!this.privacy.auto_store_patterns) return false;

    const recentSimilar = this.longTermMemories.filter(memory => {
      const days = (this.now().getTime() - new Date(memory.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
      return memory.description.includes(intent.name) && days <= this.memoryThresholds.time_window_days;
    });
    return recentSimilar.length + 1 >= this.memoryThresholds.repetition_count;
  }

  getMemoryInsights(): {
    habits: LongTermMemory[];
    recent_patterns: LongTermMemory[];
    preferences: PreferenceMemory;
    privacy: MemoryPrivacyConfig;
  } {
    const habits = this.longTermMemories.filter(memory => memory.type === 'habit' && memory.frequency >= 3);
    const recentPatterns = this.longTermMemories
      .filter(memory => {
        const days = (this.now().getTime() - new Date(memory.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
        return days <= 7;
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    return {
      habits: habits.map(item => ({ ...item })),
      recent_patterns: recentPatterns.map(item => ({ ...item })),
      preferences: this.getPreferences(),
      privacy: this.getPrivacyConfig(),
    };
  }

  getStorageDirectory(): string {
    return this.memoryDir;
  }

  private defaultPreferences(): PreferenceMemory {
    return {
      language: 'ar',
      browser: 'chrome',
      voice_mode: true,
      voice_response_mode: 'short',
    };
  }

  private normalizePreferences(value: Partial<PreferenceMemory>): PreferenceMemory {
    const defaults = this.defaultPreferences();
    const language = value.language === 'ar' || value.language === 'tr' || value.language === 'en'
      ? value.language
      : defaults.language;
    const browser = typeof value.browser === 'string' && value.browser.trim()
      ? value.browser.trim()
      : defaults.browser;
    const voiceMode = typeof value.voice_mode === 'boolean' ? value.voice_mode : defaults.voice_mode;
    const responseMode = value.voice_response_mode === 'long' || value.voice_response_mode === 'short'
      ? value.voice_response_mode
      : defaults.voice_response_mode;

    return {
      language,
      browser,
      voice_mode: voiceMode,
      voice_response_mode: responseMode,
    };
  }

  private normalizePrivacy(): void {
    this.privacy.retention_days = Math.max(1, Math.min(3650, Math.floor(this.privacy.retention_days || 30)));
    this.privacy.persist_short_term = Boolean(this.privacy.persist_short_term);
    this.privacy.auto_store_patterns = Boolean(this.privacy.auto_store_patterns);
  }

  private loadMemories(): void {
    try {
      ensurePrivateDir(this.memoryDir);
      const privacy = this.readJson<Partial<MemoryPrivacyConfig>>(this.privacyPath());
      if (privacy) {
        this.privacy = { ...this.privacy, ...privacy };
        this.normalizePrivacy();
      }

      if (this.privacy.persist_short_term) {
        this.shortTermMemory = this.readJson<ShortTermMemory>(this.shortTermPath());
      }

      this.longTermMemories = this.readJson<LongTermMemory[]>(this.longTermPath()) || [];
      const persistedPreferences = this.readJson<Partial<PreferenceMemory>>(this.preferencesPath());
      this.preferences = this.normalizePreferences(persistedPreferences || this.preferences);
    } catch {
      // Memory persistence failures do not expose file contents or secrets.
    }
  }

  private saveShortTermMemory(): void {
    if (!this.shortTermMemory || !this.privacy.persist_short_term) return;
    writePrivateJsonAtomic(this.shortTermPath(), this.shortTermMemory);
  }

  private saveLongTermMemories(): void {
    if (this.longTermMemories.length === 0) {
      this.deleteIfExists(this.longTermPath());
      return;
    }
    writePrivateJsonAtomic(this.longTermPath(), this.longTermMemories);
  }

  private savePreferences(): void {
    writePrivateJsonAtomic(this.preferencesPath(), this.preferences);
  }

  private savePrivacy(): void {
    writePrivateJsonAtomic(this.privacyPath(), this.privacy);
  }

  private readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private deleteIfExists(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Deletion callers can verify through the public getters/storage path.
    }
  }

  private shortTermPath(): string { return path.join(this.memoryDir, 'short_term.json'); }
  private longTermPath(): string { return path.join(this.memoryDir, 'long_term.json'); }
  private preferencesPath(): string { return path.join(this.memoryDir, 'preferences.json'); }
  private privacyPath(): string { return path.join(this.memoryDir, 'privacy.json'); }
}
