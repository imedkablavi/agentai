import {
  ContextManager as IContextManager,
  ConversationContext,
  Intent,
  ConversationState,
  SelectionContext,
} from '../types';
import { formatISO } from 'date-fns';

export class ContextManager implements IContextManager {
  private context: ConversationContext;
  private readonly maxHistoryLength = 10;
  private readonly contextTimeout = 5 * 60 * 1000;
  private lastUpdate: Date;

  constructor() {
    this.context = {
      state: 'IDLE',
      awaiting_followup: false,
      conversation_history: [],
      timestamp: formatISO(new Date()),
    };
    this.lastUpdate = new Date();
  }

  getContext(): ConversationContext {
    this.checkContextTimeout();
    return this.context;
  }

  updateContext(updates: Partial<ConversationContext>): void {
    this.context = {
      ...this.context,
      ...updates,
      timestamp: formatISO(new Date()),
    };
    this.lastUpdate = new Date();
    if (updates.conversation_history) this.trimConversationHistory();
  }

  clearContext(): void {
    this.context = {
      state: 'IDLE',
      awaiting_followup: false,
      conversation_history: [],
      timestamp: formatISO(new Date()),
    };
    this.lastUpdate = new Date();
  }

  isFollowUpRequired(intent: Intent): boolean {
    const context = this.getContext();
    if (!context.awaiting_followup && !context.active_skill) return false;

    const followUpKeywords = {
      ar: ['كمّل', 'استمر', 'أكمل', 'تمام', 'حسنًا', 'أوه', 'نفذ'],
      tr: ['devam', 'tamam', 'tamamla', 'devam et', 'peki'],
      en: ['continue', 'proceed', 'okay', 'go ahead', 'execute', 'do it'],
    };
    const language = intent.language || 'ar';
    const keywords = followUpKeywords[language] || followUpKeywords.ar;
    const isFollowUpIntent = keywords.some(keyword => intent.raw_text.toLowerCase().includes(keyword.toLowerCase()));
    const isIndexReference = /^\d+$/.test(intent.raw_text.trim());
    const isSelectionIntent = ['select', 'اختر', 'seç'].some(word => intent.raw_text.toLowerCase().includes(word.toLowerCase()));
    return isFollowUpIntent || isIndexReference || isSelectionIntent;
  }

  getMissingContext(intent: Intent): string[] {
    const context = this.getContext();
    const missing: string[] = [];
    if (intent.context_required) {
      if (!context.active_skill && !context.awaiting_followup) missing.push('active_skill');
      if (intent.name.includes('select') && !context.active_topic) missing.push('selection_context');
      if (intent.name.includes('continue') && !context.last_action) missing.push('action_context');
    }
    return missing;
  }

  addToHistory(userInput: string, assistantResponse: string): void {
    const timestamp = formatISO(new Date());
    this.context.conversation_history.push(`[${timestamp}] User: ${userInput}`);
    this.context.conversation_history.push(`[${timestamp}] Assistant: ${assistantResponse}`);
    this.trimConversationHistory();
    this.lastUpdate = new Date();
  }

  getLastInteraction(): { user: string; assistant: string } | null {
    const history = this.context.conversation_history;
    if (history.length < 2) return null;
    const lastUserMessage = history.filter(h => h.includes('User:')).pop();
    const lastAssistantMessage = history.filter(h => h.includes('Assistant:')).pop();
    if (!lastUserMessage || !lastAssistantMessage) return null;
    return {
      user: lastUserMessage.split('User: ')[1],
      assistant: lastAssistantMessage.split('Assistant: ')[1],
    };
  }

  isContextFresh(): boolean {
    return Date.now() - this.lastUpdate.getTime() < this.contextTimeout;
  }

  private checkContextTimeout(): void {
    if (!this.isContextFresh()) this.clearContext();
  }

  private trimConversationHistory(): void {
    if (this.context.conversation_history.length > this.maxHistoryLength) {
      this.context.conversation_history = this.context.conversation_history.slice(-this.maxHistoryLength);
    }
  }

  getContextualIntent(intent: Intent): Intent {
    const context = this.getContext();
    if (!this.isFollowUpRequired(intent)) return intent;
    return {
      ...intent,
      entities: {
        ...intent.entities,
        context_skill: context.active_skill,
        context_topic: context.active_topic,
        context_action: context.last_action,
      },
    };
  }

  updateActiveSkill(skillName: string, topic?: string): void {
    this.updateContext({ active_skill: skillName, active_topic: topic, awaiting_followup: true });
  }

  clearActiveSkill(): void {
    this.updateContext({ active_skill: undefined, active_topic: undefined, awaiting_followup: false });
  }

  setLastAction(action: string): void {
    this.updateContext({ last_action: action });
  }

  getContextSummary(): string {
    const context = this.getContext();
    const parts: string[] = [];
    if (context.active_skill) parts.push(`Active skill: ${context.active_skill}`);
    if (context.active_topic) parts.push(`Active topic: ${context.active_topic}`);
    if (context.awaiting_followup) parts.push('Awaiting follow-up');
    if (context.last_action) parts.push(`Last action: ${context.last_action}`);
    return parts.join(', ') || 'No active context';
  }

  shouldResetContext(intent: Intent): boolean {
    const resetKeywords = {
      ar: ['جديد', 'بدء', 'ابدأ', 'انهاء', 'إنهاء', 'انهي', 'إنهي'],
      tr: ['yeni', 'başla', 'başlat', 'bitir', 'sonlandır'],
      en: ['new', 'start', 'begin', 'end', 'finish', 'reset'],
    };
    const language = intent.language || 'ar';
    const keywords = resetKeywords[language] || resetKeywords.ar;
    return keywords.some(keyword => intent.raw_text.toLowerCase().includes(keyword.toLowerCase()));
  }

  setState(state: ConversationState): void {
    this.updateContext({ state });
  }

  setSelectionContext(context: SelectionContext | null): void {
    this.updateContext({ selection_context: context });
  }
}
