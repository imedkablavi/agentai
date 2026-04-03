#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsAIAssistantCLI = void 0;
const AIAssistant_1 = require("./AIAssistant");
const VoiceOutputAdapter_1 = require("./voice/VoiceOutputAdapter");
const VoiceInput_1 = require("./voice/VoiceInput");
const VoiceOutput_1 = require("./voice/VoiceOutput");
const VoiceController_1 = require("./voice/VoiceController");
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WindowsAIAssistantCLI {
    constructor() {
        this.sessionLog = [];
        this.voice = new VoiceOutputAdapter_1.ConsoleVoiceOutputAdapter();
        this.assistant = new AIAssistant_1.AIAssistant();
        this.voiceController = new VoiceController_1.VoiceController(this.assistant, new VoiceInput_1.VoiceInput(), new VoiceOutput_1.VoiceOutput());
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '🤖 AI Assistant> '
        });
        this.setupEventHandlers();
        this.logSessionStart();
    }
    setupEventHandlers() {
        this.rl.on('line', async (input) => {
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
    async processUserInput(input) {
        try {
            console.log(`👤 You: ${input}`);
            this.logInteraction('User', input);
            const startTime = Date.now();
            const result = await this.assistant.processInput(input);
            const responseTime = Date.now() - startTime;
            console.log(`🤖 Assistant: ${result.response}`);
            const prefs = this.assistant.getPreferences();
            if (prefs.voice_mode) {
                const short = prefs.voice_response_mode === 'long' ? result.voiceResponse : result.voiceResponse.split(/\.|!|؟/)[0];
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
        }
        catch (error) {
            console.error('❌ Error processing input:', error);
            this.logInteraction('System', `Error: ${error}`);
        }
    }
    showHelp() {
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
    showMemoryInsights() {
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
    showContext() {
        const context = this.assistant.getContextSummary();
        console.log(`\n🔄 Current Context: ${context}`);
    }
    logInteraction(sender, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${sender}: ${message}`;
        this.sessionLog.push(logEntry);
    }
    logSessionStart() {
        const timestamp = new Date().toISOString();
        this.sessionLog.push(`\n=== AI Assistant Session Started ===`);
        this.sessionLog.push(`[${timestamp}] Session initialized`);
        this.sessionLog.push(`=====================================\n`);
    }
    saveSessionLog() {
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
        }
        catch (error) {
            console.error('❌ Failed to save session log:', error);
        }
    }
    shutdown() {
        console.log('\n👋 Shutting down AI Assistant...');
        this.saveSessionLog();
        this.rl.close();
        process.exit(0);
    }
    start() {
        console.log(`
🤖 Windows AI Assistant V2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Smart Memory • Context Awareness • Multi-language

Type 'help' for commands, 'exit' to quit.
`);
        this.rl.prompt();
    }
}
exports.WindowsAIAssistantCLI = WindowsAIAssistantCLI;
// Main execution
if (require.main === module) {
    const assistant = new WindowsAIAssistantCLI();
    assistant.start();
}
//# sourceMappingURL=main.js.map