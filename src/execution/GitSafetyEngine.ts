import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export class ExecutionMutex {
  private static locked = false;

  static async acquire(timeoutMs = 30000): Promise<boolean> {
    const start = Date.now();
    while (this.locked) {
      if (Date.now() - start > timeoutMs) return false;
      await new Promise(r => setTimeout(r, 100));
    }
    this.locked = true;
    return true;
  }

  static release() {
    this.locked = false;
  }
}

export class GitSafetyEngine {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  async createSafeCheckpoint(): Promise<{ success: boolean; hash?: string }> {
    if (!(await this.isGitRepo())) return { success: false };
    
    try {
      // Rather than stashing and hiding files from the user unexpectedly,
      // we just commit the current dirty state to a temporary safety branch.
      // Wait, an easier atomic rollback for specific files without touching branch:
      // We rely on FileSystemSafety for file backups, but we track the git SHA to see if we messed up structural git.
      // Alternatively, we use `git stash create` which creates a detached stash without modifying wdir!
      const { stdout } = await execAsync('git stash create "Agent pre-patch safety stash"', { cwd: this.workspaceRoot });
      const hash = stdout.trim();
      return { success: !!hash, hash };
    } catch {
      return { success: false };
    }
  }

  async restoreCheckpoint(hash: string): Promise<boolean> {
    if (!hash) return false;
    try {
      // Re-apply the stash directly overriding the worktree safely
      await execAsync(`git stash apply ${hash}`, { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  async getGitDiff(targetPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git diff "${targetPath}"`, { cwd: this.workspaceRoot });
      return stdout;
    } catch {
      return '';
    }
  }
}
