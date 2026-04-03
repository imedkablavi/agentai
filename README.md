# AGENTai

A personal + developer assistant with Arabic-first commands, safe execution, and voice support.

## Features

### Core Architecture
- **Smart Memory System**: Short-term, long-term, and preference memory
- **Context Manager**: Maintains conversation state and active topics
- **Intent Engine**: Multi-language intent classification with confidence scoring
- **Skill Router**: Intelligent skill selection with permission validation
- **Response Generator**: Context-aware, multi-language responses

### Supported Languages
- Arabic (العربية)
- Turkish (Türkçe)
- English

### Built-in Skills
- **Application Management**: Open/close applications (Chrome, Firefox, Office, etc.)
- **Personal Assistant Actions**: Open files, read text files, summarize logs
- **Web Search**: Multi-engine search (DuckDuckGo, Bing, Yahoo)
- **YouTube Integration**: Search and play videos
- **System Commands**: Shutdown, restart, lock screen (with safety measures)
- **Memory Management**: Store and recall user preferences and habits
- **Selection System**: Choose from search results and lists

### Safety Features
- Confidence-based command validation
- Destructive command protection
- Permission-based skill execution
- Context-aware safety thresholds

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
افتح كروم                    # Open Chrome
dور لي فيديوهات عن البرمجة   # Find videos about programming
أطفئ الجهاز                  # Shutdown computer
ابحث عن طريقة عمل الكيك      # Search how to make cake
شغل سبوتيفاي                 # Play Spotify
1                             # Select item #1 from previous results
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
├── types/              # TypeScript interfaces
├── memory/             # Memory management
├── context/            # Context management
├── intent/             # Intent classification
├── skills/             # Skill implementations
├── response/           # Response generation
├── AIAssistant.ts      # Main orchestrator
└── main.ts            # CLI entry point
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
- **Arabic**: افتح، أغلق، ابحث، دور، شغل
- **Turkish**: aç, kapat, ara, bul, çal
- **English**: open, close, search, find, play

### Response Generation
Context-aware responses in the user's preferred language with:
- Cultural appropriateness
- Localized suggestions
- Language-specific formatting

## 📈 Performance

- **Response Time**: < 1 second average
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

**Windows AI Assistant V2** - Your intelligent companion for Windows, built with ❤️ and advanced AI architecture.
