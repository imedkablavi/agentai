import * as fs from 'fs';
import * as path from 'path';
import { ConversationContext, ExecutionCommand } from '../types';

export type ExecutionMode = 'interactive' | 'scheduled';

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  preview: string;
  normalizedTarget?: string;
}

const ACTIONS = new Set([
  'open_application',
  'close_application',
  'open_file',
  'read_file',
  'summarize_logs',
  'web_search',
  'youtube_search',
  'system_shutdown',
  'system_restart',
  'system_lock',
  'system_sleep',
  'select_item',
  'store_memory',
  'dev_inspect',
  'dev_test',
  'dev_fix',
]);

const APPLICATIONS = new Set([
  'chrome', 'firefox', 'word', 'excel', 'notepad', 'calculator', 'spotify', 'discord', 'telegram',
]);

const PATH_ACTIONS = new Set(['open_file', 'read_file', 'dev_inspect', 'dev_fix']);
const OPTIONAL_PATH_ACTIONS = new Set(['summarize_logs', 'dev_test']);
const SYSTEM_ACTIONS = new Set(['system_shutdown', 'system_restart', 'system_lock', 'system_sleep']);
const SHELL_META = /[\u0000\r\n;&|`$<>]/;
const BLOCKED_FILE = /(^|[\\/])(?:\.git|node_modules|vendor|dist|build)(?:[\\/]|$)|(^|[\\/])\.env(?:\.|$)|(?:^|[\\/])(?:id_rsa|id_ed25519|credentials?|secrets?)(?:\.[^\\/]*)?$|\.(?:pem|p12|pfx|key)$/i;

export class ExecutionPolicy {
  private readonly workspaceRoot: string;
  private readonly platform: NodeJS.Platform;

  constructor(workspaceRoot: string = process.cwd(), platform: NodeJS.Platform = process.platform) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.platform = platform;
  }

  evaluate(command: ExecutionCommand, context: ConversationContext, mode: ExecutionMode = 'interactive'): PolicyDecision {
    if (!ACTIONS.has(command.action)) {
      return this.deny(`Action '${command.action}' is not registered in the execution policy.`);
    }

    if (command.action === 'open_application' || command.action === 'close_application') {
      const app = String(command.target || '').toLowerCase();
      if (!APPLICATIONS.has(app) || SHELL_META.test(app)) {
        return this.deny('Application target is outside the allowlist.');
      }
      const approval = command.action === 'close_application';
      return this.finish(command, mode, approval, `Application: ${app}`, app);
    }

    if (SYSTEM_ACTIONS.has(command.action)) {
      if (this.platform !== 'win32') {
        return this.deny('System power/session controls are currently implemented only for Windows.');
      }
      return this.finish(command, mode, true, `System action: ${command.action}`);
    }

    if (PATH_ACTIONS.has(command.action) || OPTIONAL_PATH_ACTIONS.has(command.action)) {
      const target = String(command.target || '').trim();
      if (!target && OPTIONAL_PATH_ACTIONS.has(command.action)) {
        const approval = command.action === 'dev_test';
        return this.finish(command, mode, approval, command.action === 'dev_test' ? 'Run workspace test script' : 'Read default safe log candidates');
      }
      const checked = this.validateWorkspacePath(target);
      if (!checked.ok) return this.deny(checked.reason);

      const applyingDevPatch = command.action === 'dev_fix' && Boolean(context.dev_patch_target && context.dev_patch_content);
      const approval = command.action === 'dev_test' || applyingDevPatch;
      const preview = applyingDevPatch
        ? `Apply staged code patch to ${checked.relative}`
        : `${command.action}: ${checked.relative}`;
      return this.finish(command, mode, approval, preview, checked.relative);
    }

    if (command.action === 'store_memory') {
      const content = String(command.params?.content || '');
      if (!content.trim()) return this.deny('Memory content is empty.');
      if (content.length > 4000) return this.deny('Memory content exceeds the 4,000 character privacy limit.');
      return this.finish(command, mode, true, `Store memory (${content.length} characters)`);
    }

    if (command.action === 'select_item') {
      const index = Number(command.params?.index || 0);
      const selection = context.selection_context;
      if (!Number.isInteger(index) || index < 1 || !selection || index > selection.items.length) {
        return this.deny('Selection is missing, expired, or outside the current selection scope.');
      }
      const url = String(selection.items[index - 1]?.data?.url || '');
      if (!this.isSafeExternalUrl(url)) return this.deny('Selected URL is not an allowed HTTP(S) destination.');
      return this.finish(command, mode, false, `Open selected HTTP(S) result #${index}`);
    }

    if (command.action === 'web_search' || command.action === 'youtube_search') {
      const query = String(command.params?.query || '');
      if (!query.trim() || query.length > 500 || /[\u0000\r\n]/.test(query)) {
        return this.deny('Search query is empty or outside policy limits.');
      }
      return this.finish(command, mode, false, `${command.action} (${query.length} characters)`);
    }

    return this.finish(command, mode, false, command.action);
  }

  parseApproval(input: string): 'approve' | 'cancel' | 'none' {
    const normalized = input.trim().toLocaleLowerCase();
    const approvals = new Set(['yes', 'confirm', 'approve', 'نعم', 'أؤكد', 'اوافق', 'أوافق', 'evet', 'onayla', 'onaylıyorum']);
    const cancellations = new Set(['no', 'cancel', 'deny', 'لا', 'إلغاء', 'الغاء', 'hayır', 'iptal']);
    if (approvals.has(normalized)) return 'approve';
    if (cancellations.has(normalized)) return 'cancel';
    return 'none';
  }

  validateWorkspacePath(targetPath: string): { ok: true; absolute: string; relative: string } | { ok: false; reason: string } {
    if (!targetPath || targetPath.length > 1000 || SHELL_META.test(targetPath)) {
      return { ok: false, reason: 'Path is empty or contains forbidden control/shell characters.' };
    }

    try {
      const absolute = path.resolve(this.workspaceRoot, targetPath);
      const relative = path.relative(this.workspaceRoot, absolute);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return { ok: false, reason: 'Path escapes the configured workspace boundary.' };
      }
      if (BLOCKED_FILE.test(relative)) {
        return { ok: false, reason: 'Path points to a protected build, VCS, dependency, or secret location.' };
      }

      const boundaryCandidate = fs.existsSync(absolute) ? absolute : path.dirname(absolute);
      if (fs.existsSync(boundaryCandidate)) {
        const real = fs.realpathSync(boundaryCandidate);
        const realRelative = path.relative(this.workspaceRoot, real);
        if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
          return { ok: false, reason: 'Path resolves through a symlink outside the workspace boundary.' };
        }
      }

      return { ok: true, absolute, relative: relative || '.' };
    } catch {
      return { ok: false, reason: 'Path could not be normalized safely.' };
    }
  }

  private isSafeExternalUrl(raw: string): boolean {
    try {
      const url = new URL(raw);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  private finish(
    command: ExecutionCommand,
    mode: ExecutionMode,
    policyRequiresApproval: boolean,
    preview: string,
    normalizedTarget?: string,
  ): PolicyDecision {
    const requiresApproval = policyRequiresApproval || command.requires_confirmation;
    if (mode === 'scheduled' && requiresApproval) {
      return this.deny('Scheduled execution cannot satisfy an interactive approval requirement.', preview);
    }
    return {
      allowed: true,
      requiresApproval,
      reason: requiresApproval ? 'Explicit approval is required by policy.' : 'Allowed by centralized execution policy.',
      preview,
      normalizedTarget,
    };
  }

  private deny(reason: string, preview = 'Execution blocked'): PolicyDecision {
    return { allowed: false, requiresApproval: false, reason, preview };
  }
}
