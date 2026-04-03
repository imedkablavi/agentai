import { ScheduledTask, TimeTrigger } from './types';
import { Intent, ConversationContext } from '../types';
import { formatISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class SchedulerManager {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private intervalHandle: any = null;

  constructor(private getNow: () => Date = () => new Date()) {
    this.load();
  }

  addTask(intent: Intent, context: ConversationContext, trigger: TimeTrigger): ScheduledTask {
    const id = uuidv4();
    const next_run = this.computeNextRun(trigger);
    const task: ScheduledTask = {
      id,
      trigger,
      intent,
      context_snapshot: { ...context },
      enabled: false,
      next_run,
    };
    this.tasks.push(task);
    this.save();
    return task;
  }

  enableTask(id: string): boolean {
    const t = this.tasks.find(x => x.id === id);
    if (!t) return false;
    t.enabled = true;
    this.save();
    return true;
  }

  disableAll(): void {
    this.tasks.forEach(t => (t.enabled = false));
    this.save();
  }

  listTasks(): ScheduledTask[] {
    return [...this.tasks];
  }

  getDueTasks(): ScheduledTask[] {
    const now = this.getNow();
    return this.tasks.filter(t => t.enabled && new Date(t.next_run).getTime() <= now.getTime());
  }

  start(tickSeconds: number, onDue: (task: ScheduledTask) => Promise<void>): void {
    if (this.running) return;
    this.running = true;
    this.intervalHandle = setInterval(async () => {
      const now = this.getNow();
      for (const t of this.getDueTasks()) {
        await onDue(t);
        t.last_run = formatISO(now);
        t.next_run = this.computeNextRun(t.trigger);
      }
      this.save();
    }, tickSeconds * 1000);
  }

  stop(): void {
    if (!this.running) return;
    clearInterval(this.intervalHandle);
    this.running = false;
  }

  private computeNextRun(trigger: TimeTrigger): string {
    const now = this.getNow();
    if (trigger.type === 'once') {
      return trigger.at;
    }
    if (trigger.type === 'daily') {
      const [hh, mm] = trigger.at.split(':').map(n => parseInt(n, 10));
      const next = new Date(now);
      next.setHours(hh, mm || 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      return formatISO(next);
    }
    if (trigger.type === 'interval') {
      const next = new Date(now);
      next.setMinutes(next.getMinutes() + trigger.minutes);
      return formatISO(next);
    }
    return formatISO(now);
  }

  private storePath(): string {
    const dir = path.join(__dirname, '../../data/scheduler');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'tasks.json');
  }

  private load(): void {
    try {
      const p = this.storePath();
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as ScheduledTask[];
        this.tasks = raw || [];
      }
    } catch {}
  }

  private save(): void {
    try {
      const p = this.storePath();
      fs.writeFileSync(p, JSON.stringify(this.tasks, null, 2));
    } catch {}
  }
}
