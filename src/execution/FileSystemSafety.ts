import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AuditTrail } from '../security/AuditTrail';
import { ensurePrivateDir, getAgentDataDir } from '../security/SecureStorage';

export interface PatchReceipt {
  success: boolean;
  backupPath?: string;
  createdNewFile?: boolean;
}

export class FileSystemSafety {
  private readonly workspaceRoot: string;
  private readonly rollbackDir: string;
  private readonly audit: AuditTrail;

  constructor(workspaceRoot: string = process.cwd(), dataDir: string = getAgentDataDir(), audit?: AuditTrail) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.rollbackDir = path.join(dataDir, 'rollback');
    this.audit = audit || new AuditTrail(dataDir);
  }

  isSafePath(targetPath: string): boolean {
    return this.resolveSafePath(targetPath) !== null;
  }

  async readFile(targetPath: string): Promise<{ content: string; error?: string }> {
    const resolved = this.resolveSafePath(targetPath);
    if (!resolved) return { content: '', error: 'Path rejected due to workspace safety boundaries' };
    if (!fs.existsSync(resolved)) return { content: '', error: 'File unreadable or does not exist' };

    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) return { content: '', error: 'Target is not a regular file' };
      if (stat.size > 500_000) return { content: '', error: 'File too large (> 500KB)' };

      const fd = fs.openSync(resolved, 'r');
      try {
        const buffer = Buffer.alloc(Math.min(1024, Math.max(1, stat.size)));
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        for (let i = 0; i < bytesRead; i += 1) {
          if (buffer[i] === 0) return { content: '', error: 'Binary files are not readable through the text interface' };
        }
      } finally {
        fs.closeSync(fd);
      }

      return { content: fs.readFileSync(resolved, 'utf8') };
    } catch {
      return { content: '', error: 'File could not be read safely' };
    }
  }

  async applyPatch(targetPath: string, newContent: string): Promise<PatchReceipt> {
    const resolved = this.resolveSafePath(targetPath);
    if (!resolved || !newContent || !newContent.trim()) return { success: false };
    if (Buffer.byteLength(newContent, 'utf8') > 2_000_000) return { success: false };

    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) return { success: false };

    const existedBefore = fs.existsSync(resolved);
    let backupPath: string | undefined;
    let tempPath: string | undefined;

    try {
      if (existedBefore) {
        ensurePrivateDir(this.rollbackDir);
        backupPath = path.join(this.rollbackDir, `${randomUUID()}.bak`);
        fs.copyFileSync(resolved, backupPath);
        try { fs.chmodSync(backupPath, 0o600); } catch {}
      }

      tempPath = path.join(parent, `.${path.basename(resolved)}.${process.pid}.${randomUUID()}.tmp`);
      const existingMode = existedBefore ? fs.statSync(resolved).mode : 0o600;
      fs.writeFileSync(tempPath, newContent, { encoding: 'utf8', mode: existingMode });
      if (fs.statSync(tempPath).size === 0) throw new Error('Atomic patch staging produced an empty file');
      fs.renameSync(tempPath, resolved);
      tempPath = undefined;

      this.audit.record({ action: 'file_patch', outcome: 'success', target: this.relativeTarget(resolved), mode: 'internal' });
      return { success: true, backupPath, createdNewFile: !existedBefore };
    } catch {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      if (backupPath) this.rollback(targetPath, backupPath);
      else if (!existedBefore && fs.existsSync(resolved)) {
        try { fs.unlinkSync(resolved); } catch {}
      }
      this.audit.record({ action: 'file_patch', outcome: 'failure', target: targetPath, mode: 'internal' });
      return { success: false, backupPath, createdNewFile: !existedBefore };
    }
  }

  rollback(targetPath: string, backupPath?: string, createdNewFile = false): boolean {
    const resolved = this.resolveSafePath(targetPath);
    if (!resolved) return false;

    try {
      if (backupPath && this.isPrivateRollbackPath(backupPath) && fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, resolved);
        this.discardBackup(backupPath);
        this.audit.record({ action: 'file_patch', outcome: 'rollback', target: this.relativeTarget(resolved), mode: 'internal' });
        return true;
      }
      if (createdNewFile && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        this.audit.record({ action: 'file_patch', outcome: 'rollback', target: this.relativeTarget(resolved), mode: 'internal' });
        return true;
      }
      return false;
    } catch {
      this.audit.record({ action: 'file_patch', outcome: 'failure', target: targetPath, detail: 'rollback_failed', mode: 'internal' });
      return false;
    }
  }

  discardBackup(backupPath?: string): void {
    if (!backupPath || !this.isPrivateRollbackPath(backupPath)) return;
    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch {
      // Cleanup failure is recorded by the caller when material to the transaction.
    }
  }

  private resolveSafePath(targetPath: string): string | null {
    if (!targetPath || targetPath.length > 1000 || /[\u0000\r\n]/.test(targetPath)) return null;

    try {
      const resolved = path.resolve(this.workspaceRoot, targetPath);
      if (!this.isInside(this.workspaceRoot, resolved)) return null;

      const relative = path.relative(this.workspaceRoot, resolved);
      const blocked = /(^|[\\/])(?:node_modules|vendor|\.git|dist|build)(?:[\\/]|$)|(^|[\\/])\.env(?:\.|$)|\.(?:exe|dll|so|dylib|pem|p12|pfx|key)$/i;
      if (blocked.test(relative)) return null;

      if (fs.existsSync(resolved)) {
        const real = fs.realpathSync(resolved);
        if (!this.isInside(this.workspaceRoot, real)) return null;
      } else {
        const parent = path.dirname(resolved);
        if (!fs.existsSync(parent)) return null;
        const realParent = fs.realpathSync(parent);
        if (!this.isInside(this.workspaceRoot, realParent)) return null;
      }

      return resolved;
    } catch {
      return null;
    }
  }

  private isInside(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  }

  private isPrivateRollbackPath(candidate: string): boolean {
    return this.isInside(path.resolve(this.rollbackDir), path.resolve(candidate));
  }

  private relativeTarget(resolved: string): string {
    return path.relative(this.workspaceRoot, resolved) || '.';
  }
}
