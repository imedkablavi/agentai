import { ScheduledTask, TimeTrigger } from './types';
import { Intent, ConversationContext } from '../types';
import { formatISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { ensurePrivateDir, getAgentDataDir, writePrivateJsonAtomic } from '../security/SecureStorage';

export class SchedulerManager {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private tickInProgress = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly schedulerDir: string;

  constructor(
    private getNow: () => Date = () => new Date(),
    dataDir: string = getAgentDataDir(),
  ) {
    this.schedulerDir = path.join(dataDir, 'scheduler');
    this.load();
  }

  addTask(intent: Intent, context: ConversationContext, trigger: TimeTrigger): ScheduledTask {
    const task: ScheduledTask = {
      id: uuidv4(),
      trigger,
      intent: this.sanitizeIntent(intent),
      context_snapshot: this.minimalContext(context),
      enabled: false,
      next_run: this.computeNextRun(trigger),
    };
    this.tasks.push(task);
    this.save();
    return this.cloneTask(task);
  }

  enableTask(id: string): boolean {
    const task = this.tasks.find(item => item.id === id);
    if (!task) return false;

    const now = this.getNow().getTime();
    const next = new Date(task.next_run).getTime();
    if (!Number.isFinite(next)) return false;
    if (task.trigger.type === 'once' && next <= now) return false;
    if (task.trigger.type !== 'once' && next <= now) task.next_run = this.computeNextRun(task.trigger);

    task.enabled = true;
    this.save();
    return true;
  }

  removeTask(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter(task => task.id !== id);
    const removed = this.tasks.length !== before;
    if (removed) this.save();
    return removed;
  }

  disableAll(): void {
    this.tasks.forEach(task => { task.enabled = false; });
    this.save();
  }

  listTasks(): ScheduledTask[] {
    return this.tasks.map(task => this.cloneTask(task));
  }

  getDueTasks(): ScheduledTask[] {
    const now = this.getNow().getTime();
    return this.tasks
      .filter(task => {
        if (!task.enabled) return false;
        const next = new Date(task.next_run).getTime();
        return Number.isFinite(next) && next <= now;
      })
      .map(task => this.cloneTask(task));
  }

  start(tickSeconds: number, onDue: (task: ScheduledTask) => Promise<void>): void {
    if (this.running) return;
    this.running = true;
    this.intervalHandle = setInterval(() => {
      void this.runTick(onDue);
    }, Math.max(5, tickSeconds) * 1000);
  }

  stop(): void {
    if (!this.running) return;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    this.running = false;
  }

  clear(): void {
    this.tasks = [];
    const filePath = this.storePath();
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Caller can verify listTasks() and filesystem state if needed.
    }
  }

  private async runTick(onDue: (task: ScheduledTask) => Promise<void>): Promise<void> {
    if (this.tickInProgress) return;
    this.tickInProgress = true;
    const now = this.getNow();

    try {
      for (const due of this.getDueTasks()) {
        const task = this.tasks.find(item => item.id === due.id);
        if (!task || !task.enabled) continue;

        try {
          await onDue(this.cloneTask(task));
        } catch {
          // The task runner owns execution logging; scheduler state still advances
          // so an exception cannot create a tight retry loop.
        } finally {
          task.last_run = formatISO(now);
          if (task.trigger.type === 'once') {
            task.enabled = false;
          } else {
            task.next_run = this.computeNextRun(task.trigger);
          }
        }
      }
    } finally {
      this.save();
      this.tickInProgress = false;
    }
  }

  private computeNextRun(trigger: TimeTrigger): string {
    const now = this.getNow();
    if (trigger.type === 'once') return trigger.at;
    if (trigger.type === 'daily') {
      const [hh, mm] = trigger.at.split(':').map(value => parseInt(value, 10));
      if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        throw new Error('Invalid daily schedule time.');
      }
      const next = new Date(now);
      next.setHours(hh, mm, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      return formatISO(next);
    }
    const minutes = Math.max(1, Math.min(7 * 24 * 60, Math.floor(trigger.minutes)));
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + minutes);
    return formatISO(next);
  }

  private storePath(): string {
    ensurePrivateDir(this.schedulerDir);
    return path.join(this.schedulerDir, 'tasks.json');
  }

  private load(): void {
    try {
      const filePath = this.storePath();
      if (!fs.existsSync(filePath)) return;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ScheduledTask[];
      this.tasks = Array.isArray(raw)
        ? raw
            .filter(task => task && typeof task.id === 'string' && task.trigger && task.intent)
            .map(task => ({
              ...task,
              enabled: task.trigger.type === 'once' && task.last_run ? false : Boolean(task.enabled),
              intent: this.sanitizeIntent(task.intent),
              context_snapshot: this.minimalContext(task.context_snapshot || {} as ConversationContext),
            }))
        : [];
    } catch {
      this.tasks = [];
    }
  }

  private save(): void {
    try {
      if (this.tasks.length === 0) {
        const filePath = this.storePath();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return;
      }
      writePrivateJsonAtomic(this.storePath(), this.tasks);
    } catch {
      // Scheduling persistence failure never widens execution permissions.
    }
  }

  private minimalContext(context: ConversationContext): ConversationContext {
    return {
      state: 'IDLE',
      awaiting_followup: false,
      awaiting_confirmation: false,
      conversation_history: [],
      timestamp: context.timestamp || formatISO(this.getNow()),
    };
  }

  private sanitizeIntent(intent: Intent): Intent {
    const safeEntities: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(intent.entities || {})) {
      if (!['query', 'application', 'index', 'url', 'file_path', 'at'].includes(key)) continue;
      if (typeof value === 'string') safeEntities[key] = value.slice(0, 2000);
      else if (typeof value === 'number' && Number.isFinite(value)) safeEntities[key] = value;
    }
    return {
      name: typeof intent.name === 'string' ? intent.name.slice(0, 100) : 'unknown',
      confidence: Number.isFinite(intent.confidence) ? Math.max(0, Math.min(1, intent.confidence)) : 0,
      language: intent.language === 'tr' || intent.language === 'en' ? intent.language : 'ar',
      context_required: Boolean(intent.context_required),
      entities: safeEntities,
      raw_text: typeof intent.raw_text === 'string' ? intent.raw_text.slice(0, 8000) : '',
    } as Intent;
  }

  private cloneTask(task: ScheduledTask): ScheduledTask {
    return {
      ...task,
      trigger: { ...task.trigger } as TimeTrigger,
      intent: { ...task.intent, entities: { ...task.intent.entities } },
      context_snapshot: {
        ...task.context_snapshot,
        conversation_history: [...(task.context_snapshot.conversation_history || [])],
      },
    };
  }
}
