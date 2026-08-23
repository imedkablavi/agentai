import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SchedulerManager } from '../SchedulerManager';
import { ConversationContext, Intent } from '../../types';

const context: ConversationContext = {
  state: 'IDLE',
  awaiting_followup: true,
  conversation_history: ['private conversation'],
  active_topic: 'private topic',
  timestamp: '2026-08-24T00:00:00.000Z',
};

const intent: Intent = {
  name: 'search_web',
  confidence: 1,
  language: 'en',
  context_required: false,
  entities: { query: 'status page' },
  raw_text: 'search for status page',
};

describe('SchedulerManager privacy and enablement', () => {
  let dataDir: string;
  let scheduler: SchedulerManager;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-scheduler-'));
    scheduler = new SchedulerManager(() => new Date('2026-08-24T10:00:00.000Z'), dataDir);
  });

  afterEach(() => {
    scheduler.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('creates tasks disabled until explicit enablement', () => {
    const task = scheduler.addTask(intent, context, { type: 'daily', at: '11:00' });
    expect(task.enabled).toBe(false);
    expect(scheduler.getDueTasks()).toEqual([]);
    expect(scheduler.enableTask(task.id)).toBe(true);
    expect(scheduler.listTasks()[0].enabled).toBe(true);
  });

  it('stores scheduler state in the private data directory, not the workspace', () => {
    scheduler.addTask(intent, context, { type: 'daily', at: '11:00' });
    const filePath = path.join(dataDir, 'scheduler', 'tasks.json');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('status page');
  });

  it('does not persist conversation history or active topic in task snapshots', () => {
    scheduler.addTask(intent, context, { type: 'daily', at: '11:00' });
    const raw = fs.readFileSync(path.join(dataDir, 'scheduler', 'tasks.json'), 'utf8');
    expect(raw).not.toContain('private conversation');
    expect(raw).not.toContain('private topic');
    expect(scheduler.listTasks()[0].context_snapshot.conversation_history).toEqual([]);
  });

  it('can remove pending tasks and clear all persisted schedules', () => {
    const task = scheduler.addTask(intent, context, { type: 'daily', at: '11:00' });
    expect(scheduler.removeTask(task.id)).toBe(true);
    expect(scheduler.listTasks()).toEqual([]);

    scheduler.addTask(intent, context, { type: 'daily', at: '12:00' });
    scheduler.clear();
    expect(scheduler.listTasks()).toEqual([]);
    expect(fs.existsSync(path.join(dataDir, 'scheduler', 'tasks.json'))).toBe(false);
  });
});
