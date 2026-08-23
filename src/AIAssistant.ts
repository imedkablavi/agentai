import {
  Intent,
  SkillResult,
  ConversationContext,
  ExecutionCommand,
  PendingExecution,
  MemoryPrivacyConfig,
  PreferenceMemory,
} from './types';
import { MemoryManager } from './memory/MemoryManager';
import { ContextManager } from './context/ContextManager';
import { IntentEngine } from './intent/IntentEngine';
import { SkillRouter } from './skills/SkillRouter';
import { ResponseGenerator } from './response/ResponseGenerator';
import { formatISO } from 'date-fns';
import { randomUUID } from 'crypto';
import { CommandExecutor } from './execution/CommandExecutor';
import { SchedulerManager } from './scheduler/SchedulerManager';
import { TaskRunner } from './scheduler/TaskRunner';
import { ScheduledTask } from './scheduler/types';
import { LLMReasoner } from './reasoning/LLMReasoner';
import { ExecutionPolicy } from './security/ExecutionPolicy';
import { AuditTrail } from './security/AuditTrail';

export interface AssistantOutput {
  response: string;
  voiceResponse: string;
  context: ConversationContext;
  requiresFollowUp: boolean;
  suggestedActions: string[];
}

export class AIAssistant {
  private readonly memoryManager: MemoryManager;
  private readonly contextManager: ContextManager;
  private readonly intentEngine: IntentEngine;
  private readonly skillRouter: SkillRouter;
  private readonly responseGenerator: ResponseGenerator;
  private readonly executor: CommandExecutor;
  private readonly scheduler: SchedulerManager;
  private readonly taskRunner: TaskRunner;
  private readonly llm: LLMReasoner;
  private readonly policy: ExecutionPolicy;
  private readonly audit: AuditTrail;

  constructor() {
    this.memoryManager = new MemoryManager();
    this.contextManager = new ContextManager();
    this.intentEngine = new IntentEngine();
    this.skillRouter = new SkillRouter();
    this.responseGenerator = new ResponseGenerator();
    this.policy = new ExecutionPolicy();
    this.audit = new AuditTrail();
    this.executor = new CommandExecutor(this.memoryManager, this.contextManager, this.audit);
    this.scheduler = new SchedulerManager();
    this.taskRunner = new TaskRunner(this.scheduler, this);
    this.llm = new LLMReasoner();
    this.taskRunner.start(60);
  }

  async processInput(userInput: string): Promise<AssistantOutput> {
    const input = userInput.trim();
    if (!input) return this.message('Input is empty.', false, []);

    try {
      const pending = await this.handlePendingApproval(input);
      if (pending) return pending;

      const context = this.contextManager.getContext();
      let intent = await this.llm.infer(input);
      if (!intent) intent = await this.intentEngine.classify(input, context);
      intent = await this.intentEngine.extractEntities(input, intent);
      intent.confidence = this.intentEngine.calculateConfidence(intent, context);

      this.memoryManager.updateShortTermMemory({
        last_intent: intent.name,
        last_query: input,
        last_application: intent.entities.application,
        last_topic: intent.entities.query,
      });

      if (intent.name === 'schedule_task') return this.previewSchedule(intent, context);
      if (intent.name === 'stop_tasks') {
        this.scheduler.disableAll();
        this.audit.record({ action: 'scheduler_disable_all', outcome: 'success', mode: 'interactive' });
        return this.message(this.localized(intent, 'تم إيقاف جميع المهام المجدولة.', 'Tüm zamanlanmış görevler durduruldu.', 'All scheduled tasks are disabled.'), false, []);
      }

      const skill = this.skillRouter.route(intent, context);
      if (!skill) {
        return this.message(
          this.localized(intent, 'الأمر غير واضح أو خارج النطاق المسموح. حدّد الهدف بوضوح.', 'Komut belirsiz veya izin verilen kapsamın dışında. Hedefi açıkça belirt.', 'The command is ambiguous or outside the allowed scope. Specify the target explicitly.'),
          false,
          [],
        );
      }

      const command = await skill.execute(intent, context);
      const decision = this.policy.evaluate(command, this.contextManager.getContext(), 'interactive');
      this.audit.record({
        action: command.action,
        target: command.target,
        outcome: decision.allowed ? (decision.requiresApproval ? 'approval_required' : 'allowed') : 'denied',
        mode: 'interactive',
        detail: { reason: decision.reason },
      });

      if (!decision.allowed) {
        return this.message(`Blocked by execution policy: ${decision.reason}`, false, []);
      }

      if (decision.requiresApproval) {
        return this.stageApproval(command, decision.preview, intent.language as 'ar' | 'tr' | 'en', decision.normalizedTarget);
      }

      const safeCommand = this.normalizeApprovedCommand(command, decision.normalizedTarget);
      const result = await this.executor.execute(safeCommand, intent.language as 'ar' | 'tr' | 'en');
      const output = this.renderResult(result, intent, skill.name, input);

      if (safeCommand.action === 'dev_fix' && result.success) {
        const staged = this.contextManager.getContext();
        if (staged.dev_patch_target && staged.dev_patch_content) {
          const applyCommand: ExecutionCommand = {
            action: 'dev_fix',
            target: staged.dev_patch_target,
            risk_level: 'medium',
            requires_confirmation: false,
          };
          const applyDecision = this.policy.evaluate(applyCommand, staged, 'interactive');
          if (applyDecision.allowed && applyDecision.requiresApproval) {
            this.stageApprovalContext(applyCommand, applyDecision.preview, applyDecision.normalizedTarget);
            this.audit.record({
              action: 'dev_fix',
              target: staged.dev_patch_target,
              outcome: 'approval_required',
              mode: 'interactive',
              detail: { phase: 'apply_staged_patch' },
            });
            return {
              ...output,
              context: this.contextManager.getContext(),
              requiresFollowUp: true,
              suggestedActions: this.approvalActions(intent.language as 'ar' | 'tr' | 'en'),
            };
          }
        }
      }

      return output;
    } catch (error) {
      this.audit.recordError('assistant_process_input', error);
      return this.message('An unexpected error occurred. The operation was not authorized automatically.', false, ['Try again']);
    }
  }

  public async runScheduledIntent(task: ScheduledTask): Promise<void> {
    if (!task.enabled) return;

    try {
      const context = task.context_snapshot as ConversationContext;
      let intent = await this.intentEngine.extractEntities(task.intent.raw_text, task.intent);
      intent.confidence = this.intentEngine.calculateConfidence(intent, context);
      const skill = this.skillRouter.route(intent, context);
      if (!skill) {
        this.audit.record({ action: 'scheduled_intent', outcome: 'denied', mode: 'scheduled', detail: { reason: 'No unambiguous skill route' } });
        return;
      }

      const command = await skill.execute(intent, context);
      const decision = this.policy.evaluate(command, context, 'scheduled');
      this.audit.record({
        action: command.action,
        target: command.target,
        outcome: decision.allowed ? 'allowed' : 'denied',
        mode: 'scheduled',
        detail: { reason: decision.reason },
      });
      if (!decision.allowed || decision.requiresApproval) return;

      await this.executor.execute(this.normalizeApprovedCommand(command, decision.normalizedTarget), intent.language as 'ar' | 'tr' | 'en');
    } catch (error) {
      this.audit.recordError('scheduled_intent', error);
    }
  }

  getMemoryInsights() {
    return this.memoryManager.getMemoryInsights();
  }

  clearMemories(): void {
    this.memoryManager.clearAllMemories();
    this.audit.record({ action: 'memory_clear_all', outcome: 'success', mode: 'interactive' });
  }

  clearShortTermMemory(): void {
    this.memoryManager.clearShortTermMemory();
    this.audit.record({ action: 'memory_clear_short_term', outcome: 'success', mode: 'interactive' });
  }

  deleteMemory(id: string): boolean {
    const deleted = this.memoryManager.deleteLongTermMemory(id);
    this.audit.record({ action: 'memory_delete', outcome: deleted ? 'success' : 'failure', mode: 'interactive', target: id });
    return deleted;
  }

  getMemoryPrivacy(): MemoryPrivacyConfig {
    return this.memoryManager.getPrivacyConfig();
  }

  updateMemoryPrivacy(config: Partial<MemoryPrivacyConfig>): void {
    this.memoryManager.updatePrivacyConfig(config);
    this.audit.record({ action: 'memory_privacy_update', outcome: 'success', mode: 'interactive', detail: this.memoryManager.getPrivacyConfig() });
  }

  getContextSummary(): string {
    return this.contextManager.getContextSummary();
  }

  clearContext(): void {
    this.contextManager.clearContext();
  }

  updatePreferences(preferences: Partial<PreferenceMemory>): void {
    this.memoryManager.updatePreferences(preferences);
  }

  getPreferences(): PreferenceMemory {
    return this.memoryManager.getPreferences();
  }

  getAuditEvents(limit = 50) {
    return this.audit.readRecent(limit);
  }

  clearAuditTrail(): void {
    this.audit.clear();
  }

  listScheduledTasks(): ScheduledTask[] {
    return this.scheduler.listTasks();
  }

  clearScheduledTasks(): void {
    this.scheduler.clear();
    this.audit.record({ action: 'scheduler_clear', outcome: 'success', mode: 'interactive' });
  }

  addSkill(skill: any): void {
    this.skillRouter.addSkill(skill);
  }

  removeSkill(skillName: string): void {
    this.skillRouter.removeSkill(skillName);
  }

  updateRoutingConfidenceThreshold(threshold: number): void {
    this.skillRouter.updateRoutingConfidenceThreshold(threshold);
  }

  /** @deprecated Confidence never grants execution permission. */
  updateSafetyThreshold(threshold: number): void {
    this.updateRoutingConfidenceThreshold(threshold);
  }

  shutdown(): void {
    this.taskRunner.stop();
  }

  private async handlePendingApproval(input: string): Promise<AssistantOutput | null> {
    const context = this.contextManager.getContext();
    const approval = this.policy.parseApproval(input);
    const hasPending = Boolean(context.pending_execution || context.pending_schedule_id || context.dev_patch_target);
    if (!hasPending) return null;

    if (approval === 'none') {
      this.cancelPendingState('superseded_by_new_input');
      return null;
    }

    if (approval === 'cancel') {
      this.cancelPendingState('user_cancelled');
      return this.message('Pending operation cancelled.', false, []);
    }

    if (context.pending_schedule_id) {
      const taskId = context.pending_schedule_id;
      const enabled = this.scheduler.enableTask(taskId);
      this.contextManager.updateContext({ pending_schedule_id: undefined, awaiting_confirmation: false, awaiting_followup: false });
      this.audit.record({ action: 'scheduler_enable', outcome: enabled ? 'success' : 'failure', mode: 'interactive', target: taskId });
      return this.message(enabled ? 'Scheduled task enabled.' : 'Scheduled task no longer exists.', false, []);
    }

    const pending = context.pending_execution;
    if (!pending) {
      this.cancelPendingState('missing_bound_command');
      return this.message('No command-bound approval is available. Nothing was executed.', false, []);
    }

    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      this.cancelPendingState('approval_expired');
      this.audit.record({ action: pending.command.action, outcome: 'cancelled', mode: 'interactive', approval_id: pending.id, detail: { reason: 'expired' } });
      return this.message('Approval expired. Re-issue the original command to generate a new preview.', false, []);
    }

    this.contextManager.updateContext({ pending_execution: undefined, awaiting_confirmation: false, awaiting_followup: false });
    this.audit.record({
      action: pending.command.action,
      target: pending.command.target,
      outcome: 'allowed',
      mode: 'interactive',
      approval_id: pending.id,
      detail: { approved_preview: pending.preview },
    });

    const result = await this.executor.execute({ ...pending.command, requires_confirmation: false }, this.getLanguageFromContext());
    return this.renderResult(result, undefined, undefined, input);
  }

  private previewSchedule(intent: Intent, context: ConversationContext): AssistantOutput {
    const at = String((intent.entities as any).at || '08:00');
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(at)) {
      return this.message('Schedule time must use HH:MM (24-hour format).', false, []);
    }

    const task = this.scheduler.addTask(intent, context, { type: 'daily', at });
    this.contextManager.updateContext({
      pending_schedule_id: task.id,
      awaiting_confirmation: true,
      awaiting_followup: true,
    });
    this.contextManager.setState('AWAITING_CONFIRMATION');
    this.audit.record({ action: 'scheduler_enable', outcome: 'approval_required', mode: 'interactive', target: task.id, detail: { trigger: `daily ${at}` } });

    const message = this.localized(
      intent,
      `معاينة: تشغيل المهمة يوميًا الساعة ${at}. لم يتم تفعيلها بعد. هل توافق؟`,
      `Önizleme: görev her gün ${at} saatinde çalışacak. Henüz etkin değil. Onaylıyor musun?`,
      `Preview: run this task daily at ${at}. It is not enabled yet. Approve?`,
    );
    return this.message(message, true, this.approvalActions(intent.language as 'ar' | 'tr' | 'en'));
  }

  private stageApproval(command: ExecutionCommand, preview: string, language: 'ar' | 'tr' | 'en', normalizedTarget?: string): AssistantOutput {
    this.stageApprovalContext(command, preview, normalizedTarget);
    const message = language === 'ar'
      ? `معاينة العملية: ${preview}\nلن يتم التنفيذ قبل موافقة صريحة.`
      : language === 'tr'
        ? `İşlem önizlemesi: ${preview}\nAçık onay verilmeden yürütülmeyecek.`
        : `Operation preview: ${preview}\nIt will not execute until you explicitly approve.`;
    return this.message(message, true, this.approvalActions(language));
  }

  private stageApprovalContext(command: ExecutionCommand, preview: string, normalizedTarget?: string): void {
    const now = new Date();
    const pending: PendingExecution = {
      id: randomUUID(),
      command: this.normalizeApprovedCommand(command, normalizedTarget),
      preview,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    };
    this.contextManager.updateContext({ pending_execution: pending, awaiting_confirmation: true, awaiting_followup: true });
    this.contextManager.setState('AWAITING_CONFIRMATION');
  }

  private cancelPendingState(reason: string): void {
    const context = this.contextManager.getContext();
    if (context.pending_schedule_id) this.scheduler.removeTask(context.pending_schedule_id);
    if (context.pending_execution) {
      this.audit.record({
        action: context.pending_execution.command.action,
        target: context.pending_execution.command.target,
        outcome: 'cancelled',
        mode: 'interactive',
        approval_id: context.pending_execution.id,
        detail: { reason },
      });
    }
    this.contextManager.updateContext({
      pending_execution: undefined,
      pending_schedule_id: undefined,
      dev_patch_target: undefined,
      dev_patch_content: undefined,
      awaiting_confirmation: false,
      awaiting_followup: false,
    });
    this.contextManager.setState('IDLE');
  }

  private normalizeApprovedCommand(command: ExecutionCommand, normalizedTarget?: string): ExecutionCommand {
    return {
      ...command,
      target: normalizedTarget !== undefined ? normalizedTarget : command.target,
      requires_confirmation: false,
    };
  }

  private renderResult(result: SkillResult, intent?: Intent, skillName?: string, userInput?: string): AssistantOutput {
    const context = this.contextManager.getContext();
    if (result.success && skillName) {
      this.contextManager.updateActiveSkill(skillName, intent?.entities.query);
      if (intent) this.contextManager.setLastAction(intent.name);
    }

    const current = this.contextManager.getContext();
    let response = result.error_detail
      ? this.responseGenerator.generateErrorResponse(result.error_detail, (intent?.language || this.getLanguageFromContext()) as 'ar' | 'tr' | 'en')
      : this.responseGenerator.generateResponse(result, current);
    const followUp = this.responseGenerator.generateFollowUp(result, current);
    if (followUp) response += `\n\n${followUp}`;

    if (intent && intent.name !== 'memory_command' && this.memoryManager.shouldStoreMemory(intent, current)) {
      this.memoryManager.addLongTermMemory({
        type: 'habit',
        description: `Explicitly remembered usage pattern: ${intent.name}`,
        frequency: 1,
        last_occurrence: formatISO(new Date()),
        metadata: {},
      });
    }

    if (userInput) this.contextManager.addToHistory(userInput, response);
    return {
      response,
      voiceResponse: this.responseGenerator.formatForVoice(response),
      context: this.contextManager.getContext(),
      requiresFollowUp: Boolean(result.requires_followup),
      suggestedActions: result.suggested_actions || [],
    };
  }

  private message(text: string, requiresFollowUp: boolean, suggestedActions: string[]): AssistantOutput {
    return {
      response: text,
      voiceResponse: this.responseGenerator.formatForVoice(text),
      context: this.contextManager.getContext(),
      requiresFollowUp,
      suggestedActions,
    };
  }

  private approvalActions(language: 'ar' | 'tr' | 'en'): string[] {
    return language === 'ar' ? ['نعم', 'إلغاء'] : language === 'tr' ? ['Evet', 'İptal'] : ['Yes', 'Cancel'];
  }

  private localized(intent: Intent, ar: string, tr: string, en: string): string {
    return intent.language === 'ar' ? ar : intent.language === 'tr' ? tr : en;
  }

  private getLanguageFromContext(): 'ar' | 'tr' | 'en' {
    return this.memoryManager.getPreferences().language || 'en';
  }
}
