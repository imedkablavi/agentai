import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MemoryManager } from '../MemoryManager';
import { ConversationContext, Intent } from '../../types';

const context: ConversationContext = {
  state: 'IDLE',
  awaiting_followup: false,
  conversation_history: [],
  timestamp: '2026-08-24T00:00:00.000Z',
};

function intent(raw_text: string): Intent {
  return {
    name: 'open_application',
    confidence: 1,
    language: 'en',
    context_required: false,
    entities: { application: 'firefox' },
    raw_text,
  };
}

describe('MemoryManager privacy controls', () => {
  let dataDir: string;
  const now = () => new Date('2026-08-24T00:00:00.000Z');

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-memory-'));
  });

  afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it('does not persist short-term conversation data by default', () => {
    const manager = new MemoryManager({ dataDir, now });
    manager.updateShortTermMemory({ last_intent: 'search_web', last_query: 'private query' });
    expect(manager.getShortTermMemory()?.last_query).toBe('private query');
    expect(fs.existsSync(path.join(dataDir, 'memory', 'short_term.json'))).toBe(false);
  });

  it('persists short-term data only when explicitly enabled', () => {
    const manager = new MemoryManager({ dataDir, now, privacy: { persist_short_term: true } });
    manager.updateShortTermMemory({ last_intent: 'search_web', last_query: 'opted-in query' });
    expect(fs.existsSync(path.join(dataDir, 'memory', 'short_term.json'))).toBe(true);
  });

  it('does not infer persistent memories from repetition by default', () => {
    const manager = new MemoryManager({ dataDir, now });
    expect(manager.shouldStoreMemory(intent('open firefox'), context)).toBe(false);
    expect(manager.shouldStoreMemory(intent('remember that I open firefox'), context)).toBe(true);
  });

  it('prunes long-term memories beyond retention on startup', () => {
    const memoryDir = path.join(dataDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(path.join(memoryDir, 'long_term.json'), JSON.stringify([{
      id: 'old',
      type: 'pattern',
      description: 'old pattern',
      frequency: 1,
      last_occurrence: '2026-01-01T00:00:00.000Z',
      metadata: {},
    }]));

    const manager = new MemoryManager({ dataDir, now, privacy: { retention_days: 30 } });
    expect(manager.getLongTermMemories()).toEqual([]);
    expect(fs.existsSync(path.join(memoryDir, 'long_term.json'))).toBe(false);
  });

  it('supports targeted deletion and clearing stored memories', () => {
    const manager = new MemoryManager({ dataDir, now, privacy: { persist_short_term: true } });
    manager.addLongTermMemory({
      id: 'delete-me',
      type: 'pattern',
      description: 'temporary',
      frequency: 1,
      last_occurrence: now().toISOString(),
      metadata: {},
    });
    manager.updateShortTermMemory({ last_intent: 'search_web', last_query: 'temporary' });

    expect(manager.deleteLongTermMemory('delete-me')).toBe(true);
    expect(manager.getLongTermMemories()).toEqual([]);

    manager.addLongTermMemory({
      id: 'again',
      type: 'pattern',
      description: 'again',
      frequency: 1,
      last_occurrence: now().toISOString(),
      metadata: {},
    });
    manager.clearAllMemories();
    expect(manager.getShortTermMemory()).toBeNull();
    expect(manager.getLongTermMemories()).toEqual([]);
    expect(fs.existsSync(path.join(dataDir, 'memory', 'short_term.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'memory', 'long_term.json'))).toBe(false);
  });

  it('clamps retention to a bounded supported range', () => {
    const manager = new MemoryManager({ dataDir, now });
    manager.updatePrivacyConfig({ retention_days: 999999 });
    expect(manager.getPrivacyConfig().retention_days).toBe(3650);
  });
});
