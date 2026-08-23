import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ensurePrivateDir, getAgentDataDir } from './SecureStorage';
import { redactValue, redactedError } from './Redaction';

export type AuditOutcome = 'allowed' | 'denied' | 'approval_required' | 'success' | 'failure' | 'rollback' | 'cancelled';

export interface AuditEvent {
  event_id?: string;
  timestamp?: string;
  action: string;
  outcome: AuditOutcome;
  mode?: 'interactive' | 'scheduled' | 'internal';
  target?: string;
  approval_id?: string;
  detail?: unknown;
}

export class AuditTrail {
  private readonly auditDir: string;
  private readonly auditPath: string;
  private readonly maxBytes: number;

  constructor(dataDir: string = getAgentDataDir(), maxBytes = 2 * 1024 * 1024) {
    this.auditDir = path.join(dataDir, 'audit');
    this.auditPath = path.join(this.auditDir, 'audit.jsonl');
    this.maxBytes = maxBytes;
  }

  record(event: AuditEvent): void {
    try {
      ensurePrivateDir(this.auditDir);
      this.rotateIfNeeded();
      const safe = redactValue({
        event_id: event.event_id || randomUUID(),
        timestamp: event.timestamp || new Date().toISOString(),
        action: event.action,
        outcome: event.outcome,
        mode: event.mode || 'interactive',
        target: event.target,
        approval_id: event.approval_id,
        detail: event.detail,
      });
      fs.appendFileSync(this.auditPath, `${JSON.stringify(safe)}\n`, { encoding: 'utf8', mode: 0o600 });
      try {
        fs.chmodSync(this.auditPath, 0o600);
      } catch {
        // Best effort on Windows/non-POSIX filesystems.
      }
    } catch {
      // Audit failures must not cause privileged work to proceed. Callers make
      // policy decisions independently; this logger never changes authorization.
    }
  }

  recordError(action: string, error: unknown, target?: string): void {
    this.record({ action, outcome: 'failure', target, detail: redactedError(error), mode: 'internal' });
  }

  readRecent(limit = 50): AuditEvent[] {
    if (!fs.existsSync(this.auditPath)) return [];
    try {
      return fs.readFileSync(this.auditPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .slice(-Math.max(1, Math.min(limit, 200)))
        .map(line => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(this.auditPath)) fs.unlinkSync(this.auditPath);
      const rotated = `${this.auditPath}.1`;
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    } catch {
      // Privacy deletion is exposed to callers as best effort; the CLI reports
      // only whether files remain after the operation.
    }
  }

  getPath(): string {
    return this.auditPath;
  }

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.auditPath)) return;
    const stat = fs.statSync(this.auditPath);
    if (stat.size < this.maxBytes) return;

    const rotated = `${this.auditPath}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(this.auditPath, rotated);
  }
}
