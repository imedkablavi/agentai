import { 
  Intent, 
  SkillResult, 
  ConversationContext, 
  SafetyConfig,
  ExecutionCommand
} from './types';
import { MemoryManager } from './memory/MemoryManager';
import { ContextManager } from './context/ContextManager';
import { IntentEngine } from './intent/IntentEngine';
import { SkillRouter } from './skills/SkillRouter';
import { ResponseGenerator } from './response/ResponseGenerator';
import { formatISO } from 'date-fns';
import { CommandExecutor } from './execution/CommandExecutor';
import { SchedulerManager } from './scheduler/SchedulerManager';
import { TaskRunner } from './scheduler/TaskRunner';
import { ScheduledTask } from './scheduler/types';
import { LLMReasoner } from './reasoning/LLMReasoner';

export class AIAssistant {
  private memoryManager: MemoryManager;
  private contextManager: ContextManager;
  private intentEngine: IntentEngine;
  private skillRouter: SkillRouter;
  private responseGenerator: ResponseGenerator;
  private executor: CommandExecutor;
  private scheduler: SchedulerManager;
  private taskRunner: TaskRunner;
  private llm: LLMReasoner;
  private safetyConfig: SafetyConfig;

  constructor() {
    this.memoryManager = new MemoryManager();
    this.contextManager = new ContextManager();
    this.intentEngine = new IntentEngine();
    this.skillRouter = new SkillRouter();
    this.responseGenerator = new ResponseGenerator();
    this.executor = new CommandExecutor(this.memoryManager, this.contextManager);
    this.scheduler = new SchedulerManager();
    this.taskRunner = new TaskRunner(this.scheduler, this);
    this.llm = new LLMReasoner();
    this.taskRunner.start(60);
    
    this.safetyConfig = {
      min_confidence_threshold: 0.85,
      destructive_commands: [
        'delete', 'format', 'destroy', 'remove', 'erase',
        'احذف', 'امسح', 'افرغ', 'نسف',
        'sil', 'temizle', 'yok et'
      ],
      confirmation_required_patterns: [
        'shutdown', 'restart', 'format', 'delete system',
        'أطفئ', 'أعد التشغيل', 'افرغ', 'احذف النظام',
        'kapat', 'yeniden başlat', 'sil sistem'
      ],
      max_retry_attempts: 3
    };
  }

  async processInput(userInput: string): Promise<{
    response: string;
    voiceResponse: string;
    context: ConversationContext;
    requiresFollowUp: boolean;
    suggestedActions: string[];
  }> {
    try {
      // Step 1: Reasoning via LLM (primary), then fallback to IntentEngine
      const context = this.contextManager.getContext();
      let intent = await this.llm.infer(userInput);
      if (!intent) {
        intent = await this.intentEngine.classify(userInput, context);
      }
      
      // Step 2: Extract entities
      intent = await this.intentEngine.extractEntities(userInput, intent);
      
      // Step 3: Calculate confidence with context
      intent.confidence = this.intentEngine.calculateConfidence(intent, context);
      
      // Step 4: Check safety requirements
      if (!this.isSafeIntent(intent)) {
        return {
          response: this.responseGenerator.generateResponse({
            success: false,
            error: 'This command requires confirmation due to safety restrictions.'
          }, context),
          voiceResponse: this.responseGenerator.formatForVoice('This command requires confirmation due to safety restrictions.'),
          context,
          requiresFollowUp: true,
          suggestedActions: ['Confirm command', 'Cancel', 'Try something else']
        };
      }
      
      // Step 5: Update short-term memory
      this.memoryManager.updateShortTermMemory({
        last_intent: intent.name,
        last_query: userInput,
        last_application: intent.entities.application,
        last_topic: intent.entities.query
      });
      
      // Step 6: Route to appropriate skill
      const skill = this.skillRouter.route(intent, context);
      
      if (!skill) {
        return {
          response: this.responseGenerator.generateResponse({
            success: false,
            error: "I didn't understand that command. Try rephrasing or ask for help."
          }, context),
          voiceResponse: this.responseGenerator.formatForVoice("I didn't understand that command."),
          context,
          requiresFollowUp: false,
          suggestedActions: ['Show help', 'Try different words', 'Be more specific']
        };
      }
      
      // Step 6.5: Handle scheduling intents (plan → schedule → require confirmation)
      if (intent.name === 'schedule_task') {
        const at = ((intent.entities as any).at || '08:00') as string;
        const trigger = { type: 'daily', at } as const;
        const task = this.scheduler.addTask(intent, context, trigger);
        this.contextManager.updateContext({ awaiting_confirmation: true, awaiting_followup: true });
        const msg = intent.language === 'ar' ? 'تم إنشاء مهمة مجدولة. هل تؤكد تشغيلها يومياً؟' : intent.language === 'tr' ? 'Zamanlanmış görev oluşturuldu. Her gün çalıştırmayı onaylıyor musun?' : 'Scheduled task created. Confirm daily execution?';
        return {
          response: msg,
          voiceResponse: this.responseGenerator.formatForVoice(msg),
          context: this.contextManager.getContext(),
          requiresFollowUp: true,
          suggestedActions: [intent.language === 'ar' ? 'نعم' : intent.language === 'tr' ? 'Evet' : 'Yes']
        };
      }

      if (intent.name === 'stop_tasks') {
        this.scheduler.disableAll();
        const msg = intent.language === 'ar' ? 'تم إيقاف جميع المهام المجدولة.' : intent.language === 'tr' ? 'Tüm zamanlanmış görevler durduruldu.' : 'All scheduled tasks stopped.';
        return {
          response: msg,
          voiceResponse: this.responseGenerator.formatForVoice(msg),
          context: this.contextManager.getContext(),
          requiresFollowUp: false,
          suggestedActions: []
        };
      }

      // Step 7: Execute via CommandExecutor
      let command: ExecutionCommand = await skill.execute(intent, context);
      if (intent.name === 'confirm_action' && context.awaiting_confirmation) {
        this.contextManager.confirmPending();
        // Enable last created scheduled task
        const tasks = this.scheduler.listTasks();
        if (tasks.length > 0) this.scheduler.enableTask(tasks[tasks.length - 1].id);
      }
      const skillResult = await this.executor.execute(command, intent.language as 'ar' | 'tr' | 'en');
      
      // Step 8: Update context based on result
      if (skillResult.success) {
        this.contextManager.updateActiveSkill(skill.name, intent.entities.query);
        this.contextManager.setLastAction(intent.name);
      }
      
      // Step 9: Generate response
      let response = '';
      if (skillResult.error_detail) {
        response = this.responseGenerator.generateErrorResponse(skillResult.error_detail, intent.language as 'ar' | 'tr' | 'en');
      } else {
        response = this.responseGenerator.generateResponse(skillResult, context);
      }
      const voiceResponse = this.responseGenerator.formatForVoice(response);
      const followUp = this.responseGenerator.generateFollowUp(skillResult, context);
      
      // Step 10: Store long-term memory if appropriate
      if (this.memoryManager.shouldStoreMemory(intent, context)) {
        this.memoryManager.addLongTermMemory({
          type: 'habit',
          description: `User frequently uses ${intent.name} for ${intent.entities.query || intent.entities.application}`,
          frequency: 1,
          last_occurrence: formatISO(new Date()),
          metadata: { intent: intent.name, entities: intent.entities }
        });
      }
      
      // Step 11: Update conversation history
      this.contextManager.addToHistory(userInput, response);
      
      return {
        response: response + (followUp ? '\n\n' + followUp : ''),
        voiceResponse: voiceResponse + (followUp ? ' ' + this.responseGenerator.formatForVoice(followUp) : ''),
        context: this.contextManager.getContext(),
        requiresFollowUp: skillResult.requires_followup || false,
        suggestedActions: skillResult.suggested_actions || []
      };
      
    } catch (error) {
      console.error('AI Assistant error:', error);
      
      return {
        response: this.responseGenerator.generateResponse({
          success: false,
          error: 'An unexpected error occurred. Please try again.'
        }, this.contextManager.getContext()),
        voiceResponse: 'An unexpected error occurred. Please try again.',
        context: this.contextManager.getContext(),
        requiresFollowUp: false,
        suggestedActions: ['Try again', 'Report issue', 'Restart assistant']
      };
    }
  }

  public async runScheduledIntent(task: ScheduledTask): Promise<void> {
    if (!task.enabled) return;
    // Execute as if the user said it now; apply safety: do not auto-execute high risk
    const classified = await this.intentEngine.extractEntities(task.intent.raw_text, task.intent);
    const contextSnapshot = task.context_snapshot as ConversationContext;
    const skill = this.skillRouter.route(classified, contextSnapshot);
    if (!skill) return;
    const command = await skill.execute(classified, contextSnapshot);
    if (command.risk_level === 'high') {
      // Require confirmation: set context and notify via response
      this.contextManager.updateContext({ awaiting_confirmation: true, awaiting_followup: true });
      return;
    }
    await this.executor.execute(command, classified.language as 'ar' | 'tr' | 'en');
  }

  private isSafeIntent(intent: Intent): boolean {
    // Check for destructive commands
    const isDestructive = this.safetyConfig.destructive_commands.some(cmd =>
      intent.raw_text.toLowerCase().includes(cmd.toLowerCase())
    );
    
    if (isDestructive && intent.confidence < this.safetyConfig.min_confidence_threshold) {
      return false;
    }
    
    // Check for system commands that require confirmation
    const requiresConfirmation = this.safetyConfig.confirmation_required_patterns.some(pattern =>
      intent.raw_text.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (requiresConfirmation && intent.confidence < 0.9) {
      return false;
    }
    
    return true;
  }

  getMemoryInsights() {
    return this.memoryManager.getMemoryInsights();
  }

  getContextSummary() {
    return this.contextManager.getContextSummary();
  }

  clearContext() {
    this.contextManager.clearContext();
  }

  updatePreferences(preferences: any) {
    this.memoryManager.updatePreferences(preferences);
  }

  getPreferences() {
    return this.memoryManager.getPreferences();
  }

  addSkill(skill: any) {
    this.skillRouter.addSkill(skill);
  }

  removeSkill(skillName: string) {
    this.skillRouter.removeSkill(skillName);
  }

  updateSafetyThreshold(threshold: number) {
    this.safetyConfig.min_confidence_threshold = Math.max(0.5, Math.min(1.0, threshold));
    this.skillRouter.updateSafetyThreshold(threshold);
  }
}
