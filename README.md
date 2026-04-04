# AgentAI

A personal + developer assistant with Arabic-first commands, safe execution, and voice support.

## Features

### Core Architecture
- **Smart Memory System**: Short-term, long-term, and preference memory with JSON persistence
- **Context Manager**: Maintains conversation state and active topics with 5-minute timeout
- **Intent Engine**: Multi-language intent classification with confidence scoring + Ollama LLM fallback
- **Skill Router**: Intelligent skill selection with permission validation (9 registered skills)
- **Response Generator**: Context-aware, multi-language responses with templates
- **Scheduler**: Task scheduling with daily/interval/once triggers and persistence
- **Reasoning Layer**: LLM-powered intent inference via Ollama (qwen2.5:7b) with fallback
- **Execution Safety**: Validation, file-system safety, and git checkpoints for developer operations

### Supported Languages
- Arabic (العربية)
- Turkish (Türkçe)
- English

### Built-in Skills
- **Application Management**: Open/close applications (Chrome, Firefox, Office, Spotify, Discord, Telegram, etc.)
- **Personal Assistant Actions**: Open files, read text files, summarize logs
- **Web Search**: Multi-engine search (DuckDuckGo, Bing, Yahoo)
- **YouTube Integration**: Search and play videos
- **System Commands**: Shutdown, restart, lock screen, sleep (with safety measures)
- **Memory Management**: Store and **recall** user preferences and habits
- **Selection System**: Choose from search results and lists
- **Developer Tools**: Code inspection, test execution, AI-powered bug fixing with git safety
- **Scheduler**: Create daily/interval tasks and stop all scheduled tasks

### Safety Features
- Confidence-based command validation
- Destructive command protection
- Permission-based skill execution
- Context-aware safety thresholds
- Git checkpoints and automatic rollback for developer operations
- File-system backups before any patch application

## 🚀 Quick Start

### Installation
```bash
npm install
npm run build
npm run dev
```

If your environment cannot build optional native dependencies:

```bash
npm install --omit=optional
```

### Basic Usage
```bash
# Start the assistant
npm run dev

# In the CLI, try these commands:
افتح كروم                         # Open Chrome
دور لي فيديوهات عن البرمجة        # Find videos about programming
أعد التشغيل                       # Restart computer
ابحث عن طريقة عمل الكيك           # Search how to make cake
شغل سبوتيفاي                      # Play Spotify
1                                  # Select item #1 from previous results
تذكر أنني أفضل الوضع الداكن       # Store preference
شو تعرف عني                       # Recall stored memories
كل يوم 08:00 افتح كروم            # Schedule Chrome to open daily at 08:00
أوقف المهام                       # Stop all scheduled tasks
```

### CLI Commands
- `help` - Show help message
- `memory` - Show memory insights
- `context` - Show current context
- `clear` - Clear conversation context
- `ptt <path>` - Push-to-talk from audio file
- `تكلم <path>` - Push-to-talk from audio file (Arabic command)
- `exit/quit` - Exit the assistant

## 🧠 Architecture

### Smart Memory System
```typescript
interface MemoryManager {
  // Short-term memory (last 5-10 commands)
  getShortTermMemory(): ShortTermMemory | null;
  updateShortTermMemory(data: Partial<ShortTermMemory>): void;
  
  // Long-term memory (habits, patterns)
  getLongTermMemories(): LongTermMemory[];
  addLongTermMemory(memory: LongTermMemory): void;
  
  // User preferences
  getPreferences(): PreferenceMemory;
  updatePreferences(prefs: Partial<PreferenceMemory>): void;
}
```

### Context Management
```typescript
interface ContextManager {
  getContext(): ConversationContext;
  updateContext(updates: Partial<ConversationContext>): void;
  isFollowUpRequired(intent: Intent): boolean;
  getMissingContext(intent: Intent): string[];
}
```

### Intent Processing
```typescript
interface IntentEngine {
  classify(text: string, context: ConversationContext): Promise<Intent>;
  extractEntities(text: string, intent: Intent): Promise<Intent>;
  calculateConfidence(intent: Intent, context: ConversationContext): number;
}
```

## 🛠️ Development

### Project Structure
```
src/
├── types/              # TypeScript interfaces and shared types
├── memory/             # Memory management (short-term, long-term, preferences)
├── context/            # Context and conversation state management
├── intent/             # Intent classification engine (regex + LLM fallback)
├── skills/             # Skill implementations (9 skills)
│   ├── ApplicationSkill.ts
│   ├── WebSearchSkill.ts
│   ├── YouTubeSkill.ts
│   ├── SystemSkill.ts
│   ├── SelectionSkill.ts
│   ├── MemorySkill.ts       # Supports store and recall
│   ├── SchedulerSkill.ts    # Schedule and stop tasks
│   ├── PersonalAssistantSkill.ts
│   ├── DeveloperSkill.ts
│   └── SkillRouter.ts
├── response/           # Response generation with multi-language templates
├── voice/              # Voice input/output (Whisper STT, Edge TTS)
├── reasoning/          # LLM reasoning (Ollama) and patch generation
├── scheduler/          # Task scheduler (daily/interval/once triggers)
├── execution/          # Command execution, validation, and safety engines
├── AIAssistant.ts      # Main orchestrator
└── main.ts             # CLI entry point
```

### Adding New Skills
```typescript
export class MySkill implements Skill {
  name = 'MySkill';
  supported_intents = ['my_intent'];

  validate(intent: Intent, context: ConversationContext): boolean {
    // Validation logic
    return true;
  }

  async execute(intent: Intent, context: ConversationContext): Promise<SkillResult> {
    // Execution logic
    return {
      success: true,
      data: { /* result data */ },
      suggested_actions: ['Next action']
    };
  }
}
```

### Memory Storage
The assistant stores memories in JSON files:
- `data/memories/short_term.json` - Recent commands
- `data/memories/long_term.json` - Habits and patterns
- `data/memories/preferences.json` - User preferences

## 🔧 Configuration

### Safety Settings
```typescript
const safetyConfig = {
  min_confidence_threshold: 0.85,
  destructive_commands: ['delete', 'format', 'destroy'],
  confirmation_required_patterns: ['shutdown', 'restart'],
  max_retry_attempts: 3
};
```

### Response Templates
Multi-language response templates are configurable in the ResponseGenerator:
- Arabic templates for native speakers
- Turkish templates for Turkish users
- English templates for international users

## 📊 Memory Insights

The assistant tracks:
- **Habits**: Repeated behaviors (3+ occurrences)
- **Patterns**: Recent usage trends (7-day window)
- **Preferences**: User settings and choices

Example memory insights:
```
🧠 Memory Insights:
Language: ar
Browser: chrome
Voice Mode: ON

Habits:
  - User searches YouTube for programming tutorials frequently (5 times)
  - User opens Chrome every morning (3 times)

Recent Patterns:
  - Programming tutorial searches (3 times)
  - Arabic language preference (consistent)
```

### Memory Recall
Ask the assistant to recall what it knows about you:
```
# Arabic
شو تعرف عني
ايش تعرف عني
اعرض الذاكرة

# Turkish
beni ne biliyorsun
belleğimi göster

# English
show my memory
what do you remember
```

## ⏰ Scheduler

Schedule tasks to run automatically:
```
# Arabic - schedule Chrome to open daily at 08:00
كل يوم 08:00 افتح كروم

# Arabic - stop all scheduled tasks
أوقف المهام

# Turkish - schedule a task
her gün 09:00 chrome aç

# English - stop tasks
stop all tasks
```

Scheduled tasks are persisted to `data/scheduler/tasks.json` and resume across sessions.

## 🔄 Context Awareness

The assistant maintains context across conversations:
- **Active Skills**: Currently active capabilities
- **Active Topics**: Ongoing conversation themes
- **Awaiting Follow-up**: Pending user responses
- **Conversation History**: Last 10 interactions

## 🛡️ Safety Features

### Confidence-Based Validation
- Commands require minimum confidence scores
- System commands need 90%+ confidence
- Destructive commands need 85%+ confidence

### Permission System
- Skills validate permissions before execution
- System commands require elevated confidence
- Ambiguous commands are rejected

### Context Validation
- Follow-up commands require active context
- Missing context triggers clarification requests
- Safety patterns prevent accidental execution

## 🌐 Multi-Language Support

### Intent Recognition
The assistant recognizes commands in:
- **Arabic**: افتح، أغلق، ابحث، دور، شغل، تذكر، احفظ، شو تعرف عني، جدول، أوقف
- **Turkish**: aç, kapat, ara, bul, çal, hatırla, kaydet, beni ne biliyorsun, zamanla, durdur
- **English**: open, close, search, find, play, remember, save, show my memory, schedule, stop tasks

### Response Generation
Context-aware responses in the user's preferred language with:
- Cultural appropriateness
- Localized suggestions
- Language-specific formatting

## 💻 Developer Tools

The DeveloperSkill enables AI-assisted code operations with safety mechanisms:

```
# Arabic
تفحص src/main.ts        # Inspect a file
شغّل الاختبارات          # Run tests
أصلح المشكلة src/main.ts # Fix a bug with AI

# English
inspect src/main.ts
run tests
fix src/main.ts
```

### Safety Mechanisms
- **Git checkpoints**: Automatic git commit before any patch
- **File backups**: Backup copy before applying changes
- **Semantic validation**: Post-patch diff review
- **Confirmation required**: Preview patch before applying
- **Rollback on failure**: Automatic restore on semantic failure

## 📈 Performance

- **Response Time**: < 1 second for local operations
- **LLM Inference**: 5-30 seconds (depends on Ollama model)
- **Memory Usage**: Efficient JSON storage
- **Context Retention**: 5-minute timeout
- **Conversation History**: Last 10 interactions

## 🔍 Debugging

### Session Logs
All interactions are logged to `logs/session-{timestamp}.log` with:
- Timestamps
- User inputs
- Assistant responses
- Error details

### Memory Inspection
Use CLI commands to inspect system state:
- `memory` - Show memory insights
- `context` - Show current context
- `help` - Show available commands

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new skills
4. Update documentation
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the session logs in `logs/`
2. Use the `help` command in the CLI
3. Review the memory insights with `memory`
4. Check context state with `context`

---

**AgentAI V2** - Your intelligent multi-language assistant, built with ❤️ and advanced AI architecture.
