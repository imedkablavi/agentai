import { MemoryManager } from '../MemoryManager';
import * as fs from 'fs';
import * as path from 'path';

// Use a temp directory for memory files during tests
const TEMP_DIR = '/tmp/agentai-test-memories';

// Patch the MemoryManager to use the temp dir
function patchMemoryPaths(manager: MemoryManager) {
  (manager as any).loadMemories = jest.fn(); // disable auto-load
  (manager as any).saveShortTermMemory = jest.fn();
  (manager as any).saveLongTermMemories = jest.fn();
  (manager as any).savePreferences = jest.fn();
}

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    patchMemoryPaths(manager);
    // Reset internal state
    (manager as any).shortTermMemory = null;
    (manager as any).longTermMemories = [];
    (manager as any).preferences = {
      language: 'ar',
      browser: 'chrome',
      voice_mode: true,
      voice_response_mode: 'short',
      auto_execute_threshold: 0.85,
      confirmation_required: true
    };
  });

  describe('Short-term memory', () => {
    it('getShortTermMemory returns null initially', () => {
      expect(manager.getShortTermMemory()).toBeNull();
    });

    it('updateShortTermMemory stores data', () => {
      manager.updateShortTermMemory({ last_intent: 'search_web', last_query: 'weather' });
      const stm = manager.getShortTermMemory();
      expect(stm).not.toBeNull();
      expect(stm!.last_intent).toBe('search_web');
      expect(stm!.last_query).toBe('weather');
    });

    it('updateShortTermMemory merges partial updates', () => {
      manager.updateShortTermMemory({ last_intent: 'open_application', last_query: 'chrome' });
      manager.updateShortTermMemory({ last_application: 'chrome' });
      const stm = manager.getShortTermMemory();
      expect(stm!.last_intent).toBe('open_application');
      expect(stm!.last_application).toBe('chrome');
    });
  });

  describe('Long-term memory', () => {
    it('getLongTermMemories returns empty array initially', () => {
      expect(manager.getLongTermMemories()).toEqual([]);
    });

    it('addLongTermMemory adds a new memory', () => {
      manager.addLongTermMemory({
        type: 'habit',
        description: 'opens chrome daily',
        frequency: 1,
        last_occurrence: new Date().toISOString()
      });
      expect(manager.getLongTermMemories()).toHaveLength(1);
    });

    it('addLongTermMemory increments frequency for duplicate descriptions', () => {
      const mem = {
        type: 'habit' as const,
        description: 'opens chrome daily',
        frequency: 1,
        last_occurrence: new Date().toISOString()
      };
      manager.addLongTermMemory(mem);
      manager.addLongTermMemory(mem);
      const memories = manager.getLongTermMemories();
      expect(memories).toHaveLength(1);
      expect(memories[0].frequency).toBe(2);
    });

    it('pruneLongTermMemories removes old memories', () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      (manager as any).longTermMemories = [
        { id: '1', type: 'habit', description: 'old habit', frequency: 5, last_occurrence: oldDate }
      ];
      manager.pruneLongTermMemories(30);
      expect(manager.getLongTermMemories()).toHaveLength(0);
    });

    it('pruneLongTermMemories keeps recent memories', () => {
      const recentDate = new Date().toISOString();
      (manager as any).longTermMemories = [
        { id: '1', type: 'habit', description: 'recent habit', frequency: 3, last_occurrence: recentDate }
      ];
      manager.pruneLongTermMemories(30);
      expect(manager.getLongTermMemories()).toHaveLength(1);
    });
  });

  describe('Preferences', () => {
    it('getPreferences returns default preferences', () => {
      const prefs = manager.getPreferences();
      expect(prefs.language).toBe('ar');
      expect(prefs.browser).toBe('chrome');
    });

    it('updatePreferences merges partial updates', () => {
      manager.updatePreferences({ language: 'en', browser: 'firefox' });
      const prefs = manager.getPreferences();
      expect(prefs.language).toBe('en');
      expect(prefs.browser).toBe('firefox');
      expect(prefs.voice_mode).toBe(true); // unchanged
    });
  });

  describe('shouldStoreMemory', () => {
    it('returns false when shortTermMemory is null', () => {
      const intent = {
        name: 'memory_command',
        confidence: 0.9,
        language: 'ar' as const,
        context_required: false,
        entities: {},
        raw_text: 'تذكر أنني أفضل الوضع الداكن'
      };
      const ctx = {
        state: 'IDLE' as const,
        awaiting_followup: false,
        conversation_history: [],
        timestamp: new Date().toISOString()
      };
      // shortTermMemory is null → must return false
      expect(manager.shouldStoreMemory(intent, ctx)).toBe(false);
    });

    it('returns true for explicit remember command when shortTermMemory is set', () => {
      manager.updateShortTermMemory({ last_intent: 'memory_command', last_query: 'dark mode' });
      const intent = {
        name: 'memory_command',
        confidence: 0.9,
        language: 'ar' as const,
        context_required: false,
        entities: {},
        raw_text: 'تذكر أنني أفضل الوضع الداكن'
      };
      const ctx = {
        state: 'IDLE' as const,
        awaiting_followup: false,
        conversation_history: [],
        timestamp: new Date().toISOString()
      };
      expect(manager.shouldStoreMemory(intent, ctx)).toBe(true);
    });

    it('returns true after 2 recent memories with same intent name', () => {
      manager.updateShortTermMemory({ last_intent: 'search_web', last_query: 'weather' });
      const intent = {
        name: 'search_web',
        confidence: 0.8,
        language: 'en' as const,
        context_required: false,
        entities: { query: 'weather' },
        raw_text: 'search weather'
      };
      const ctx = {
        state: 'IDLE' as const,
        awaiting_followup: false,
        conversation_history: [],
        timestamp: new Date().toISOString()
      };
      // Add 2 existing recent memories to reach threshold of 3 (2+1 >= 3)
      const recent = new Date().toISOString();
      (manager as any).longTermMemories = [
        { id: '1', type: 'habit', description: 'User frequently uses search_web', frequency: 1, last_occurrence: recent, metadata: { intent: 'search_web' } },
        { id: '2', type: 'habit', description: 'User frequently uses search_web', frequency: 1, last_occurrence: recent, metadata: { intent: 'search_web' } }
      ];
      expect(manager.shouldStoreMemory(intent, ctx)).toBe(true);
    });
  });

  describe('getMemoryInsights', () => {
    it('returns habits, recent_patterns, and preferences', () => {
      const insights = manager.getMemoryInsights();
      expect(insights).toHaveProperty('habits');
      expect(insights).toHaveProperty('recent_patterns');
      expect(insights).toHaveProperty('preferences');
    });

    it('filters habits by frequency >= 3', () => {
      const recent = new Date().toISOString();
      (manager as any).longTermMemories = [
        { id: '1', type: 'habit', description: 'Opens Chrome', frequency: 5, last_occurrence: recent },
        { id: '2', type: 'habit', description: 'Rarely used', frequency: 1, last_occurrence: recent }
      ];
      const insights = manager.getMemoryInsights();
      expect(insights.habits).toHaveLength(1);
      expect(insights.habits[0].description).toBe('Opens Chrome');
    });
  });
});
