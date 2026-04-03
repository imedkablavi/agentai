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
exports.GitSafetyEngine = exports.ExecutionMutex = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ExecutionMutex {
    static async acquire(timeoutMs = 30000) {
        const start = Date.now();
        while (this.locked) {
            if (Date.now() - start > timeoutMs)
                return false;
            await new Promise(r => setTimeout(r, 100));
        }
        this.locked = true;
        return true;
    }
    static release() {
        this.locked = false;
    }
}
exports.ExecutionMutex = ExecutionMutex;
ExecutionMutex.locked = false;
class GitSafetyEngine {
    constructor(workspaceRoot = process.cwd()) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }
    async isGitRepo() {
        try {
            await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
            return true;
        }
        catch {
            return false;
        }
    }
    async createSafeCheckpoint() {
        if (!(await this.isGitRepo()))
            return { success: false };
        try {
            // Rather than stashing and hiding files from the user unexpectedly,
            // we just commit the current dirty state to a temporary safety branch.
            // Wait, an easier atomic rollback for specific files without touching branch:
            // We rely on FileSystemSafety for file backups, but we track the git SHA to see if we messed up structural git.
            // Alternatively, we use `git stash create` which creates a detached stash without modifying wdir!
            const { stdout } = await execAsync('git stash create "Agent pre-patch safety stash"', { cwd: this.workspaceRoot });
            const hash = stdout.trim();
            return { success: !!hash, hash };
        }
        catch {
            return { success: false };
        }
    }
    async restoreCheckpoint(hash) {
        if (!hash)
            return false;
        try {
            // Re-apply the stash directly overriding the worktree safely
            await execAsync(`git stash apply ${hash}`, { cwd: this.workspaceRoot });
            return true;
        }
        catch {
            return false;
        }
    }
    async getGitDiff(targetPath) {
        try {
            const { stdout } = await execAsync(`git diff "${targetPath}"`, { cwd: this.workspaceRoot });
            return stdout;
        }
        catch {
            return '';
        }
    }
}
exports.GitSafetyEngine = GitSafetyEngine;
//# sourceMappingURL=GitSafetyEngine.js.map