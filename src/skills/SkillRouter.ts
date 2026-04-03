import { 
  SkillRouter as ISkillRouter, 
  Skill, 
  Intent, 
  ConversationContext 
} from '../types';
import { ApplicationSkill } from './ApplicationSkill';
import { WebSearchSkill } from './WebSearchSkill';
import { YouTubeSkill } from './YouTubeSkill';
import { SystemSkill } from './SystemSkill';
import { SelectionSkill } from './SelectionSkill';
import { MemorySkill } from './MemorySkill';
import { DeveloperSkill } from './DeveloperSkill';

export class SkillRouter implements ISkillRouter {
  private skills: Skill[] = [];
  private safetyThreshold = 0.85;
  private permissionRequiredIntents = [
    'system_command', 'shutdown', 'restart', 'format', 'delete'
  ];

  constructor() {
    this.initializeSkills();
  }

  route(intent: Intent, context: ConversationContext): Skill | null {
    // Check confidence threshold
    if (intent.confidence < 0.3) {
      return null;
    }

    // Check safety requirements
    if (!this.validateSafety(intent)) {
      return null;
    }

    // Find matching skill
    for (const skill of this.skills) {
      if (skill.supported_intents.includes(intent.name)) {
        if (skill.validate(intent, context)) {
          return skill;
        }
      }
    }

    // Try fallback skills for unknown intents
    if (intent.name === 'unknown') {
      return this.getFallbackSkill(intent, context);
    }

    return null;
  }

  validatePermissions(skill: Skill, intent: Intent): boolean {
    // Check if intent requires elevated permissions
    if (this.permissionRequiredIntents.some(permIntent => intent.name.includes(permIntent))) {
      return intent.confidence >= this.safetyThreshold;
    }

    // Check for destructive commands
    if (this.isDestructiveIntent(intent)) {
      return intent.confidence >= this.safetyThreshold;
    }

    return true;
  }

  getAvailableSkills(): Skill[] {
    return this.skills;
  }

  private initializeSkills(): void {
    this.skills = [
      new ApplicationSkill(),
      new WebSearchSkill(),
      new YouTubeSkill(),
      new SystemSkill(),
      new SelectionSkill(),
      new MemorySkill(),
      new DeveloperSkill()
    ];
  }

  private validateSafety(intent: Intent): boolean {
    // High confidence required for system commands
    if (intent.name.includes('system_command')) {
      return intent.confidence >= 0.9;
    }

    // Check for ambiguous commands
    if (intent.confidence < 0.6 && this.isAmbiguousIntent(intent)) {
      return false;
    }

    return true;
  }

  private getFallbackSkill(intent: Intent, context: ConversationContext): Skill | null {
    // Try to infer skill from context
    if (context.active_skill) {
      const activeSkill = this.skills.find(s => s.name === context.active_skill);
      if (activeSkill && activeSkill.validate(intent, context)) {
        return activeSkill;
      }
    }

    // Try web search for unknown queries
    if (intent.raw_text.length > 3) {
      const webSearchSkill = this.skills.find(s => s.name === 'WebSearchSkill');
      if (webSearchSkill) {
        intent.name = 'search_web';
        intent.entities.query = intent.raw_text;
        return webSearchSkill;
      }
    }

    return null;
  }

  private isDestructiveIntent(intent: Intent): boolean {
    const destructivePatterns = [
      /delete/i, /remove/i, /format/i, /erase/i, /destroy/i,
      /احذف/i, /امسح/i, /افرغ/i, /نسف/i,
      /sil/i, /temizle/i, /yok et/i
    ];

    return destructivePatterns.some(pattern => pattern.test(intent.raw_text));
  }

  private isAmbiguousIntent(intent: Intent): boolean {
    const ambiguousPatterns = [
      /this/i, /that/i, /it/i, /them/i,
      /هذا/i, /ذلك/i, /هذه/i, /ذلكم/i,
      /bu/i, /şu/i, /o/i
    ];

    return ambiguousPatterns.some(pattern => pattern.test(intent.raw_text)) &&
           !intent.entities.query &&
           !intent.entities.application;
  }

  addSkill(skill: Skill): void {
    this.skills.push(skill);
  }

  removeSkill(skillName: string): void {
    this.skills = this.skills.filter(s => s.name !== skillName);
  }

  updateSafetyThreshold(threshold: number): void {
    this.safetyThreshold = Math.max(0.5, Math.min(1.0, threshold));
  }
}