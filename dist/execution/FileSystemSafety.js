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
exports.FileSystemSafety = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileSystemSafety {
    constructor(workspaceRoot = process.cwd()) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }
    isSafePath(targetPath) {
        if (!targetPath)
            return false;
        try {
            // Normalize to prevent traversal
            const normalizedPath = path.normalize(targetPath);
            const resolved = path.resolve(this.workspaceRoot, normalizedPath);
            // Strict prefix check and realpath symlink resolution
            let actualResolved = resolved;
            if (fs.existsSync(resolved)) {
                actualResolved = fs.realpathSync(resolved);
            }
            if (!actualResolved.startsWith(this.workspaceRoot))
                return false;
            // Protected directories/files rejection
            const blockedPatterns = [
                /(^|[\\/])node_modules([\\/]|$)/,
                /(^|[\\/])vendor([\\/]|$)/,
                /(^|[\\/])\.git([\\/]|$)/,
                /(^|[\\/])dist([\\/]|$)/,
                /(^|[\\/])build([\\/]|$)/,
                /(^|[\\/])\.env/,
                /\.exe$/, /\.dll$/, /\.so$/, /\.dylib$/
            ];
            if (blockedPatterns.some(p => p.test(actualResolved)))
                return false;
            return true;
        }
        catch {
            return false;
        }
    }
    async readFile(targetPath) {
        if (!this.isSafePath(targetPath)) {
            return { content: '', error: 'Path rejected due to safety boundaries' };
        }
        const resolved = path.resolve(this.workspaceRoot, targetPath);
        if (!fs.existsSync(resolved)) {
            return { content: '', error: 'File unreadable or does not exist' };
        }
        const stat = fs.statSync(resolved);
        if (stat.size > 500000) { // arbitrary 500KB limit
            return { content: '', error: 'File too large (> 500KB)' };
        }
        // Binary check heuristic
        const buffer = Buffer.alloc(1024);
        const fd = fs.openSync(resolved, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);
        let isBinary = false;
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) {
                isBinary = true;
                break;
            }
        }
        if (isBinary) {
            return { content: '', error: 'Cannot read binary file contents expected text' };
        }
        const content = fs.readFileSync(resolved, 'utf8');
        return { content };
    }
    async applyPatch(targetPath, newContent) {
        if (!this.isSafePath(targetPath))
            return { success: false };
        if (!newContent || !newContent.trim())
            return { success: false };
        const resolved = path.resolve(this.workspaceRoot, targetPath);
        let backupPath;
        // Backup first
        if (fs.existsSync(resolved)) {
            backupPath = `${resolved}.backup-${Date.now()}`;
            try {
                fs.copyFileSync(resolved, backupPath);
            }
            catch {
                return { success: false }; // Fail if we cannot backup
            }
        }
        try {
            fs.writeFileSync(resolved, newContent, 'utf8');
            // Basic integrity check (did it actually write, is it not empty when shouldn't be)
            if (newContent.trim().length > 0) {
                const stats = fs.statSync(resolved);
                if (stats.size === 0)
                    throw new Error('File written but is empty');
            }
            this.logAction('applyPatch', targetPath, 'success');
            return { success: true, backupPath };
        }
        catch (err) {
            if (backupPath)
                this.rollback(targetPath, backupPath);
            this.logAction('applyPatch', targetPath, `failure: ${err.message}`);
            return { success: false };
        }
    }
    rollback(targetPath, backupPath) {
        try {
            const resolved = path.resolve(this.workspaceRoot, targetPath);
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, resolved);
                this.logAction('rollback', targetPath, 'success');
                return true;
            }
            return false;
        }
        catch {
            this.logAction('rollback', targetPath, 'failure');
            return false;
        }
    }
    logAction(action, target, result) {
        try {
            const logLine = `[${new Date().toISOString()}] ACTION: ${action} | TARGET: ${target} | RESULT: ${result}\n`;
            const logFile = path.join(this.workspaceRoot, '.agent_action.log');
            fs.appendFileSync(logFile, logLine, 'utf8');
        }
        catch {
            // Silent fail for logging to avoid blocking execution
        }
    }
}
exports.FileSystemSafety = FileSystemSafety;
//# sourceMappingURL=FileSystemSafety.js.map