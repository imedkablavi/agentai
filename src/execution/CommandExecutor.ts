import { ExecutionCommand, SkillResult, ConversationContext, ErrorResponse } from '../types';
import { promisify } from 'util';
import { exec } from 'child_process';
import axios from 'axios';
import { load } from 'cheerio';
import { formatISO } from 'date-fns';
import { MemoryManager } from '../memory/MemoryManager';
import { ContextManager } from '../context/ContextManager';
import { FileSystemSafety } from './FileSystemSafety';
import { PatchGenerator } from '../reasoning/PatchGenerator';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationEngine } from './ValidationEngine';
import { GitSafetyEngine, ExecutionMutex } from './GitSafetyEngine';

const execAsync = promisify(exec);

export class CommandExecutor {
  private fsSafety: FileSystemSafety;
  private patchGen: PatchGenerator;
  private validator: ValidationEngine;
  private gitSafety: GitSafetyEngine;

  constructor(
    private memory: MemoryManager,
    private context: ContextManager
  ) {
    this.fsSafety = new FileSystemSafety();
    this.patchGen = new PatchGenerator();
    this.validator = new ValidationEngine();
    this.gitSafety = new GitSafetyEngine();
  }

  private logDevAction(action: string, target: string, result: 'success' | 'failure' | 'rollback', duration: number, errorDetails?: string) {
    try {
      const logLine = `[${new Date().toISOString()}] DEV_ACTION JSON: ${JSON.stringify({
        action, target, result, durationMs: duration, error: errorDetails || null
      })}\n`;
      fs.appendFileSync(path.posix.join(process.cwd(), '.agent_dev.log'), logLine, 'utf8');
    } catch {}
  }

  async execute(command: ExecutionCommand, intentLanguage: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    try {
      if (command.requires_confirmation && !this.context.getContext().awaiting_confirmation) {
        this.context.setState('AWAITING_CONFIRMATION');
        this.context.updateContext({ awaiting_confirmation: true, awaiting_followup: true });
        return {
          success: false,
          error_detail: this.error('permission', true, this.confirmationMessage(intentLanguage), true),
          requires_followup: true,
          suggested_actions: [this.confirmKeyword(intentLanguage)]
        };
      }

      this.context.setState('EXECUTING');

      switch (command.action) {
        case 'open_application':
          return await this.execOpenApp(command);
        case 'close_application':
          return await this.execCloseApp(command);
        case 'open_file':
          return await this.execOpenFile(command, intentLanguage);
        case 'read_file':
          return await this.execReadFile(command, intentLanguage);
        case 'summarize_logs':
          return await this.execSummarizeLogs(command, intentLanguage);
        case 'web_search':
          return await this.execWebSearch(command);
        case 'youtube_search':
          return await this.execYouTubeSearch(command);
        case 'system_shutdown':
        case 'system_restart':
        case 'system_lock':
        case 'system_sleep':
          return await this.execSystem(command);
        case 'select_item':
          return await this.execSelection(command);
        case 'store_memory':
          return await this.execStoreMemory(command);
        case 'dev_inspect':
          return await this.execDevInspect(command, intentLanguage);
        case 'dev_test':
          return await this.execDevTest(command, intentLanguage);
        case 'dev_fix':
          return await this.execDevFix(command, intentLanguage);
        default:
          return { success: false, error_detail: this.error('unknown', true, this.fallbackError(intentLanguage), true) };
      }
    } catch (e: any) {
      this.context.setState('ERROR');
      return { success: false, error_detail: this.error('unknown', true, e?.message || 'Error', true) };
    } finally {
      const current = this.context.getContext();
      if (!current.awaiting_confirmation || !current.dev_patch_content || !current.dev_patch_target) {
        this.context.updateContext({ awaiting_confirmation: false });
      }
      this.context.setState('IDLE');
    }
  }

  private async execOpenApp(command: ExecutionCommand): Promise<SkillResult> {
    const app = command.target || command.params?.application;
    if (!app) return { success: false, error_detail: this.error('context', true, 'Application not specified', false) };
    try {
      const platform = process.platform;
      if (platform === 'win32') await execAsync(`start "" "${app}"`);
      else if (platform === 'darwin') await execAsync(`open "${app}"`);
      else await execAsync(app);
      return { success: true, data: { application: app, action: 'opened' }, suggested_actions: [`Close ${app}`] };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'Failed to open application', true) };
    }
  }

  private async execOpenFile(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const target = command.target || '';
    if (!target) {
      return { success: false, error_detail: this.error('context', true, this.msg(lang, 'file_not_specified'), false) };
    }

    const { content, error } = await this.fsSafety.readFile(target);
    if (error) {
      return { success: false, error_detail: this.error('permission', true, error, false) };
    }

    return {
      success: true,
      data: { action: 'open_file', target, preview: content.slice(0, 1200) }
    };
  }

  private async execReadFile(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const target = command.target || '';
    if (!target) {
      return { success: false, error_detail: this.error('context', true, this.msg(lang, 'file_not_specified'), false) };
    }

    const { content, error } = await this.fsSafety.readFile(target);
    if (error) {
      return { success: false, error_detail: this.error('permission', true, error, false) };
    }

    return {
      success: true,
      data: { action: 'read_file', target, result: content.slice(0, 4000) }
    };
  }

  private async execSummarizeLogs(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const explicitPath = command.target || '';
    const candidates = explicitPath
      ? [explicitPath]
      : ['.agent_dev.log', '.agent_action.log', 'logs/latest.log', 'logs/error.log'];

    for (const target of candidates) {
      const { content, error } = await this.fsSafety.readFile(target);
      if (error) continue;

      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      const tail = lines.slice(-50);
      const errorCount = tail.filter(l => /error|failed|failure|exception|خطأ|فشل/i.test(l)).length;
      const warnCount = tail.filter(l => /warn|warning|تحذير/i.test(l)).length;
      const summary =
        `${this.msg(lang, 'log_file')}: ${target}\n` +
        `${this.msg(lang, 'log_lines_scanned')}: ${tail.length}\n` +
        `${this.msg(lang, 'log_errors')}: ${errorCount}\n` +
        `${this.msg(lang, 'log_warnings')}: ${warnCount}\n` +
        `${this.msg(lang, 'log_latest_events')}:\n${tail.slice(-10).join('\n')}`;

      return { success: true, data: { action: 'summarize_logs', target, result: summary } };
    }

    return {
      success: false,
      error_detail: this.error('context', true, this.msg(lang, 'no_safe_log_file'), false)
    };
  }

  private async execCloseApp(command: ExecutionCommand): Promise<SkillResult> {
    const app = command.target || command.params?.application;
    const map: Record<string, string> = {
      chrome: 'chrome.exe', firefox: 'firefox.exe', word: 'WINWORD.EXE', excel: 'EXCEL.EXE',
      notepad: 'notepad.exe', calculator: 'calc.exe', spotify: 'Spotify.exe', discord: 'Discord.exe', telegram: 'Telegram.exe'
    };
    const proc = map[(app || '').toLowerCase()] || app;
    if (!proc) return { success: false, error_detail: this.error('context', true, 'Application not specified', false) };
    try {
      await execAsync(`taskkill /F /IM "${proc}"`);
      return { success: true, data: { application: app, action: 'closed' } };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'Failed to close application', true) };
    }
  }

  private async execWebSearch(command: ExecutionCommand): Promise<SkillResult> {
    const query = command.params?.query;
    if (!query) return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
    const results = await this.searchMulti(query);
    const items = results.slice(0, 5).map((r, i) => ({ id: String(i + 1), label: r.title, data: r }));
    this.context.setSelectionContext({ type: 'search_results', items, expires_at: formatISO(new Date(Date.now() + 5 * 60 * 1000)) });
    this.context.setState('AWAITING_SELECTION');
    return { success: true, data: { query, results }, requires_followup: true, suggested_actions: items.map(i => `اختر ${i.id}: ${i.label}`) };
  }

  private async execYouTubeSearch(command: ExecutionCommand): Promise<SkillResult> {
    const query = command.params?.query;
    if (!query) return { success: false, error_detail: this.error('context', true, 'Missing query', false) };
    const videos = await this.searchYouTube(query);
    const items = videos.slice(0, 5).map((v, i) => ({ id: String(i + 1), label: v.title, data: v }));
    this.context.setSelectionContext({ type: 'videos', items, expires_at: formatISO(new Date(Date.now() + 5 * 60 * 1000)) });
    this.context.setState('AWAITING_SELECTION');
    return { success: true, data: { query, videos }, requires_followup: true, suggested_actions: items.map(i => `اختر ${i.id}: ${i.label}`) };
  }

  private async execSystem(command: ExecutionCommand): Promise<SkillResult> {
    const map: Record<string, string> = {
      system_shutdown: 'shutdown /s /t 0',
      system_restart: 'shutdown /r /t 0',
      system_lock: 'rundll32.exe user32.dll,LockWorkStation',
      system_sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
    };
    const cmd = map[command.action];
    try {
      await execAsync(cmd);
      return { success: true, data: { command: command.action } };
    } catch {
      return { success: false, error_detail: this.error('permission', true, 'System command failed', true) };
    }
  }

  private async execSelection(command: ExecutionCommand): Promise<SkillResult> {
    const index = Number(command.params?.index || 0);
    const ctx = this.context.getContext();
    const sc = ctx.selection_context;
    if (!sc || !sc.items || sc.items.length === 0) {
      return { success: false, error_detail: this.error('context', true, 'No active selection context', false) };
    }
    if (index < 1 || index > sc.items.length) {
      return { success: false, error_detail: this.error('context', true, 'Invalid selection number', false) };
    }
    const item = sc.items[index - 1].data;
    const url = item.url;
    if (!url) return { success: false, error_detail: this.error('context', true, 'Item has no URL', false) };
    try {
      const platform = process.platform;
      if (platform === 'win32') await execAsync(`start "" "${url}"`);
      else if (platform === 'darwin') await execAsync(`open "${url}"`);
      else await execAsync(`xdg-open "${url}"`);
      this.context.setSelectionContext(null);
      this.context.setState('IDLE');
      return { success: true, data: { action: 'opened', url, title: item.title } };
    } catch {
      return { success: false, error_detail: this.error('network', true, 'Failed to open URL', true) };
    }
  }

  private async execStoreMemory(command: ExecutionCommand): Promise<SkillResult> {
    const content = command.params?.content;
    if (!content) return { success: false, error_detail: this.error('context', true, 'No memory content', false) };
    // Store only via MemoryManager rules
    this.memory.addLongTermMemory({
      type: 'pattern',
      description: content,
      frequency: 1,
      last_occurrence: formatISO(new Date()),
      metadata: {}
    });
    return { success: true, data: { action: 'memory_stored', content } };
  }

  private async execDevInspect(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const start = Date.now();
    const target = command.target || '';
    if (!target) {
      this.logDevAction('dev_inspect', target, 'failure', Date.now() - start, 'Missing target path');
      return { success: false, error_detail: this.error('context', true, this.msg(lang, 'file_path_not_specified'), false) };
    }

    const { content, error } = await this.fsSafety.readFile(target);
    if (error) {
      this.logDevAction('dev_inspect', target, 'failure', Date.now() - start, error);
      return { success: false, error_detail: this.error('permission', true, error, false) };
    }

    try {
      const riskInfo = this.validator.analyzeRisk(target);
      const riskPrefix = `**${this.msg(lang, 'impact_level')}:** ${this.riskLevelText(riskInfo.level, lang)}
**${this.msg(lang, 'system_dependency')}:** ${this.msg(lang, 'file_impacts_packages').replace('{count}', String(riskInfo.impactedScopes.length))}
**${this.msg(lang, 'scope_reason')}:** ${riskInfo.reason}
---\n`;

      const summary = await this.patchGen.summarizeFile(content, target);
      this.logDevAction('dev_inspect', target, 'success', Date.now() - start, `Risk: ${riskInfo.level}, Dependencies: ${riskInfo.impactedScopes.length}`);
      return { success: true, data: { action: 'dev_inspect', target, result: riskPrefix + summary } };
    } catch (err: any) {
      this.logDevAction('dev_inspect', target, 'failure', Date.now() - start, err.message);
      return { success: false, error_detail: this.error('network', true, this.msg(lang, 'file_analysis_failed'), true) };
    }
  }

  private async execDevTest(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const start = Date.now();
    let target = command.target || '';
    
    // Nearest package resolution
    let scopedCwd = process.cwd();
    let testCmdStr = 'npm run test';
    
    if (target && target !== 'test' && target !== 'الاختبارات') {
      const { root, pkg } = this.validator.getNearestPackageInfo(target);
      scopedCwd = root;
      // If we provided a specific file, try to run jest targeted at it if jest is available
      if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
        testCmdStr = `npx jest "${target}"`;
      } else {
        testCmdStr = pkg.scripts?.test ? 'npm run test' : 'echo "No test script defined" && exit 1';
      }
    }

    try {
      const { stdout, stderr } = await execAsync(testCmdStr, { timeout: 60000, cwd: scopedCwd });
      this.logDevAction('dev_test', target || 'project', 'success', Date.now() - start, `Scope: ${scopedCwd}`);
      return { success: true, data: { action: 'dev_test', target: target || scopedCwd, result: stdout.substring(0, 1000) } };
    } catch (e: any) {
      const output = e.stderr || e.stdout || e.message || 'Unknown test error';
      this.logDevAction('dev_test', target || 'project', 'failure', Date.now() - start, output);
      return {
        success: false,
        error_detail: this.error('unknown', true, `${this.msg(lang, 'tests_failed_scope').replace('{scope}', scopedCwd)}\n${output.substring(0, 1000)}`, true)
      };
    }
  }

  private async execDevFix(command: ExecutionCommand, lang: 'ar' | 'tr' | 'en'): Promise<SkillResult> {
    const ctx = this.context.getContext();
    const start = Date.now();

    if (ctx.awaiting_confirmation && ctx.dev_patch_content && ctx.dev_patch_target) {
      const targetPath = ctx.dev_patch_target;
      
      const lockAcquired = await ExecutionMutex.acquire(15000);
      if (!lockAcquired) {
         return { success: false, error_detail: this.error('unknown', true, this.msg(lang, 'race_condition'), false) };
      }

      try {
        // 1. Git Atomic Checkpoint
        const gitCheckpoint = await this.gitSafety.createSafeCheckpoint();

        // 2. Apply via FileSystemSafety (handles backups natively)
        const { success, backupPath } = await this.fsSafety.applyPatch(targetPath, ctx.dev_patch_content);

        if (success) {
          // Validation Hook (Semantic)
          const semanticCheck = await this.validator.validateProjectSemantic(targetPath);

          if (!semanticCheck.success) {
             // Atomic Rollback on Semantic Failure
             if (gitCheckpoint.success) await this.gitSafety.restoreCheckpoint(gitCheckpoint.hash!);
             else if (backupPath) this.fsSafety.rollback(targetPath, backupPath);

             this.logDevAction('dev_fix_apply', targetPath, 'rollback', Date.now() - start, semanticCheck.diff);
             return {
               success: false,
               error_detail: this.error('unknown', true, this.msg(lang, 'semantic_validation_failed').replace('{scope}', semanticCheck.scope).replace('{diff}', semanticCheck.diff.substring(0, 300)), false)
             };
          }

          this.context.updateContext({ dev_patch_content: undefined, dev_patch_target: undefined, awaiting_confirmation: false });
          this.context.setLastAction('');

          let resultMsg = this.msg(lang, 'patch_applied_success');
          const runDiff = await this.gitSafety.getGitDiff(targetPath);
          if (runDiff) resultMsg += `\n\n**Git Diff:**\n\`\`\`diff\n${runDiff.substring(0, 300)}...\n\`\`\``;

          this.logDevAction('dev_fix_apply', targetPath, 'success', Date.now() - start, semanticCheck.diff);
          return { success: true, data: { action: 'dev_fix', target: targetPath, result: resultMsg } };
        }

        // Rollback via Git or FS
        if (gitCheckpoint.success) await this.gitSafety.restoreCheckpoint(gitCheckpoint.hash!);
        else if (backupPath) this.fsSafety.rollback(targetPath, backupPath);

        this.logDevAction('dev_fix_apply', targetPath, 'failure', Date.now() - start, 'FileSystem write error');
        return { success: false, error_detail: this.error('permission', true, this.msg(lang, 'save_failed_rolled_back'), false) };
      } finally {
        ExecutionMutex.release();
      }
    }

    const target = command.target || '';
    if (!target) return { success: false, error_detail: this.error('context', true, this.msg(lang, 'path_not_specified'), false) };

    const { content, error } = await this.fsSafety.readFile(target);
    if (error) return { success: false, error_detail: this.error('permission', true, error, false) };

    const errorContextHistory = ctx.conversation_history.slice(-3).join('\n');
    let newContent = '';
    let attempt = 0;
    const maxAttempts = 3;
    let fallbackSyntaxError = '';
    let contextMemory = errorContextHistory;
    
    // Analyze Risk
    const riskAnalysis = this.validator.analyzeRisk(target);

    // Multi-Step Healing Output loop
    while (attempt < maxAttempts) {
      try {
        newContent = await this.patchGen.proposeFix(content, contextMemory, target);
        
        const tempPath = target + `.temp-${Date.now()}`;
        const tempSuccess = await this.fsSafety.applyPatch(tempPath, newContent);
        if (tempSuccess.success) {
         const syntaxValid = await this.validator.validateFile(tempPath);
         if (tempSuccess.backupPath) {
           this.fsSafety.rollback(tempPath, tempSuccess.backupPath);
         } else {
           const fullTempPath = path.resolve(process.cwd(), tempPath);
           if (fs.existsSync(fullTempPath)) fs.unlinkSync(fullTempPath);
         }
           
           if (syntaxValid.success) {
             fallbackSyntaxError = '';
             break;
           } else {
             // Memory iteration
             contextMemory = `${errorContextHistory}\n\n[المحاولة السابقة فشلت بسبب الأخطاء التالية:\n${syntaxValid.stderr}\nقم بإصلاحها فوراً.]`;
             fallbackSyntaxError = syntaxValid.stderr;
             attempt++;
           }
        } else {
           break;
        }
      } catch (e: any) {
         contextMemory = `${errorContextHistory}\n\n[المحاولة السابقة فشلت هيكلياً:\n${e.message}]`;
         fallbackSyntaxError = e.message;
         attempt++;
      }
    }

    if (attempt >= maxAttempts || !newContent) {
      this.logDevAction('dev_fix_loop', target, 'failure', Date.now() - start, 'Max iterations reached');
      return { success: false, error_detail: this.error('unknown', true, `${this.msg(lang, 'fix_failed_structural')}\n${fallbackSyntaxError}`, false) };
    }

    if (riskAnalysis.level === 'high' && attempt > 0) {
       this.logDevAction('dev_fix_risk', target, 'failure', Date.now() - start, 'High risk loop aborted');
       return { success: false, error_detail: this.error('permission', true, this.msg(lang, 'high_risk_failed').replace('{reason}', riskAnalysis.reason), false) };
    }

    // Confidence Calculation
    let confidenceScore = 1.0;
    if (riskAnalysis.level === 'high') confidenceScore -= 0.3;
    if (riskAnalysis.level === 'medium') confidenceScore -= 0.1;
    confidenceScore -= (attempt * 0.2);
    confidenceScore = Math.max(0, parseFloat(confidenceScore.toFixed(2)));

    this.context.updateContext({
      dev_patch_target: target,
      dev_patch_content: newContent,
      awaiting_confirmation: true,
      awaiting_followup: true
    });
    this.context.setLastAction('dev_fix');
    this.context.setState('AWAITING_CONFIRMATION');

    this.logDevAction('dev_fix_preview', target, 'success', Date.now() - start, `Risk: ${riskAnalysis.level}, Attempts: ${attempt+1}, Confidence: ${confidenceScore}, Impacted: ${riskAnalysis.impactedScopes.length}`);
    
    let messagePrefix = `\n**${this.msg(lang, 'confidence_ratio')}:** ${this.confidenceLevelText(confidenceScore, lang)} (${confidenceScore * 100}%)\n`;
    messagePrefix += `**${this.msg(lang, 'impact_scope')}:** ${this.msg(lang, 'linked_packages').replace('{count}', String(riskAnalysis.impactedScopes.length))}\n`;
    
    if (confidenceScore < 0.5) {
       messagePrefix += `⚠️ **${this.msg(lang, 'system_warning')}:** ${this.msg(lang, 'low_confidence_warning')}\n`;
    } else if (riskAnalysis.level === 'high') {
       messagePrefix += `⚠️ ${this.msg(lang, 'alert')}: ${riskAnalysis.reason}\n`;
    }

    messagePrefix += `\n\`\`\`\n`;
    
    return { 
      success: true, 
      data: { action: 'dev_fix_preview', target, result: messagePrefix + newContent.substring(0, 500) + "\n...```" },
      requires_followup: true,
      suggested_actions: [this.confirmKeyword(lang), this.msg(lang, 'cancel')]
    };
  }

  private error(type: ErrorResponse['type'], recoverable: boolean, user_message: string, retry_suggested: boolean): ErrorResponse {
    return { type, recoverable, user_message, retry_suggested };
  }

  private confirmationMessage(lang: 'ar' | 'tr' | 'en'): string {
    return lang === 'ar' ? 'هل تريد التأكيد؟' : lang === 'tr' ? 'Onaylıyor musun?' : 'Do you confirm?';
  }

  private confirmKeyword(lang: 'ar' | 'tr' | 'en'): string {
    return lang === 'ar' ? 'نعم' : lang === 'tr' ? 'Evet' : 'Yes';
  }

  private fallbackError(lang: 'ar' | 'tr' | 'en'): string {
    return lang === 'ar' ? 'حدث خطأ في التنفيذ.' : lang === 'tr' ? 'Yürütme sırasında hata oluştu.' : 'Execution error occurred.';
  }

  private riskLevelText(level: 'low' | 'medium' | 'high', lang: 'ar' | 'tr' | 'en'): string {
    if (lang === 'ar') return level === 'high' ? 'عالي 🔴' : level === 'medium' ? 'متوسط 🟡' : 'منخفض 🟢';
    if (lang === 'tr') return level === 'high' ? 'Yüksek 🔴' : level === 'medium' ? 'Orta 🟡' : 'Düşük 🟢';
    return level === 'high' ? 'High 🔴' : level === 'medium' ? 'Medium 🟡' : 'Low 🟢';
  }

  private confidenceLevelText(score: number, lang: 'ar' | 'tr' | 'en'): string {
    const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    if (lang === 'ar') return level === 'high' ? 'عالية 🟢' : level === 'medium' ? 'متوسطة 🟡' : 'منخفضة 🔴';
    if (lang === 'tr') return level === 'high' ? 'Yüksek 🟢' : level === 'medium' ? 'Orta 🟡' : 'Düşük 🔴';
    return level === 'high' ? 'High 🟢' : level === 'medium' ? 'Medium 🟡' : 'Low 🔴';
  }

  private msg(lang: 'ar' | 'tr' | 'en', key: string): string {
    const messages: Record<string, Record<string, string>> = {
      ar: {
        file_not_specified: 'لم يتم تحديد الملف.',
        log_file: 'الملف',
        log_lines_scanned: 'آخر السطور المفحوصة',
        log_errors: 'أخطاء',
        log_warnings: 'تحذيرات',
        log_latest_events: 'آخر أحداث',
        no_safe_log_file: 'لا يوجد ملف سجل قابل للقراءة ضمن المسارات الآمنة.',
        file_path_not_specified: 'لم يتم تحديد مسار الملف.',
        impact_level: 'مستوى التأثير',
        system_dependency: 'التبعية النظامية',
        file_impacts_packages: 'هذا الملف يؤثر على {count} حزمة مترابطة.',
        scope_reason: 'السبب النطاقي',
        file_analysis_failed: 'فشل تحليل الملف.',
        tests_failed_scope: 'فشل الاختبارات في النطاق ({scope}).',
        race_condition: 'هناك عملية أخرى قيد التنفيذ (Race Condition). يرجى المحاولة لاحقاً.',
        semantic_validation_failed: 'فشل التحقق الشامل بعد التطبيق أو تعارضت الاعتماديات بنطاق ({scope}).\nتم التراجع كلياً للحفاظ على استقرارية المستودع.\n\nتفاصيل الخطأ:\n{diff}',
        patch_applied_success: 'تم التطبيق بنجاح ومصادقة الاعتماديات بأمان تام.',
        save_failed_rolled_back: 'فشل الحفظ بسبب الأمان. تم التراجع.',
        path_not_specified: 'لم يتم تحديد المسار.',
        fix_failed_structural: 'تحذير: لقد حاولت الأداة الإصلاح ولكن استمرت الأخطاء الهيكلية:',
        high_risk_failed: 'تعديل عالي المخاطر ({reason}) استمر في الفشل. يرجى المراجعة يدوياً.',
        confidence_ratio: 'نسبة الموثوقية',
        impact_scope: 'نطاق التأثير',
        linked_packages: '{count} حزمة مترابطة.',
        system_warning: 'تحذير النظام',
        low_confidence_warning: 'الموثوقية منخفضة في هذا الحل المقترح. قد يؤدي لتكسير اجزاء أخرى. ينصح بالمراجعة اليدوية.',
        alert: 'تنبيه',
        cancel: 'إلغاء'
      },
      tr: {
        file_not_specified: 'Dosya belirtilmedi.',
        log_file: 'Dosya',
        log_lines_scanned: 'İncelenen son satırlar',
        log_errors: 'Hatalar',
        log_warnings: 'Uyarılar',
        log_latest_events: 'Son olaylar',
        no_safe_log_file: 'Güvenli yollar içinde okunabilir bir log dosyası yok.',
        file_path_not_specified: 'Dosya yolu belirtilmedi.',
        impact_level: 'Etki seviyesi',
        system_dependency: 'Sistem bağımlılığı',
        file_impacts_packages: 'Bu dosya {count} bağlı paketi etkiliyor.',
        scope_reason: 'Kapsam nedeni',
        file_analysis_failed: 'Dosya analizi başarısız oldu.',
        tests_failed_scope: 'Testler bu kapsamda başarısız oldu ({scope}).',
        race_condition: 'Başka bir işlem çalışıyor (Race Condition). Lütfen daha sonra tekrar deneyin.',
        semantic_validation_failed: 'Uygulama sonrası kapsamlı doğrulama başarısız oldu veya bağımlılıklar çakıştı ({scope}).\nDepo kararlılığını korumak için tamamen geri alındı.\n\nHata ayrıntıları:\n{diff}',
        patch_applied_success: 'Yama başarıyla uygulandı ve bağımlılıklar güvenle doğrulandı.',
        save_failed_rolled_back: 'Güvenlik nedeniyle kaydetme başarısız oldu. Geri alındı.',
        path_not_specified: 'Yol belirtilmedi.',
        fix_failed_structural: 'Uyarı: Araç düzeltmeyi denedi ancak yapısal hatalar devam etti:',
        high_risk_failed: 'Yüksek riskli düzenleme ({reason}) başarısız olmaya devam etti. Lütfen manuel inceleyin.',
        confidence_ratio: 'Güven oranı',
        impact_scope: 'Etki kapsamı',
        linked_packages: '{count} bağlı paket.',
        system_warning: 'Sistem uyarısı',
        low_confidence_warning: 'Bu çözüm önerisinde güven düşüktür. Diğer parçaları bozabilir. Manuel inceleme önerilir.',
        alert: 'Uyarı',
        cancel: 'İptal'
      },
      en: {
        file_not_specified: 'File not specified.',
        log_file: 'File',
        log_lines_scanned: 'Recent lines scanned',
        log_errors: 'Errors',
        log_warnings: 'Warnings',
        log_latest_events: 'Latest events',
        no_safe_log_file: 'No readable log file found in safe paths.',
        file_path_not_specified: 'File path not specified.',
        impact_level: 'Impact level',
        system_dependency: 'System dependency',
        file_impacts_packages: 'This file affects {count} linked packages.',
        scope_reason: 'Scope reason',
        file_analysis_failed: 'File analysis failed.',
        tests_failed_scope: 'Tests failed in scope ({scope}).',
        race_condition: 'Another operation is in progress (race condition). Please try again later.',
        semantic_validation_failed: 'Comprehensive validation failed after apply, or dependencies conflicted in scope ({scope}).\nRolled back fully to keep repository stability.\n\nError details:\n{diff}',
        patch_applied_success: 'Patch applied successfully and dependencies validated safely.',
        save_failed_rolled_back: 'Save failed due to safety checks. Rolled back.',
        path_not_specified: 'Path not specified.',
        fix_failed_structural: 'Warning: the tool tried to fix but structural errors persisted:',
        high_risk_failed: 'High-risk edit ({reason}) kept failing. Please review manually.',
        confidence_ratio: 'Confidence ratio',
        impact_scope: 'Impact scope',
        linked_packages: '{count} linked packages.',
        system_warning: 'System warning',
        low_confidence_warning: 'Confidence is low in this proposed solution. It may break other parts. Manual review is recommended.',
        alert: 'Alert',
        cancel: 'Cancel'
      }
    };
    return messages[lang]?.[key] || messages.ar[key] || key;
  }

  private async searchMulti(query: string): Promise<Array<{ title: string; url: string; snippet: string; source: string }>> {
    const results: any[] = [];
    try {
      const ddg = await this.ddg(query);
      const bing = await this.bing(query);
      results.push(...ddg, ...bing);
    } catch {}
    return results;
  }

  private async ddg(query: string): Promise<any[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const $ = load(res.data);
    const out: any[] = [];
    $('.result').each((_, el) => {
      const a = $(el).find('.result__title a');
      const s = $(el).find('.result__snippet');
      const title = a.text().trim();
      const href = a.attr('href') || '';
      const snippet = s.text().trim();
      if (title && href) out.push({ title, url: href, snippet, source: 'DuckDuckGo' });
    });
    return out.slice(0, 5);
  }

  private async bing(query: string): Promise<any[]> {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const $ = load(res.data);
    const out: any[] = [];
    $('#b_results li.b_algo').each((_, el) => {
      const a = $(el).find('h2 a');
      const cap = $(el).find('.b_caption p');
      const title = a.text().trim();
      const href = a.attr('href') || '';
      const snippet = cap.text().trim();
      if (title && href) out.push({ title, url: href, snippet, source: 'Bing' });
    });
    return out.slice(0, 5);
  }

  private async searchYouTube(query: string): Promise<Array<{ title: string; url: string; thumbnail?: string; channel?: string }>> {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const $ = load(res.data);
    const out: any[] = [];
    $('a#video-title').each((i, el) => {
      if (i >= 5) return false;
      const title = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (title && href) out.push({ title, url: `https://www.youtube.com${href}` });
      return undefined;
    });
    return out;
  }
}
