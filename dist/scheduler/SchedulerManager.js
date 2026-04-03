"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerManager = void 0;
const date_fns_1 = require("date-fns");
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SchedulerManager {
    constructor(getNow = () => new Date()) {
        this.getNow = getNow;
        this.tasks = [];
        this.running = false;
        this.intervalHandle = null;
        this.load();
    }
    addTask(intent, context, trigger) {
        const id = (0, uuid_1.v4)();
        const next_run = this.computeNextRun(trigger);
        const task = {
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
    enableTask(id) {
        const t = this.tasks.find(x => x.id === id);
        if (!t)
            return false;
        t.enabled = true;
        this.save();
        return true;
    }
    disableAll() {
        this.tasks.forEach(t => (t.enabled = false));
        this.save();
    }
    listTasks() {
        return [...this.tasks];
    }
    getDueTasks() {
        const now = this.getNow();
        return this.tasks.filter(t => t.enabled && new Date(t.next_run).getTime() <= now.getTime());
    }
    start(tickSeconds, onDue) {
        if (this.running)
            return;
        this.running = true;
        this.intervalHandle = setInterval(async () => {
            const now = this.getNow();
            for (const t of this.getDueTasks()) {
                await onDue(t);
                t.last_run = (0, date_fns_1.formatISO)(now);
                t.next_run = this.computeNextRun(t.trigger);
            }
            this.save();
        }, tickSeconds * 1000);
    }
    stop() {
        if (!this.running)
            return;
        clearInterval(this.intervalHandle);
        this.running = false;
    }
    computeNextRun(trigger) {
        const now = this.getNow();
        if (trigger.type === 'once') {
            return trigger.at;
        }
        if (trigger.type === 'daily') {
            const [hh, mm] = trigger.at.split(':').map(n => parseInt(n, 10));
            const next = new Date(now);
            next.setHours(hh, mm || 0, 0, 0);
            if (next.getTime() <= now.getTime())
                next.setDate(next.getDate() + 1);
            return (0, date_fns_1.formatISO)(next);
        }
        if (trigger.type === 'interval') {
            const next = new Date(now);
            next.setMinutes(next.getMinutes() + trigger.minutes);
            return (0, date_fns_1.formatISO)(next);
        }
        return (0, date_fns_1.formatISO)(now);
    }
    storePath() {
        const dir = path.join(__dirname, '../../data/scheduler');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, 'tasks.json');
    }
    load() {
        try {
            const p = this.storePath();
            if (fs.existsSync(p)) {
                const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
                this.tasks = raw || [];
            }
        }
        catch { }
    }
    save() {
        try {
            const p = this.storePath();
            fs.writeFileSync(p, JSON.stringify(this.tasks, null, 2));
        }
        catch { }
    }
}
exports.SchedulerManager = SchedulerManager;
//# sourceMappingURL=SchedulerManager.js.map