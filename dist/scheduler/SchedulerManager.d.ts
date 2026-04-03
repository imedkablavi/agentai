import { ScheduledTask, TimeTrigger } from './types';
import { Intent, ConversationContext } from '../types';
export declare class SchedulerManager {
    private getNow;
    private tasks;
    private running;
    private intervalHandle;
    constructor(getNow?: () => Date);
    addTask(intent: Intent, context: ConversationContext, trigger: TimeTrigger): ScheduledTask;
    enableTask(id: string): boolean;
    disableAll(): void;
    listTasks(): ScheduledTask[];
    getDueTasks(): ScheduledTask[];
    start(tickSeconds: number, onDue: (task: ScheduledTask) => Promise<void>): void;
    stop(): void;
    private computeNextRun;
    private storePath;
    private load;
    private save;
}
//# sourceMappingURL=SchedulerManager.d.ts.map