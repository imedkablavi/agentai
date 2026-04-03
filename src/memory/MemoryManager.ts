import { 
  MemoryManager as IMemoryManager, 
  ShortTermMemory, 
  LongTermMemory, 
  PreferenceMemory, 
  Intent, 
  ConversationContext 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { formatISO } from 'date-fns';

export class MemoryManager implements IMemoryManager {
  private shortTermMemory: ShortTermMemory | null = null;
  private longTermMemories: LongTermMemory[] = [];
  private preferences: PreferenceMemory;
  private memoryThresholds = {
    repetition_count: 3,
    time_window_days: 7
  };

  constructor() {
    this.preferences = {
      language: 'ar',
      browser: 'chrome',
      voice_mode: true,
      auto_execute_threshold: 0.85,
      confirmation_required: true
    };
    this.loadMemories();
  }

  getShortTermMemory(): ShortTermMemory | null {
    return this.shortTermMemory;
  }

  updateShortTermMemory(data: Partial<ShortTermMemory>): void {
    this.shortTermMemory = {
      ...this.shortTermMemory,
      ...data,
      timestamp: formatISO(new Date())
    } as ShortTermMemory;
    
    this.saveShortTermMemory();
  }

  getLongTermMemories(): LongTermMemory[] {
    return this.longTermMemories;
  }

  addLongTermMemory(memory: LongTermMemory): void {
    const existingIndex = this.longTermMemories.findIndex(
      m => m.description === memory.description && m.type === memory.type
    );

    if (existingIndex >= 0) {
      this.longTermMemories[existingIndex] = {
        ...this.longTermMemories[existingIndex],
        frequency: this.longTermMemories[existingIndex].frequency + 1,
        last_occurrence: formatISO(new Date()),
        metadata: { ...this.longTermMemories[existingIndex].metadata, ...memory.metadata }
      };
    } else {
      this.longTermMemories.push({
        ...memory,
        id: uuidv4(),
        frequency: 1,
        last_occurrence: formatISO(new Date())
      });
    }

    this.saveLongTermMemories();
  }

  updateLongTermMemory(type: string, description: string): void {
    const memory = this.longTermMemories.find(
      m => m.type === type && m.description === description
    );

    if (memory) {
      memory.frequency += 1;
      memory.last_occurrence = formatISO(new Date());
      this.saveLongTermMemories();
    }
  }

  pruneLongTermMemories(cutoffDays: number = 30): void {
    const now = Date.now();
    this.longTermMemories = this.longTermMemories.filter(m => {
      const days = (now - new Date(m.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
      return days <= cutoffDays;
    });
    this.saveLongTermMemories();
  }

  getPreferences(): PreferenceMemory {
    return this.preferences;
  }

  updatePreferences(prefs: Partial<PreferenceMemory>): void {
    this.preferences = { ...this.preferences, ...prefs };
    this.savePreferences();
  }

  shouldStoreMemory(intent: Intent, context: ConversationContext): boolean {
    const shortTerm = this.getShortTermMemory();
    
    if (!shortTerm) return false;

    const recentSimilarIntents = this.longTermMemories.filter(memory => {
      const daysSinceLastOccurrence = (new Date().getTime() - new Date(memory.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
      return memory.description.includes(intent.name) && daysSinceLastOccurrence <= this.memoryThresholds.time_window_days;
    });

    const isRepetitive = recentSimilarIntents.length + 1 >= this.memoryThresholds.repetition_count;
    
    const hasExplicitRememberCommand = intent.raw_text.toLowerCase().includes('تذكر') || 
                                       intent.raw_text.toLowerCase().includes('ذاكر') ||
                                       intent.raw_text.toLowerCase().includes('من الآن فصاعدًا') ||
                                       intent.raw_text.toLowerCase().includes('احفظ');

    return isRepetitive || hasExplicitRememberCommand;
  }

  private loadMemories(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const memoryPath = path.join(__dirname, '../../data/memories');
      
      if (!fs.existsSync(memoryPath)) {
        fs.mkdirSync(memoryPath, { recursive: true });
      }

      const stmPath = path.join(memoryPath, 'short_term.json');
      const ltmPath = path.join(memoryPath, 'long_term.json');
      const prefsPath = path.join(memoryPath, 'preferences.json');

      if (fs.existsSync(stmPath)) {
        this.shortTermMemory = JSON.parse(fs.readFileSync(stmPath, 'utf8'));
      }

      if (fs.existsSync(ltmPath)) {
        this.longTermMemories = JSON.parse(fs.readFileSync(ltmPath, 'utf8'));
      }

      if (fs.existsSync(prefsPath)) {
        this.preferences = { ...this.preferences, ...JSON.parse(fs.readFileSync(prefsPath, 'utf8')) };
      }
    } catch (error) {
      console.warn('Failed to load memories:', error);
    }
  }

  private saveShortTermMemory(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const stmPath = path.join(__dirname, '../../data/memories/short_term.json');
      
      if (this.shortTermMemory) {
        fs.writeFileSync(stmPath, JSON.stringify(this.shortTermMemory, null, 2));
      }
    } catch (error) {
      console.warn('Failed to save short-term memory:', error);
    }
  }

  private saveLongTermMemories(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const ltmPath = path.join(__dirname, '../../data/memories/long_term.json');
      
      fs.writeFileSync(ltmPath, JSON.stringify(this.longTermMemories, null, 2));
    } catch (error) {
      console.warn('Failed to save long-term memories:', error);
    }
  }

  private savePreferences(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const prefsPath = path.join(__dirname, '../../data/memories/preferences.json');
      
      fs.writeFileSync(prefsPath, JSON.stringify(this.preferences, null, 2));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }

  getMemoryInsights(): {
    habits: LongTermMemory[];
    recent_patterns: LongTermMemory[];
    preferences: PreferenceMemory;
  } {
    const habits = this.longTermMemories.filter(m => m.type === 'habit' && m.frequency >= 3);
    const recent_patterns = this.longTermMemories
      .filter(m => {
        const daysSinceLastOccurrence = (new Date().getTime() - new Date(m.last_occurrence).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastOccurrence <= 7;
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    return {
      habits,
      recent_patterns,
      preferences: this.preferences
    };
  }
}
