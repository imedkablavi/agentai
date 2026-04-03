import { SchedulerManager } from './SchedulerManager';
import { AIAssistant } from '../AIAssistant';
export declare class TaskRunner {
    private scheduler;
    private assistant;
    constructor(scheduler: SchedulerManager, assistant: AIAssistant);
    start(intervalSeconds?: number): void;
    stop(): void;
}
//# sourceMappingURL=TaskRunner.d.ts.map