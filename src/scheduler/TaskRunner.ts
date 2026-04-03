import { SchedulerManager } from './SchedulerManager';
import { ScheduledTask } from './types';
import { AIAssistant } from '../AIAssistant';

export class TaskRunner {
  constructor(private scheduler: SchedulerManager, private assistant: AIAssistant) {}

  start(intervalSeconds: number = 60): void {
    this.scheduler.start(intervalSeconds, async (task: ScheduledTask) => {
      await this.assistant.runScheduledIntent(task);
    });
  }

  stop(): void {
    this.scheduler.stop();
  }
}

