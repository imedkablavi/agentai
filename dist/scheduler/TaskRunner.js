"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRunner = void 0;
class TaskRunner {
    constructor(scheduler, assistant) {
        this.scheduler = scheduler;
        this.assistant = assistant;
    }
    start(intervalSeconds = 60) {
        this.scheduler.start(intervalSeconds, async (task) => {
            await this.assistant.runScheduledIntent(task);
        });
    }
    stop() {
        this.scheduler.stop();
    }
}
exports.TaskRunner = TaskRunner;
//# sourceMappingURL=TaskRunner.js.map