import {
  SkillRouter as ISkillRouter,
  Skill,
  Intent,
  ConversationContext,
} from '../types';
import { ApplicationSkill } from './ApplicationSkill';
import { WebSearchSkill } from './WebSearchSkill';
import { YouTubeSkill } from './YouTubeSkill';
import { SystemSkill } from './SystemSkill';
import { SelectionSkill } from './SelectionSkill';
import { MemorySkill } from './MemorySkill';
import { DeveloperSkill } from './DeveloperSkill';
import { PersonalAssistantSkill } from './PersonalAssistantSkill';

export class SkillRouter implements ISkillRouter {
  private skills: Skill[] = [];
  private routingConfidenceFloor = 0.3;

  constructor() {
    this.initializeSkills();
  }

  route(intent: Intent, context: ConversationContext): Skill | null {
    // Confidence is only a semantic-routing signal. It never authorizes execution.
    if (intent.confidence < this.routingConfidenceFloor) return null;
    if (intent.confidence < 0.6 && this.isAmbiguousIntent(intent)) return null;

    for (const skill of this.skills) {
      if (skill.supported_intents.includes(intent.name) && skill.validate(intent, context)) {
        return skill;
      }
    }

    // Unknown natural-language queries may fall back to web search only when they
    // are not imperative/ambiguous. The execution policy still evaluates output.
    if (intent.name === 'unknown' && this.isSafeSearchFallback(intent)) {
      const webSearchSkill = this.skills.find(skill => skill.name === 'WebSearchSkill');
      if (webSearchSkill) {
        intent.name = 'search_web';
        intent.entities.query = intent.raw_text;
        return webSearchSkill;
      }
    }

    return null;
  }

  validatePermissions(skill: Skill, intent: Intent): boolean {
    // Compatibility API: verifies only that the skill is registered and claims the
    // intent. Authorization belongs exclusively to ExecutionPolicy.
    return this.skills.includes(skill) && skill.supported_intents.includes(intent.name);
  }

  getAvailableSkills(): Skill[] {
    return [...this.skills];
  }

  addSkill(skill: Skill): void {
    this.skills.push(skill);
  }

  removeSkill(skillName: string): void {
    this.skills = this.skills.filter(skill => skill.name !== skillName);
  }

  updateRoutingConfidenceThreshold(threshold: number): void {
    this.routingConfidenceFloor = Math.max(0.1, Math.min(0.8, threshold));
  }

  /** @deprecated This changes routing confidence only; it never grants permission. */
  updateSafetyThreshold(threshold: number): void {
    this.updateRoutingConfidenceThreshold(threshold);
  }

  private initializeSkills(): void {
    this.skills = [
      new ApplicationSkill(),
      new WebSearchSkill(),
      new YouTubeSkill(),
      new SystemSkill(),
      new SelectionSkill(),
      new MemorySkill(),
      new PersonalAssistantSkill(),
      new DeveloperSkill(),
    ];
  }

  private isAmbiguousIntent(intent: Intent): boolean {
    const raw = intent.raw_text.trim().toLocaleLowerCase();
    if (!raw) return true;

    const pronounOnlyOrReference = /^(?:this|that|it|them|do it|execute it|هذا|هذه|ذلك|نفذها|نفذه|اعملها|bu|şu|o|bunu yap)$/i;
    if (pronounOnlyOrReference.test(raw)) return true;

    const refersWithoutTarget = /\b(?:this|that|it|them)\b/i.test(raw)
      || /(?:هذا|هذه|ذلك|هذي)/i.test(raw)
      || /\b(?:bu|şu|onu|bunu)\b/i.test(raw);

    const hasTarget = Boolean(
      intent.entities.query
      || intent.entities.application
      || intent.entities.file_path
      || intent.entities.url
      || intent.entities.index,
    );
    return refersWithoutTarget && !hasTarget;
  }

  private isSafeSearchFallback(intent: Intent): boolean {
    if (this.isAmbiguousIntent(intent) || intent.raw_text.length < 4) return false;
    const imperative = /^(?:open|close|run|execute|delete|remove|shutdown|restart|format|افتح|اغلق|أغلق|نفذ|احذف|امسح|اطفئ|أطفئ|aç|kapat|çalıştır|sil|yeniden)/i;
    return !imperative.test(intent.raw_text.trim());
  }
}
