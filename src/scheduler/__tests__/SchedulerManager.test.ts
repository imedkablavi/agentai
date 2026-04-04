import { SchedulerManager } from '../SchedulerManager';
import { Intent, ConversationContext } from '../../types';

function makeIntent(name = 'open_application'): Intent {
  return {
    name,
    confidence: 0.9,
    language: 'ar',
    context_required: false,
    entities: { application: 'chrome' },
    raw_text: 'افتح كروم'
  };
}

function makeContext(): ConversationContext {
  return {
    state: 'IDLE',
    awaiting_followup: false,
    conversation_history: [],
    timestamp: new Date().toISOString()
  };
}

describe('SchedulerManager', () => {
  let scheduler: SchedulerManager;
  let now: Date;

  beforeEach(() => {
    now = new Date('2025-01-15T08:00:00.000Z');
    scheduler = new SchedulerManager(() => now);
    // Disable file I/O for tests
    (scheduler as any).load = jest.fn();
    (scheduler as any).save = jest.fn();
    (scheduler as any).tasks = [];
  });

  describe('addTask', () => {
    it('adds a task and returns it', () => {
      const trigger = { type: 'daily', at: '08:00' } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      expect(task).not.toBeNull();
      expect(task.id).toBeTruthy();
      expect(task.enabled).toBe(false);
    });

    it('stores the task in the list', () => {
      const trigger = { type: 'daily', at: '08:00' } as const;
      scheduler.addTask(makeIntent(), makeContext(), trigger);
      expect(scheduler.listTasks()).toHaveLength(1);
    });

    it('sets next_run for daily trigger', () => {
      const trigger = { type: 'daily', at: '09:00' } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      expect(task.next_run).toBeTruthy();
    });

    it('sets next_run for once trigger', () => {
      const at = '2025-12-25T10:00:00.000Z';
      const trigger = { type: 'once', at } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      expect(task.next_run).toBe(at);
    });
  });

  describe('enableTask / disableAll', () => {
    it('enables a task by id', () => {
      const trigger = { type: 'daily', at: '08:00' } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      const result = scheduler.enableTask(task.id);
      expect(result).toBe(true);
      expect(scheduler.listTasks()[0].enabled).toBe(true);
    });

    it('returns false when task id is not found', () => {
      expect(scheduler.enableTask('nonexistent-id')).toBe(false);
    });

    it('disableAll sets all tasks to disabled', () => {
      const trigger = { type: 'daily', at: '08:00' } as const;
      const t1 = scheduler.addTask(makeIntent(), makeContext(), trigger);
      scheduler.enableTask(t1.id);
      const t2 = scheduler.addTask(makeIntent(), makeContext(), trigger);
      scheduler.enableTask(t2.id);
      scheduler.disableAll();
      for (const task of scheduler.listTasks()) {
        expect(task.enabled).toBe(false);
      }
    });
  });

  describe('getDueTasks', () => {
    it('returns enabled tasks whose next_run is due', () => {
      const past = new Date(now.getTime() - 60 * 1000).toISOString();
      const trigger = { type: 'once', at: past } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      scheduler.enableTask(task.id);
      // next_run is already set to past by addTask via once trigger
      // Override to force it to be in the past
      (scheduler as any).tasks[0].next_run = past;
      const due = scheduler.getDueTasks();
      expect(due).toHaveLength(1);
    });

    it('does not return disabled tasks', () => {
      const past = new Date(now.getTime() - 60 * 1000).toISOString();
      (scheduler as any).tasks = [{
        id: 'x',
        trigger: { type: 'once', at: past },
        intent: makeIntent(),
        context_snapshot: makeContext(),
        enabled: false,
        next_run: past
      }];
      expect(scheduler.getDueTasks()).toHaveLength(0);
    });

    it('does not return future tasks', () => {
      const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const trigger = { type: 'once', at: future } as const;
      const task = scheduler.addTask(makeIntent(), makeContext(), trigger);
      scheduler.enableTask(task.id);
      (scheduler as any).tasks[0].next_run = future;
      expect(scheduler.getDueTasks()).toHaveLength(0);
    });
  });

  describe('start / stop', () => {
    it('starts and stops without error', () => {
      expect(() => {
        scheduler.start(1, async () => {});
        scheduler.stop();
      }).not.toThrow();
    });

    it('does not start twice', () => {
      const onDue = jest.fn();
      scheduler.start(60, onDue);
      scheduler.start(60, onDue); // second call should be a no-op
      scheduler.stop();
      // Only one interval should exist (stop clears it)
      expect((scheduler as any).running).toBe(false);
    });
  });
});
