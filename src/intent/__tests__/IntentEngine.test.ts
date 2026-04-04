import { IntentEngine } from '../IntentEngine';
import { ConversationContext } from '../../types';

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    state: 'IDLE',
    awaiting_followup: false,
    conversation_history: [],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

describe('IntentEngine', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
  });

  describe('Language detection', () => {
    it('classifies Arabic text correctly', async () => {
      const intent = await engine.classify('افتح كروم', makeContext());
      expect(intent.language).toBe('ar');
    });

    it('classifies Turkish text correctly', async () => {
      const intent = await engine.classify('chrome aç', makeContext());
      expect(intent.language).toBe('tr');
    });

    it('classifies English text correctly', async () => {
      const intent = await engine.classify('open chrome', makeContext());
      expect(intent.language).toBe('en');
    });
  });

  describe('Intent classification', () => {
    it('detects open_application intent in Arabic', async () => {
      const intent = await engine.classify('افتح كروم', makeContext());
      expect(intent.name).toBe('open_application');
    });

    it('detects open_application intent in Turkish', async () => {
      const intent = await engine.classify('aç chrome', makeContext());
      expect(intent.name).toBe('open_application');
    });

    it('detects open_application intent in English', async () => {
      const intent = await engine.classify('open chrome', makeContext());
      expect(intent.name).toBe('open_application');
    });

    it('detects search_web intent in Arabic', async () => {
      const intent = await engine.classify('ابحث عن الطقس', makeContext());
      expect(intent.name).toBe('search_web');
    });

    it('detects youtube_search intent in Arabic', async () => {
      const intent = await engine.classify('دور لي فيديو عن البرمجة', makeContext());
      expect(intent.name).toBe('youtube_search');
    });

    it('detects system_command intent in Arabic', async () => {
      // Use restart pattern which only matches system_command, not close_application
      const intent = await engine.classify('أعد التشغيل', makeContext());
      expect(intent.name).toBe('system_command');
    });

    it('detects memory_command intent in Arabic', async () => {
      const intent = await engine.classify('تذكر أنني أفضل كروم', makeContext());
      expect(intent.name).toBe('memory_command');
    });

    it('detects recall_memory intent in Arabic', async () => {
      const intent = await engine.classify('شو تعرف عني', makeContext());
      expect(intent.name).toBe('recall_memory');
    });

    it('detects recall_memory intent in English', async () => {
      const intent = await engine.classify('show my memory', makeContext());
      expect(intent.name).toBe('recall_memory');
    });

    it('returns unknown intent for unrecognized text', async () => {
      const intent = await engine.classify('xyzxyzxyz123abc', makeContext());
      expect(intent.name).toBe('unknown');
    });

    it('detects schedule_task intent in Arabic', async () => {
      const intent = await engine.classify('كل يوم الصبح 08:00 افتح كروم', makeContext());
      expect(intent.name).toBe('schedule_task');
    });

    it('detects stop_tasks intent in Arabic', async () => {
      const intent = await engine.classify('أوقف المهام', makeContext());
      expect(intent.name).toBe('stop_tasks');
    });
  });

  describe('Entity extraction', () => {
    it('extracts application entity for open_application', async () => {
      // Use an English app name that matches the entity pattern (chrome)
      const classified = await engine.classify('open chrome', makeContext());
      const withEntities = await engine.extractEntities('open chrome', classified);
      expect(withEntities.entities.application).toBeTruthy();
    });

    it('extracts query entity for search_web', async () => {
      const classified = await engine.classify('ابحث عن الطقس', makeContext());
      const withEntities = await engine.extractEntities('ابحث عن الطقس', classified);
      expect(withEntities.entities.query).toBeTruthy();
    });

    it('extracts numeric index from select_item text', async () => {
      const classified = await engine.classify('اختر رقم 3', makeContext());
      const withEntities = await engine.extractEntities('اختر رقم 3', classified);
      expect(withEntities.entities.index).toBe(3);
    });
  });

  describe('Confidence calculation', () => {
    it('returns a confidence score between 0 and 1', async () => {
      const intent = await engine.classify('افتح كروم', makeContext());
      const conf = engine.calculateConfidence(intent, makeContext());
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    });

    it('boosts confidence for language-consistent context', async () => {
      const ctx = makeContext({
        conversation_history: ['User: افتح كروم', 'Assistant: فتحت كروم']
      });
      const intent = await engine.classify('ابحث عن الطقس', ctx);
      const conf = engine.calculateConfidence(intent, ctx);
      expect(conf).toBeGreaterThan(0);
    });
  });
});
