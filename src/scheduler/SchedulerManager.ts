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
    return { ...task };
  }

  enableTask(id: string): boolean {
    const task = this.tasks.find(item => item.id === id);
    if (!task) return false;
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
    return this.tasks.map(task => ({ ...task, intent: { ...task.intent }, context_snapshot: { ...task.context_snapshot } }));
  }

  getDueTasks(): ScheduledTask[] {
    const now = this.getNow().getTime();
    return this.tasks.filter(task => task.enabled && new Date(task.next_run).getTime() <= now);
  }

  start(tickSeconds: number, onDue: (task: ScheduledTask) => Promise<void>): void {
    if (this.running) return;
    this.running = true;
    this.intervalHandle = setInterval(async () => {
      const now = this.getNow();
      for (const task of this.getDueTasks()) {
        try {
          await onDue({ ...task });
        } finally {
          task.last_run = formatISO(now);
          task.next_run = this.computeNextRun(task.trigger);
        }
      }
      this.save();
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

  private computeNextRun(trigger: TimeTrigger): string {
    const now = this.getNow();
    if (trigger.type === 'once') return trigger.at;
    if (trigger.type === 'daily') {
      const [hh, mm] = trigger.at.split(':').map(value => parseInt(value, 10));
      const next = new Date(now);
      next.setHours(hh, mm || 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      return formatISO(next);
    }
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + Math.max(1, trigger.minutes));
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
      this.tasks = Array.isArray(raw) ? raw.filter(task => task && task.id && task.trigger) : [];
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
      if (['query', 'application', 'index', 'url', 'file_path', 'at'].includes(key)) safeEntities[key] = value;
    }
    return { ...intent, entities: safeEntities } as Intent;
  }
}
