#!/usr/bin/env node

import { AIAssistant } from './AIAssistant';
import { ConsoleVoiceOutputAdapter } from './voice/VoiceOutputAdapter';
import { VoiceInput } from './voice/VoiceInput';
import { VoiceOutput } from './voice/VoiceOutput';
import { VoiceController } from './voice/VoiceController';
import * as readline from 'readline';

export class AgentAICLI {
  private readonly assistant: AIAssistant;
  private readonly rl: readline.Interface;
  private readonly voice = new ConsoleVoiceOutputAdapter();
  private readonly voiceController: VoiceController;
  private shuttingDown = false;
  private interfaceClosed = false;

  constructor() {
    this.assistant = new AIAssistant();
    this.voiceController = new VoiceController(this.assistant, new VoiceInput(), new VoiceOutput());
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'agentai> ' });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.rl.on('line', async (raw: string) => {
      const input = raw.trim();
      if (!input) return this.rl.prompt();

      try {
        if (await this.handleLocalCommand(input)) return;
        await this.processAssistantInput(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown CLI error';
        console.error(`Error: ${message}`);
      } finally {
        if (!this.shuttingDown) this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.interfaceClosed = true;
      this.shutdown();
    });
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async handleLocalCommand(input: string): Promise<boolean> {
    const lower = input.toLocaleLowerCase();
    if (lower === 'exit' || lower === 'quit') {
      this.shutdown();
      return true;
    }
    if (lower === 'help') {
      this.showHelp();
      return true;
    }
    if (lower === 'context') {
      console.log(this.assistant.getContextSummary());
      return true;
    }
    if (lower === 'clear') {
      this.assistant.clearContext();
      console.log('Conversation context cleared.');
      return true;
    }
    if (lower === 'memory') {
      this.showMemory();
      return true;
    }
    if (lower === 'memory clear') {
      console.log('Preview: delete short-term and long-term memories. Re-run: memory clear --confirm');
      return true;
    }
    if (lower === 'memory clear --confirm') {
      this.assistant.clearMemories();
      console.log('Stored memories cleared. Preferences are retained.');
      return true;
    }
    if (lower === 'memory clear short') {
      console.log('Preview: clear short-term memory. Re-run: memory clear short --confirm');
      return true;
    }
    if (lower === 'memory clear short --confirm') {
      this.assistant.clearShortTermMemory();
      console.log('Short-term memory cleared.');
      return true;
    }
    if (lower.startsWith('memory retention ')) {
      const days = Number(lower.slice('memory retention '.length));
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        console.log('Retention must be an integer from 1 to 3650 days.');
      } else {
        this.assistant.updateMemoryPrivacy({ retention_days: days });
        console.log(`Long-term memory retention set to ${days} day(s).`);
      }
      return true;
    }
    if (lower === 'audit') {
      const events = this.assistant.getAuditEvents(20);
      console.log(events.length ? JSON.stringify(events, null, 2) : 'No audit events recorded.');
      return true;
    }
    if (lower === 'audit clear') {
      console.log('Preview: delete the local redacted audit trail. Re-run: audit clear --confirm');
      return true;
    }
    if (lower === 'audit clear --confirm') {
      this.assistant.clearAuditTrail();
      console.log('Audit trail cleared.');
      return true;
    }
    if (lower === 'tasks') {
      console.log(JSON.stringify(this.assistant.listScheduledTasks(), null, 2));
      return true;
    }
    if (lower === 'tasks clear') {
      console.log('Preview: delete all scheduled tasks. Re-run: tasks clear --confirm');
      return true;
    }
    if (lower === 'tasks clear --confirm') {
      this.assistant.clearScheduledTasks();
      console.log('Scheduled tasks cleared.');
      return true;
    }
    if (lower.startsWith('ptt ') || input.startsWith('تكلم ')) {
      const audioPath = input.replace(/^ptt\s+/i, '').replace(/^تكلم\s+/, '').trim();
      if (!audioPath) console.log('Audio path is required.');
      else await this.voiceController.processOnce(audioPath);
      return true;
    }
    return false;
  }

  private async processAssistantInput(input: string): Promise<void> {
    const result = await this.assistant.processInput(input);
    console.log(result.response);

    const prefs = this.assistant.getPreferences();
    if (prefs.voice_mode) {
      const voiceText = prefs.voice_response_mode === 'long'
        ? result.voiceResponse
        : result.voiceResponse.split(/\.|!|؟|！/)[0];
      if (voiceText.trim()) await this.voice.speak(voiceText, prefs.language);
    }

    if (result.suggestedActions.length > 0) {
      console.log(`Suggested: ${result.suggestedActions.join(' | ')}`);
    }
  }

  private showMemory(): void {
    const insights = this.assistant.getMemoryInsights();
    console.log(JSON.stringify({
      privacy: insights.privacy,
      preferences: insights.preferences,
      habits: insights.habits,
      recent_patterns: insights.recent_patterns,
    }, null, 2));
  }

  private showHelp(): void {
    console.log(`
AgentAI CLI

Local commands:
  help                          Show this help
  context                       Show current conversation context summary
  clear                         Clear transient conversation context
  memory                        Show memory/privacy status
  memory retention <days>       Set long-term memory retention (1-3650)
  memory clear                  Preview memory deletion
  memory clear --confirm        Delete stored short/long-term memories
  memory clear short            Preview short-term deletion
  audit                         Show recent redacted audit events
  audit clear                   Preview audit deletion
  tasks                         List scheduled tasks
  tasks clear                   Preview deleting all scheduled tasks
  ptt <path>                    Process a workspace audio file through push-to-talk
  exit | quit                   Exit

Execution model:
  - Confidence affects interpretation only; it never grants permission.
  - Impactful actions show a preview and require an exact Yes/Evet/نعم approval.
  - A new unrelated input cancels a pending approval rather than reusing it.
  - File/developer/voice-file actions are restricted to the current workspace.
  - Windows power/session controls are implemented only on Windows.
  - Linux supports the CLI, workspace/file operations, search, and best-effort mapped app launch/close.
  - Network Edge TTS is disabled unless AGENTAI_ENABLE_EDGE_TTS=true is explicitly set.
`);
  }

  public start(): void {
    console.log('AgentAI CLI - policy-gated local assistant');
    console.log("Type 'help' for commands. Runtime data is private local state, not repository files.");
    this.rl.prompt();
  }

  private shutdown(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.assistant.shutdown();
    if (!this.interfaceClosed) this.rl.close();
  }
}

// Backward-compatible type name for existing imports; the product is no longer
// documented as Windows-only.
export { AgentAICLI as WindowsAIAssistantCLI };

if (require.main === module) {
  new AgentAICLI().start();
}
