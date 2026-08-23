import { ExecutionCommand, SkillResult, ErrorResponse } from '../types';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { load } from 'cheerio';
import { formatISO } from 'date-fns';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { MemoryManager } from '../memory/MemoryManager';
import { ContextManager } from '../context/ContextManager';
import { FileSystemSafety } from './FileSystemSafety';
import { PatchGenerator } from '../reasoning/PatchGenerator';
import { ValidationEngine } from './ValidationEngine';
import { ExecutionMutex, GitSafetyEngine } from './GitSafetyEngine';
import { AuditTrail } from '../security/AuditTrail';
import { redactString, redactedError } from '../security/Redaction';

const execFileAsync = promisify(execFile);

const APPLICATIONS: Record<string, Record<'win32' | 'darwin' | 'linux', string[]>> = {
  chrome: {
    win32: ['chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['google-chrome', 'chromium', 'chromium-browser'],
  },
  firefox: {
    win32: ['firefox.exe', 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'],
    darwin: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
    linux: ['firefox'],
  },
  word: {
    win32: ['WINWORD.EXE'],
    darwin: ['/Applications/Microsoft Word.app/Contents/MacOS/Microsoft Word'],
    linux: ['libreoffice'],
  },
  excel: {
    win32: ['EXCEL.EXE'],
    darwin: ['/Applications/Microsoft Excel.app/Contents/MacOS/Microsoft Excel'],
    linux: ['libreoffice'],
  },
  notepad: {
    win32: ['notepad.exe'],
    darwin: ['/Applications/TextEdit.app/Contents/MacOS/TextEdit'],
    linux: ['gedit', 'kate'],
  },
  calculator: {
    win32: ['calc.exe'],
    darwin: ['/Applications/Calculator.app/Contents/MacOS/Calculator'],
    linux: ['gnome-calculator', 'kcalc'],
  },
  spotify: {
    win32: ['Spotify.exe'],
    darwin: ['/Applications/Spotify.app/Contents/MacOS/Spotify'],
    linux: ['spotify'],
  },
  discord: {
    win32: ['Discord.exe'],
    darwin: ['/Applications/Discord.app/Contents/MacOS/Discord'],
    linux: ['discord'],
  },
  telegram: {
    win32: ['Telegram.exe'],
    darwin: ['/Applications/Telegram.app/Contents/MacOS/Telegram'],
    linux: ['telegram-desktop'],
  },
};

const PROCESS_NAMES: Record<string, { win32: string; unix: string }> = {
  chrome: { win32: 'chrome.exe', unix: 'chrome' },
  firefox: { win32: 'firefox.exe', unix: 'firefox' },
  word: { win32: 'WINWORD.EXE', unix: 'libreoffice' },
  excel: { win32: 'EXCEL.EXE', unix: 'libreoffice' },
  notepad: { win32: 'notepad.exe', unix: 'gedit' },
  calculator: { win32: 'CalculatorApp.exe', unix: 'gnome-calculator' },
  spotify: { win32: 'Spotify.exe', unix: 'spotify' },
  discord: { win32: 'Discord.exe', unix: 'discord' },
  telegram: { win32: 'Telegram.exe', unix: 'telegram-desktop' },
};

export class CommandExecutor {
  private fsSafety: FileSystemSafety;
  private patchGen: PatchGenerator;
  private validator: ValidationEngine;
  private gitSafety: GitSafetyEngine;
  private audit: AuditTrail;

  constructor(
    private memory: MemoryManager,
    private context: ContextManager,
    audit?: AuditTrail,
  ) {
    this.audit = audit || new AuditTrail();
    this.fsSafety = new FileSystemSafety(process.cwd(), undefined, this.audit);
    this.patchGen = new PatchGenerator();
    this.validator = new ValidationEngine();
    this.gitSafety = new GitSafetyEngine();
  }

  private logDevAction(
    action: string,
    target: string,
    result: 'success' | 'failure' | 'rollback',
    duration: number,
    errorDetails?: string,
  ): void {
    this.audit.record({
      action,
      target,
      outcome: result === 'rollback' ? 'rollback' : result,
      mode: 'internal',
      detail: { durationMs: duration, message: errorDetails ? redactString(errorDetails, 1000) : undefined },
    });
  }

  async execute(command: ExecutionCommand, intentLanguage: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    if (command.requires_confirmation) {
      return {
        success: false,
        error_detail: this.error('permission', true, this.confirmationMessage(intentLanguage), false),
        requires_followup: true,
        suggested_actions: [this.confirmKeyword(intentLanguage), this.cancelKeyword(intentLanguage)],
      };
    }

    this.context.setState('EXECUTING');
    try {
      let result: SkillResult;
      switch (command.action) {
        case 'open_application': result = await this.execOpenApp(command); break;
        case 'close_application': result = await this.execCloseApp(command); break;
        case 'open_file': result = await this.execOpenFile(command); break;
        case 'read_file': result = await this.execReadFile(command); break;
        case 'summarize_logs': result = await this.execSummarizeLogs(command); break;
        case 'web_search': result = await this.execWebSearch(command); break;
        case 'youtube_search': result = await this.execYouTubeSearch(command); break;
        case 'system_shutdown':
        case 'system_restart':
        case 'system_lock':
        case 'system_sleep': result = await this.execSystem(command); break;
        case 'select_item': result = await this.execSelection(command); break;
        case 'store_memory': result = await this.execStoreMemory(command); break;
        case 'dev_inspect': result = await this.execDevInspect(command); break;
        case 'dev_test': result = await this.execDevTest(command); break;
        case 'dev_fix': result = await this.execDevFix(command); break;
        default:
          result = { success: false, error_detail: this.error('permission', false, 'Action is not registered for execution.', false) };
      }

      this.audit.record({
        action: command.action,
        target: command.target,
        outcome: result.success ? 'success' : 'failure',
        mode: 'interactive',
        detail: result.error_detail ? { type: result.error_detail.type, message: result.error_detail.user_message } : undefined,
      });
      return result;
    } catch (error) {
      this.context.setState('ERROR');
      this.audit.recordError(command.action, error, command.target);
      return { success: false, error_detail: this.error('unknown', true, redactedError(error), true) };
    } finally {
      const current = this.context.getContext();
      this.context.setState(current.awaiting_confirmation ? 'AWAITING_CONFIRMATION' : 'IDLE');
    }
  }

  private async execOpenApp(command: ExecutionCommand): Promise<SkillResult> {
    const app = String(command.target || '').toLowerCase();
    const candidates = this.applicationCandidates(app);
    if (!candidates.length) return { success: false, error_detail: this.error('permission', false, 'Application is outside the allowlist.', false) };

    try {
      await this.launchFirst(candidates, []);
      return { success: true, data: { application: app, action: 'opened' }, suggested_actions: [`Close ${app}`] };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'Failed to launch the allowed application on this platform.', true) };
    }
  }

  private async execCloseApp(command: ExecutionCommand): Promise<SkillResult> {
    const app = String(command.target || '').toLowerCase();
    const processName = PROCESS_NAMES[app];
    if (!processName) return { success: false, error_detail: this.error('permission', false, 'Application is outside the allowlist.', false) };

    try {
      if (process.platform === 'win32') {
        await this.runFile('taskkill', ['/F', '/IM', processName.win32], process.cwd(), 10_000);
      } else {
        await this.runFile('pkill', ['-x', processName.unix], process.cwd(), 10_000);
      }
      return { success: true, data: { application: app, action: 'closed' } };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'Failed to close the allowed application.', true) };
    }
  }

  private async execOpenFile(command: ExecutionCommand): Promise<SkillResult> {
    return this.readFileResult(command, 1200, 'preview');
  }

  private async execReadFile(command: ExecutionCommand): Promise<SkillResult> {
    return this.readFileResult(command, 4000, 'result');
  }

  private async readFileResult(command: ExecutionCommand, limit: number, field: 'preview' | 'result'): Promise<SkillResult> {
    const target = String(command.target || '');
    if (!target) return { success: false, error_detail: this.error('context', true, 'File path is required.', false) };
    const { content, error } = await this.fsSafety.readFile(target);
    if (error) return { success: false, error_detail: this.error('permission', true, error, false) };
    return { success: true, data: { action: command.action, target, [field]: content.slice(0, limit) } };
  }

  private async execSummarizeLogs(command: ExecutionCommand): Promise<SkillResult> {
    const explicit = String(command.target || '');
    const candidates = explicit ? [explicit] : ['logs/latest.log', 'logs/error.log'];

    for (const target of candidates) {
      const { content, error } = await this.fsSafety.readFile(target);
      if (error) continue;
      const tail = content.split('\n').map(line => line.trim()).filter(Boolean).slice(-50);
      const errorCount = tail.filter(line => /error|failed|failure|exception|خطأ|فشل/i.test(line)).length;
      const warnCount = tail.filter(line => /warn|warning|تحذير/i.test(line)).length;
      const recent = tail.slice(-10).map(line => redactString(line, 500));
      return {
        success: true,
        data: {
          action: 'summarize_logs',
          target,
          result: `File: ${target}\nLines inspected: ${tail.length}\nErrors: ${errorCount}\nWarnings: ${warnCount}\nRecent redacted events:\n${recent.join('\n')}`,
        },
      };
    }

    return { success: false, error_detail: this.error('context', true, 'No readable log exists inside the safe workspace scope.', false) };
  }

  private async execWebSearch(command: ExecutionCommand): Promise<SkillResult> {
    const query = String(command.params?.query || '').trim();
    if (!query) return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
    const results = await this.searchMulti(query);
    const items = results.slice(0, 5).map((item, index) => ({ id: String(index + 1), label: item.title, data: item }));
    this.context.setSelectionContext({ type: 'search_results', items, expires_at: formatISO(new Date(Date.now() + 5 * 60 * 1000)) });
    this.context.setState('AWAITING_SELECTION');
    return { success: true, data: { query, results }, requires_followup: true, suggested_actions: items.map(item => `Select ${item.id}: ${item.label}`) };
  }

  private async execYouTubeSearch(command: ExecutionCommand): Promise<SkillResult> {
    const query = String(command.params?.query || '').trim();
    if (!query) return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
    const videos = await this.searchYouTube(query);
    const items = videos.slice(0, 5).map((item, index) => ({ id: String(index + 1), label: item.title, data: item }));
    this.context.setSelectionContext({ type: 'videos', items, expires_at: formatISO(new Date(Date.now() + 5 * 60 * 1000)) });
    this.context.setState('AWAITING_SELECTION');
    return { success: true, data: { query, videos }, requires_followup: true, suggested_actions: items.map(item => `Select ${item.id}: ${item.label}`) };
  }

  private async execSystem(command: ExecutionCommand): Promise<SkillResult> {
    if (process.platform !== 'win32') {
      return { success: false, error_detail: this.error('permission', false, 'System power/session actions are currently supported only on Windows.', false) };
    }

    const commands: Record<string, [string, string[]]> = {
      system_shutdown: ['shutdown', ['/s', '/t', '0']],
      system_restart: ['shutdown', ['/r', '/t', '0']],
      system_lock: ['rundll32.exe', ['user32.dll,LockWorkStation']],
      system_sleep: ['rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']],
    };
    const spec = commands[command.action];
    if (!spec) return { success: false, error_detail: this.error('permission', false, 'Unsupported system action.', false) };

    try {
      await this.runFile(spec[0], spec[1], process.cwd(), 10_000);
      return { success: true, data: { command: command.action } };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'System command failed.', true) };
    }
  }

  private async execSelection(command: ExecutionCommand): Promise<SkillResult> {
    const index = Number(command.params?.index || 0);
    const selection = this.context.getContext().selection_context;
    if (!selection || !Number.isInteger(index) || index < 1 || index > selection.items.length) {
      return { success: false, error_detail: this.error('context', true, 'No valid active selection exists.', false) };
    }

    const item = selection.items[index - 1].data;
    const url = String(item?.url || '');
    if (!this.isSafeUrl(url)) return { success: false, error_detail: this.error('permission', false, 'Selected URL was rejected by protocol policy.', false) };

    try {
      if (process.platform === 'win32') await this.runFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], process.cwd(), 10_000);
      else if (process.platform === 'darwin') await this.runFile('open', [url], process.cwd(), 10_000);
      else await this.runFile('xdg-open', [url], process.cwd(), 10_000);
      this.context.setSelectionContext(null);
      return { success: true, data: { action: 'opened', url, title: item?.title } };
    } catch {
      return { success: false, error_detail: this.error('network', true, 'Failed to open the selected URL.', true) };
    }
  }

  private async execStoreMemory(command: ExecutionCommand): Promise<SkillResult> {
    const content = String(command.params?.content || '').trim();
    if (!content) return { success: false, error_detail: this.error('context', true, 'No memory content', false) };
    this.memory.addLongTermMemory({
      type: 'pattern',
      description: content,
      frequency: 1,
      last_occurrence: formatISO(new Date()),
      metadata: { source: 'explicit_memory_command' },
    });
    return { success: true, data: { action: 'memory_stored', characters: content.length } };
  }

  private async execDevInspect(command: ExecutionCommand): Promise<SkillResult> {
    const start = Date.now();
    const target = String(command.target || '');
    if (!target) return { success: false, error_detail: this.error('context', true, 'A target file is required.', false) };

    const { content, error } = await this.fsSafety.readFile(target);
    if (error) {
      this.logDevAction('dev_inspect', target, 'failure', Date.now() - start, error);
      return { success: false, error_detail: this.error('permission', true, error, false) };
    }

    try {
      const risk = this.validator.analyzeRisk(target);
      const summary = await this.patchGen.summarizeFile(content, target);
      this.logDevAction('dev_inspect', target, 'success', Date.now() - start, `risk=${risk.level}; scopes=${risk.impactedScopes.length}`);
      const prefix = `Impact level: ${risk.level}\nImpacted scopes: ${risk.impactedScopes.length}\nReason: ${risk.reason}\n---\n`;
      return { success: true, data: { action: 'dev_inspect', target, result: prefix + summary } };
    } catch (error) {
      this.logDevAction('dev_inspect', target, 'failure', Date.now() - start, redactedError(error));
      return { success: false, error_detail: this.error('unknown', true, 'File analysis failed.', true) };
    }
  }

  private async execDevTest(command: ExecutionCommand): Promise<SkillResult> {
    const start = Date.now();
    const target = String(command.target || '').trim();
    let scopedCwd = process.cwd();
    let executable = this.npmExecutable();
    let args = ['run', 'test'];

    if (target) {
      const { root, pkg } = this.validator.getNearestPackageInfo(target);
      scopedCwd = root;
      if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
        executable = this.npxExecutable();
        args = ['jest', '--runInBand', target];
      } else if (!pkg.scripts?.test) {
        return { success: false, error_detail: this.error('context', false, `No test script is defined in scope ${path.basename(scopedCwd)}.`, false) };
      }
    }

    try {
      const { stdout } = await this.runFile(executable, args, scopedCwd, 60_000);
      this.logDevAction('dev_test', target || '.', 'success', Date.now() - start, `scope=${path.basename(scopedCwd)}`);
      return { success: true, data: { action: 'dev_test', target: target || '.', result: redactString(String(stdout), 2000) } };
    } catch (error: any) {
      const output = redactString(String(error?.stderr || error?.stdout || error?.message || 'Unknown test error'), 2000);
      this.logDevAction('dev_test', target || '.', 'failure', Date.now() - start, output);
      return { success: false, error_detail: this.error('unknown', true, `Tests failed in scope ${path.basename(scopedCwd)}.\n${output}`, true) };
    }
  }

  private async execDevFix(command: ExecutionCommand): Promise<SkillResult> {
    const ctx = this.context.getContext();
    const start = Date.now();

    if (ctx.awaiting_confirmation && ctx.dev_patch_content && ctx.dev_patch_target) {
      const target = ctx.dev_patch_target;
      const lockAcquired = await ExecutionMutex.acquire(15_000);
      if (!lockAcquired) return { success: false, error_detail: this.error('unknown', true, 'Another write transaction is active. Try again.', false) };

      try {
        const receipt = await this.fsSafety.applyPatch(target, ctx.dev_patch_content);
        if (!receipt.success) {
          this.logDevAction('dev_fix_apply', target, 'failure', Date.now() - start, 'atomic_write_failed');
          return { success: false, error_detail: this.error('permission', true, 'Patch could not be written atomically.', false) };
        }

        const semantic = await this.validator.validateProjectSemantic(target);
        if (!semantic.success) {
          this.fsSafety.rollback(target, receipt.backupPath, receipt.createdNewFile);
          this.logDevAction('dev_fix_apply', target, 'rollback', Date.now() - start, semantic.diff);
          return {
            success: false,
            error_detail: this.error('unknown', true, `Post-write validation failed in ${semantic.scope}; the patch was rolled back.\n${redactString(semantic.diff, 1000)}`, false),
          };
        }

        this.fsSafety.discardBackup(receipt.backupPath);
        const diff = await this.gitSafety.getGitDiff(target);
        this.context.updateContext({
          dev_patch_content: undefined,
          dev_patch_target: undefined,
          awaiting_confirmation: false,
          awaiting_followup: false,
        });
        this.logDevAction('dev_fix_apply', target, 'success', Date.now() - start, semantic.diff);
        return {
          success: true,
          data: {
            action: 'dev_fix',
            target,
            result: `Patch applied and validation completed.${diff ? `\n\nGit diff preview:\n${redactString(diff, 1500)}` : ''}`,
          },
        };
      } catch (error) {
        this.logDevAction('dev_fix_apply', ctx.dev_patch_target, 'failure', Date.now() - start, redactedError(error));
        return { success: false, error_detail: this.error('unknown', true, 'Patch transaction failed before completion.', true) };
      } finally {
        ExecutionMutex.release();
      }
    }

    const target = String(command.target || '').trim();
    if (!target) return { success: false, error_detail: this.error('context', true, 'A target path is required for a fix proposal.', false) };
    const { content, error } = await this.fsSafety.readFile(target);
    if (error) return { success: false, error_detail: this.error('permission', true, error, false) };

    const history = ctx.conversation_history.slice(-3).join('\n');
    const risk = this.validator.analyzeRisk(target);
    let proposed = '';
    let feedback = history;
    let lastValidationError = '';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        proposed = this.normalizePatch(await this.patchGen.proposeFix(content, feedback, target));
        if (!proposed.trim()) break;

        const ext = path.extname(target);
        const base = ext ? target.slice(0, -ext.length) : target;
        const tempTarget = `${base}.agentai-preview-${randomUUID()}${ext}`;
        const receipt = await this.fsSafety.applyPatch(tempTarget, proposed);
        if (!receipt.success) break;

        const syntax = await this.validator.validateFile(tempTarget);
        this.fsSafety.rollback(tempTarget, receipt.backupPath, true);
        if (syntax.success) {
          lastValidationError = '';
          break;
        }

        lastValidationError = syntax.stderr;
        feedback = `${history}\n\nPrevious proposal failed static validation:\n${redactString(syntax.stderr, 1500)}`;
      } catch (error) {
        lastValidationError = redactedError(error);
        feedback = `${history}\n\nPrevious proposal failed structurally:\n${lastValidationError}`;
      }
    }

    if (!proposed || lastValidationError) {
      this.logDevAction('dev_fix_preview', target, 'failure', Date.now() - start, lastValidationError || 'proposal_empty');
      return { success: false, error_detail: this.error('unknown', true, `No validated patch proposal was produced. ${redactString(lastValidationError, 1000)}`, false) };
    }

    this.context.updateContext({
      dev_patch_target: target,
      dev_patch_content: proposed,
      awaiting_confirmation: true,
      awaiting_followup: true,
    });
    this.context.setLastAction('dev_fix');
    this.context.setState('AWAITING_CONFIRMATION');
    this.logDevAction('dev_fix_preview', target, 'success', Date.now() - start, `risk=${risk.level}; scopes=${risk.impactedScopes.length}`);

    return {
      success: true,
      data: {
        action: 'dev_fix_preview',
        target,
        result: `Validated proposal only; no file has been modified.\nImpact: ${risk.level} (${risk.reason})\n\n${proposed.slice(0, 800)}${proposed.length > 800 ? '\n…' : ''}`,
      },
      requires_followup: true,
      suggested_actions: ['Yes', 'Cancel'],
    };
  }

  private normalizePatch(value: string): string {
    const trimmed = value.trim();
    const fenced = trimmed.match(/^```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)\n```$/);
    return fenced ? fenced[1] : value;
  }

  private applicationCandidates(app: string): string[] {
    const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
    return APPLICATIONS[app]?.[platform] || [];
  }

  private async launchFirst(candidates: string[], args: string[]): Promise<void> {
    let lastError: unknown = new Error('No launch candidate succeeded');
    for (const executable of candidates) {
      try {
        await this.spawnDetached(executable, args);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private spawnDetached(executable: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
      const onError = (error: Error): void => reject(error);
      child.once('error', onError);
      child.once('spawn', () => {
        child.removeListener('error', onError);
        child.unref();
        resolve();
      });
    });
  }

  private async runFile(executable: string, args: string[], cwd: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
    const result = await execFileAsync(executable, args, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, npm_config_yes: 'false' },
    });
    return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
  }

  private isSafeUrl(raw: string): boolean {
    try {
      const url = new URL(raw);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  private error(type: ErrorResponse['type'], recoverable: boolean, user_message: string, retry_suggested: boolean): ErrorResponse {
    return { type, recoverable, user_message: redactString(user_message, 3000), retry_suggested };
  }

  private confirmationMessage(lang: 'ar' | 'tr' | 'en'): string {
    return lang === 'ar' ? 'هذه العملية تحتاج موافقة صريحة قبل التنفيذ.' : lang === 'tr' ? 'Bu işlem yürütülmeden önce açık onay gerektirir.' : 'This operation requires explicit approval before execution.';
  }

  private confirmKeyword(lang: 'ar' | 'tr' | 'en'): string { return lang === 'ar' ? 'نعم' : lang === 'tr' ? 'Evet' : 'Yes'; }
  private cancelKeyword(lang: 'ar' | 'tr' | 'en'): string { return lang === 'ar' ? 'إلغاء' : lang === 'tr' ? 'İptal' : 'Cancel'; }
  private npmExecutable(): string { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }
  private npxExecutable(): string { return process.platform === 'win32' ? 'npx.cmd' : 'npx'; }

  private async searchMulti(query: string): Promise<Array<{ title: string; url: string; snippet: string; source: string }>> {
    const settled = await Promise.allSettled([this.ddg(query), this.bing(query)]);
    const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];
    for (const item of settled) if (item.status === 'fulfilled') results.push(...item.value);
    return results;
  }

  private async ddg(query: string): Promise<Array<{ title: string; url: string; snippet: string; source: string }>> {
    const requestUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(requestUrl, { headers: { 'User-Agent': 'AgentAI/2.0' }, timeout: 10_000, maxContentLength: 2_000_000 });
    const $ = load(response.data);
    const out: Array<{ title: string; url: string; snippet: string; source: string }> = [];
    $('.result').each((_, element) => {
      const anchor = $(element).find('.result__title a');
      const title = anchor.text().trim();
      const href = anchor.attr('href') || '';
      const snippet = $(element).find('.result__snippet').text().trim();
      if (!title || !href) return;
      try {
        const normalized = new URL(href, 'https://duckduckgo.com').toString();
        if (this.isSafeUrl(normalized)) out.push({ title, url: normalized, snippet, source: 'DuckDuckGo' });
      } catch {}
    });
    return out.slice(0, 5);
  }

  private async bing(query: string): Promise<Array<{ title: string; url: string; snippet: string; source: string }>> {
    const requestUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(requestUrl, { headers: { 'User-Agent': 'AgentAI/2.0' }, timeout: 10_000, maxContentLength: 2_000_000 });
    const $ = load(response.data);
    const out: Array<{ title: string; url: string; snippet: string; source: string }> = [];
    $('#b_results li.b_algo').each((_, element) => {
      const anchor = $(element).find('h2 a');
      const title = anchor.text().trim();
      const href = anchor.attr('href') || '';
      const snippet = $(element).find('.b_caption p').text().trim();
      if (title && this.isSafeUrl(href)) out.push({ title, url: href, snippet, source: 'Bing' });
    });
    return out.slice(0, 5);
  }

  private async searchYouTube(query: string): Promise<Array<{ title: string; url: string }>> {
    const requestUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await axios.get(requestUrl, { headers: { 'User-Agent': 'AgentAI/2.0' }, timeout: 10_000, maxContentLength: 2_000_000 });
    const $ = load(response.data);
    const out: Array<{ title: string; url: string }> = [];
    $('a#video-title').each((index, element) => {
      if (index >= 5) return false;
      const title = $(element).text().trim();
      const href = $(element).attr('href') || '';
      try {
        const url = new URL(href, 'https://www.youtube.com').toString();
        if (title && this.isSafeUrl(url)) out.push({ title, url });
      } catch {}
      return undefined;
    });
    return out;
  }
}
