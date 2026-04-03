#!/usr/bin/env node

import { AIAssistant } from './AIAssistant';
import { ConsoleVoiceOutputAdapter } from './voice/VoiceOutputAdapter';
import { VoiceInput } from './voice/VoiceInput';
import { VoiceOutput } from './voice/VoiceOutput';
import { VoiceController } from './voice/VoiceController';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

class WindowsAIAssistantCLI {
  private assistant: AIAssistant;
  private rl: readline.Interface;
  private sessionLog: string[] = [];
  private voice = new ConsoleVoiceOutputAdapter();
  private voiceController: VoiceController;

  constructor() {
    this.assistant = new AIAssistant();
    this.voiceController = new VoiceController(this.assistant, new VoiceInput(), new VoiceOutput());
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 AI Assistant> '
    });

    this.setupEventHandlers();
    this.logSessionStart();
  }

  private setupEventHandlers(): void {
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput === '') {
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        this.shutdown();
        return;
      }

      if (trimmedInput.toLowerCase() === 'help') {
        this.showHelp();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'memory') {
        this.showMemoryInsights();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'context') {
        this.showContext();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === 'clear') {
        this.assistant.clearContext();
        console.log('✅ Context cleared.');
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase().startsWith('ptt ') || trimmedInput.startsWith('تكلم ')) {
        const audioPath = trimmedInput.replace(/^ptt\s+/i, '').replace(/^تكلم\s+/, '').trim();
        await this.voiceController.processOnce(audioPath);
        this.rl.prompt();
        return;
      }

      await this.processUserInput(trimmedInput);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.shutdown();
    });

    process.on('SIGINT', () => {
      this.shutdown();
    });
  }

  private async processUserInput(input: string): Promise<void> {
    try {
      console.log(`👤 You: ${input}`);
      this.logInteraction('User', input);

      const startTime = Date.now();
      const result = await this.assistant.processInput(input);
      const responseTime = Date.now() - startTime;

      console.log(`🤖 Assistant: ${result.response}`);
      const prefs = this.assistant.getPreferences();
      if (prefs.voice_mode) {
        const short = prefs.voice_response_mode === 'long' ? result.voiceResponse : result.voiceResponse.split(/\.|!|؟|！/)[0];
        await this.voice.speak(short, prefs.language);
      }
      console.log(`⏱️  Response time: ${responseTime}ms`);
      
      if (result.suggestedActions.length > 0) {
        console.log(`💡 Suggested: ${result.suggestedActions.join(' | ')}`);
      }

      if (result.requiresFollowUp) {
        console.log('🔄 Follow-up required');
      }

      this.logInteraction('Assistant', result.response);
      
    } catch (error) {
      console.error('❌ Error processing input:', error);
      this.logInteraction('System', `Error: ${error}`);
    }
  }

  private showHelp(): void {
    console.log(`
🤖 Windows AI Assistant V2 - دليلك المساعد

الأوامر (Commands):
  help        - عرض هذه الرسالة (Show help)
  memory      - عرض معلومات الذاكرة (Memory insights)
  context     - عرض السياق الحالي (Current context)
  clear       - مسح سياق المحادثة (Clear context)
  ptt <path>  - Push-to-talk audio input
  تكلم <path> - إدخال صوتي من ملف
  exit/quit   - إغلاق البرنامج (Exit)

أمثلة (Examples):
  - "افتح كروم" (Open Chrome)
  - "دور لي فيديوهات عن البرمجة" (Find programming videos)
  - "أطفئ الجهاز" (Shutdown computer)
  - "راجع هذا الملف" (Review this file - Dev mode)
  - "شغّل الاختبارات" (Run tests - Dev mode)
  - "صلّح الخطأ" (Fix the error - Dev mode)
  - "1" (اختيار العنصر رقم 1)

هذا المساعد يدعم اللغة العربية بشكل أساسي.
`);
  }

  private showMemoryInsights(): void {
    const insights = this.assistant.getMemoryInsights();
    
    console.log('\n🧠 Memory Insights:');
    console.log(`Language: ${insights.preferences.language}`);
    console.log(`Browser: ${insights.preferences.browser}`);
    console.log(`Voice Mode: ${insights.preferences.voice_mode ? 'ON' : 'OFF'}`);
    
    if (insights.habits.length > 0) {
      console.log('\nHabits:');
      insights.habits.forEach(habit => {
        console.log(`  - ${habit.description} (${habit.frequency} times)`);
      });
    }

    if (insights.recent_patterns.length > 0) {
      console.log('\nRecent Patterns:');
      insights.recent_patterns.forEach(pattern => {
        console.log(`  - ${pattern.description} (${pattern.frequency} times)`);
      });
    }
  }

  private showContext(): void {
    const context = this.assistant.getContextSummary();
    console.log(`\n🔄 Current Context: ${context}`);
  }

  private logInteraction(sender: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${sender}: ${message}`;
    this.sessionLog.push(logEntry);
  }

  private logSessionStart(): void {
    const timestamp = new Date().toISOString();
    this.sessionLog.push(`\n=== AI Assistant Session Started ===`);
    this.sessionLog.push(`[${timestamp}] Session initialized`);
    this.sessionLog.push(`=====================================\n`);
  }

  private saveSessionLog(): void {
    try {
      const logsDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `session-${timestamp}.log`);
      
      const logContent = this.sessionLog.join('\n');
      fs.writeFileSync(logFile, logContent, 'utf8');
      
      console.log(`\n💾 Session log saved to: ${logFile}`);
    } catch (error) {
      console.error('❌ Failed to save session log:', error);
    }
  }

  private shutdown(): void {
    console.log('\n👋 Shutting down AI Assistant...');
    this.saveSessionLog();
    this.rl.close();
    process.exit(0);
  }

  public start(): void {
    console.log(`
🤖 Windows AI Assistant V2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Smart Memory • Context Awareness • Multi-language

Type 'help' for commands, 'exit' to quit.
`);
    
    this.rl.prompt();
  }
}

// Main execution
if (require.main === module) {
  const assistant = new WindowsAIAssistantCLI();
  assistant.start();
}

export { WindowsAIAssistantCLI };
