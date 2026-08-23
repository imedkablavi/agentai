import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class ExecutionMutex {
  private static locked = false;

  static async acquire(timeoutMs = 30000): Promise<boolean> {
    const start = Date.now();
    while (this.locked) {
      if (Date.now() - start > timeoutMs) return false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.locked = true;
    return true;
  }

  static release(): void {
    this.locked = false;
  }
}

export class GitSafetyEngine {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.workspaceRoot,
        timeout: 5000,
      });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async createSafeCheckpoint(): Promise<{ success: boolean; hash?: string }> {
    if (!(await this.isGitRepo())) return { success: false };
    try {
      const { stdout } = await execFileAsync('git', ['stash', 'create', 'Agent pre-patch safety stash'], {
        cwd: this.workspaceRoot,
        timeout: 10000,
      });
      const hash = stdout.trim();
      return { success: Boolean(hash), hash: hash || undefined };
    } catch {
      return { success: false };
    }
  }

  async restoreCheckpoint(hash: string): Promise<boolean> {
    if (!/^[0-9a-f]{7,64}$/i.test(hash)) return false;
    try {
      await execFileAsync('git', ['stash', 'apply', '--index', hash], {
        cwd: this.workspaceRoot,
        timeout: 15000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getGitDiff(targetPath: string): Promise<string> {
    const safe = this.relativeSafePath(targetPath);
    if (!safe) return '';
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--', safe], {
        cwd: this.workspaceRoot,
        timeout: 10000,
        maxBuffer: 512 * 1024,
      });
      return stdout;
    } catch {
      return '';
    }
  }

  private relativeSafePath(targetPath: string): string | null {
    if (!targetPath || /[\u0000\r\n]/.test(targetPath)) return null;
    const absolute = path.resolve(this.workspaceRoot, targetPath);
    const relative = path.relative(this.workspaceRoot, absolute);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    return relative || '.';
  }
}
