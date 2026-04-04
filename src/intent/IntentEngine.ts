import { 
  IntentEngine as IIntentEngine, 
  Intent, 
  ConversationContext 
} from '../types';

export class IntentEngine implements IIntentEngine {
  private intentPatterns = {
    ar: {
      'schedule_task': [
        /كل\s+يوم\s+(?:الصبح|صباحًا|صباحا)?\s*(?:عند|على)?\s*(\d{1,2}:\d{2})?\s*(.+)/i,
        /جَدْوِل\s+(.+)\s+كل\s+يوم\s+(\d{1,2}:\d{2})/i
      ],
      'stop_tasks': [
        /أوقف\s+المهام/i,
        /ألغِ\s+هذا/i
      ],
      // System Control
      'open_application': [
        /افتح\s+(.+)/i,
        /شغل\s+(.+)/i,
        /ابدأ\s+(.+)/i,
        /افتحلي\s+(.+)/i
      ],
      'close_application': [
        /أغلق\s+(.+)/i,
        /اقفل\s+(.+)/i,
        /أطفئ\s+(.+)/i,
        /أنهي\s+(.+)/i
      ],
      'search_web': [
        /ابحث\s+عن\s+(.+)/i,
        /دور\s+لي\s+على\s+(.+)/i,
        /لقني\s+(.+)/i,
        /شوف\s+لي\s+(.+)/i
      ],
      'youtube_search': [
        /دور\s+لي\s+فيديو\s+عن\s+(.+)/i,
        /شوف\s+لي\s+فيديو\s+(.+)/i,
        /يوتيوب\s+(.+)/i,
        /فيديو\s+(.+)/i
      ],
      'system_command': [
        /أطفئ\s+الجهاز/i,
        /أعد\s+التشغيل/i,
        /قفل\s+الشاشة/i,
        /تشغيل\s+الحاسوب/i
      ],
      'select_item': [
        /اختر\s+رقم\s+(\d+)/i,
        /اختار\s+(\d+)/i,
        /شغل\s+رقم\s+(\d+)/i,
        /نفذ\s+رقم\s+(\d+)/i
      ],
      'continue_action': [
        /كمّل/i,
        /استمر/i,
        /أكمل/i,
        /تمام/i,
        /نفذ/i
      ],
      'memory_command': [
        /تذكر\s+(.+)/i,
        /احفظ\s+(.+)/i,
        /من\s+الآن\s+فصاعدًا\s+(.+)/i
      ],
      'recall_memory': [
        /ايش\s+تعرف\s+عني/i,
        /شو\s+تعرف\s+عني/i,
        /ماذا\s+تتذكر/i,
        /قل\s+لي\s+ذاكرتك/i,
        /اعرض\s+الذاكرة/i,
        /شو\s+في\s+الذاكرة/i
      ],
      'dev_test': [
        /شغّل\s+الاختبارات/i,
        /شغل\s+الاختبار/i,
        /اختبر\s+(.+)/i
      ],
      'dev_fix': [
        /صلّح\s+الخطأ/i,
        /صلح\s+لمشكلة/i,
        /أصلح\s+(.+)/i,
        /صلّح\s+المشكلة/i
      ],
      'open_file': [
        /افتح\s+الملف\s+(.+)/i,
        /افتح\s+ملف\s+(.+)/i
      ],
      'read_file': [
        /اقرأ\s+الملف\s+(.+)/i,
        /اقرأ\s+لي\s+الخطأ/i,
        /اقرأ\s+(.+)/i
      ],
      'summarize_logs': [
        /لخّص\s+السجلات/i,
        /لخص\s+اللوغ/i,
        /اعرض\s+الاخطاء/i
      ]
    },
    tr: {
      'open_application': [
        /aç\s+(.+)/i,
        /başlat\s+(.+)/i,
        /çalıştır\s+(.+)/i
      ],
      'close_application': [
        /kapat\s+(.+)/i,
        /sonlandır\s+(.+)/i,
        /bitir\s+(.+)/i
      ],
      'search_web': [
        /ara\s+(.+)/i,
        /bul\s+(.+)/i,
        /search\s+(.+)/i
      ],
      'youtube_search': [
        /youtube\s+(.+)/i,
        /video\s+ara\s+(.+)/i,
        /bul\s+video\s+(.+)/i
      ],
      'system_command': [
        /bilgisayarı\s+kapat/i,
        /yeniden\s+başlat/i,
        /ekranı\s+kilit/i
      ],
      'select_item': [
        /seç\s+(\d+)/i,
        /numara\s+(\d+)/i,
        /aç\s+numara\s+(\d+)/i
      ],
      'continue_action': [
        /devam/i,
        /tamam/i,
        /peki/i,
        /yap/i
      ],
      'memory_command': [
        /hatırla\s+(.+)/i,
        /kaydet\s+(.+)/i,
        /bundan\s+sonra\s+(.+)/i
      ],
      'recall_memory': [
        /beni\s+ne\s+biliyorsun/i,
        /ne\s+hatırlıyorsun/i,
        /belleğimi\s+göster/i,
        /bellekte\s+ne\s+var/i
      ],
      'dev_test': [
        /testleri\s+çalıştır/i,
        /test\s+et\s+(.+)/i
      ],
      'dev_fix': [
        /hatayı\s+düzelt/i,
        /düzelt\s+(.+)/i
      ]
    },
    en: {
      'schedule_task': [
        /every\s+day\s+at\s+(\d{1,2}:\d{2})\s*(.+)/i,
        /schedule\s+(.+)\s+daily\s+at\s+(\d{1,2}:\d{2})/i
      ],
      'stop_tasks': [
        /stop\s+tasks/i,
        /cancel\s+this/i
      ],
      'open_application': [
        /open\s+(.+)/i,
        /start\s+(.+)/i,
        /launch\s+(.+)/i,
        /run\s+(.+)/i
      ],
      'close_application': [
        /close\s+(.+)/i,
        /quit\s+(.+)/i,
        /exit\s+(.+)/i,
        /terminate\s+(.+)/i
      ],
      'search_web': [
        /search\s+for\s+(.+)/i,
        /find\s+(.+)/i,
        /look\s+up\s+(.+)/i,
        /google\s+(.+)/i
      ],
      'youtube_search': [
        /youtube\s+(.+)/i,
        /search\s+youtube\s+for\s+(.+)/i,
        /find\s+video\s+(.+)/i,
        /watch\s+(.+)/i
      ],
      'system_command': [
        /shutdown/i,
        /restart/i,
        /lock\s+screen/i,
        /sleep/i
      ],
      'select_item': [
        /select\s+(\d+)/i,
        /choose\s+(\d+)/i,
        /pick\s+(\d+)/i,
        /open\s+number\s+(\d+)/i
      ],
      'continue_action': [
        /continue/i,
        /proceed/i,
        /okay/i,
        /go\s+ahead/i,
        /execute/i,
        /do\s+it/i
      ],
      'memory_command': [
        /remember\s+(.+)/i,
        /save\s+(.+)/i,
        /from\s+now\s+on\s+(.+)/i
      ],
      'recall_memory': [
        /what\s+do\s+you\s+know\s+about\s+me/i,
        /what\s+do\s+you\s+remember/i,
        /show\s+my\s+memory/i,
        /show\s+memories/i,
        /recall\s+memory/i,
        /what's\s+in\s+memory/i
      ],
      'dev_test': [
        /run\s+tests?/i,
        /test\s+(.+)/i
      ],
      'dev_fix': [
        /fix\s+bug/i,
        /fix\s+error/i,
        /fix\s+(.+)/i
      ],
      'open_file': [
        /open\s+file\s+(.+)/i
      ],
      'read_file': [
        /read\s+file\s+(.+)/i,
        /read\s+the\s+error/i
      ],
      'summarize_logs': [
        /summarize\s+logs?/i,
        /show\s+errors?/i
      ]
    }
  };

  private entityPatterns = {
    application: [
      /(chrome|firefox|edge|word|excel|powerpoint|notepad|calculator|spotify|discord|telegram)/i,
      /(متصفح|وورد|اكسل|باوربوينت|نوتباد|حاسبة|سبوتيفاي|ديسكورد|تليغرام)/i,
      /(tarayıcı|word|excel|powerpoint|notepad|hesap makinesi|spotify|discord|telegram)/i
    ],
    url: [
      /https?:\/\/[^\s]+/i,
      /www\.[^\s]+/i,
      /[^\s]+\.com/i,
      /[^\s]+\.net/i,
      /[^\s]+\.org/i
    ],
    number: [
      /\b\d+\b/g
    ]
  };

  async classify(text: string, context: ConversationContext): Promise<Intent> {
    const language = this.detectLanguage(text);
    const patterns = this.intentPatterns[language] || this.intentPatterns.ar;
    
    let bestIntent = {
      name: 'unknown',
      confidence: 0.0,
      language,
      context_required: false,
      entities: {},
      raw_text: text
    };

    for (const [intentName, regexPatterns] of Object.entries(patterns)) {
      for (const pattern of regexPatterns) {
        const match = text.match(pattern);
        if (match) {
          const confidence = this.calculatePatternConfidence(text, pattern, match);
          
          if (confidence > bestIntent.confidence) {
            bestIntent = {
              name: intentName,
              confidence,
              language,
              context_required: this.isContextRequired(intentName),
              entities: {
                query: match[1] || '',
                application: this.extractApplication(match[1] || '')
              },
              raw_text: text
            };
          }
        }
      }
    }

    // Check for follow-up intents
    if (context.awaiting_followup && bestIntent.name === 'unknown') {
      bestIntent = this.inferFollowUpIntent(text, context, language);
    }

    // Boost confidence based on context
    bestIntent.confidence = this.calculateConfidence(bestIntent, context);

    return bestIntent;
  }

  async extractEntities(text: string, intent: Intent): Promise<Intent> {
    const entities = { ...intent.entities };

    // Extract applications
    for (const pattern of this.entityPatterns.application) {
      const match = text.match(pattern);
      if (match) {
        entities.application = match[1].toLowerCase();
        break;
      }
    }

    // Extract URLs
    for (const pattern of this.entityPatterns.url) {
      const match = text.match(pattern);
      if (match) {
        entities.url = match[0];
        break;
      }
    }

    // Extract numbers
    const numberMatches = text.match(this.entityPatterns.number[0]);
    if (numberMatches) {
      entities.index = parseInt(numberMatches[0]);
    }

    // Extract search queries
    if (intent.name.includes('search') && !entities.query) {
      const queryPattern = /(?:ابحث|دور|لقني|شوف|ara|bul|search|find|look up)\s+(?:عن|لي|على|for|up)?\s*(.+)/i;
      const match = text.match(queryPattern);
      if (match) {
        entities.query = match[1].trim();
      }
    }

    if (intent.name === 'schedule_task') {
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) (entities as any).at = timeMatch[1];
      const parts = timeMatch ? text.split(timeMatch[1]) : [text];
      const q = parts[parts.length - 1]?.trim();
      if (q) entities.query = q;
    }

    if (['open_file', 'read_file', 'summarize_logs', 'dev_inspect', 'dev_test', 'dev_fix'].includes(intent.name)) {
      const pathMatch = text.match(/([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/);
      if (pathMatch) {
        entities.file_path = pathMatch[1];
      }
    }

    return {
      ...intent,
      entities
    };
  }

  calculateConfidence(intent: Intent, context: ConversationContext): number {
    let confidence = intent.confidence;

    // Context-based confidence adjustment
    if (context.awaiting_followup && intent.context_required) {
      confidence += 0.2;
    }

    if (context.active_skill && intent.name.includes('continue')) {
      confidence += 0.3;
    }

    // Language consistency boost
    if (context.conversation_history.length > 0) {
      const lastInteraction = this.getLastLanguageFromHistory(context);
      if (lastInteraction === intent.language) {
        confidence += 0.1;
      }
    }

    // Entity presence boost
    if (Object.keys(intent.entities).length > 0) {
      confidence += 0.1 * Object.keys(intent.entities).length;
    }

    // Cap confidence at 1.0
    return Math.min(confidence, 1.0);
  }

  private detectLanguage(text: string): 'ar' | 'tr' | 'en' {
    const arabicChars = /[\u0600-\u06FF]/;
    const turkishChars = /[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/;
    
    if (arabicChars.test(text)) return 'ar';
    if (turkishChars.test(text)) return 'tr';
    return 'en';
  }

  private calculatePatternConfidence(text: string, pattern: RegExp, match: RegExpMatchArray): number {
    const textLength = text.trim().length;
    const matchLength = match[0].length;
    
    let confidence = matchLength / textLength;
    
    // Boost confidence for exact matches
    if (match[0].length === text.trim().length) {
      confidence += 0.2;
    }
    
    // Boost for clear command structure
    if (text.includes(' ') && match.length > 1) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.9);
  }

  private isContextRequired(intentName: string): boolean {
    const contextRequiredIntents = [
      'select_item', 'continue_action', 'memory_command', 'recall_memory'
    ];
    
    return contextRequiredIntents.some(intent => intentName.includes(intent));
  }

  private inferFollowUpIntent(text: string, context: ConversationContext, language: 'ar' | 'tr' | 'en'): Intent {
    const numericPattern = /^\d+$/;
    const continuePattern = {
      ar: /(كمّل|استمر|أكمل|تمام|نفذ)/i,
      tr: /(devam|tamam|peki|yap)/i,
      en: /(continue|proceed|okay|go ahead|execute)/i
    };
    const confirmPattern = {
      ar: /(نعم|أكيد|تمام)/i,
      tr: /(evet|onay)/i,
      en: /(yes|confirm)/i
    };

    if (numericPattern.test(text.trim())) {
      return {
        name: 'select_item',
        confidence: 0.8,
        language,
        context_required: true,
        entities: { index: parseInt(text.trim()) },
        raw_text: text
      };
    }

    if (continuePattern[language].test(text)) {
      return {
        name: 'continue_action',
        confidence: 0.85,
        language,
        context_required: true,
        entities: {},
        raw_text: text
      };
    }

    if (confirmPattern[language].test(text)) {
      return {
        name: 'confirm_action',
        confidence: 0.9,
        language,
        context_required: true,
        entities: {},
        raw_text: text
      };
    }

    return {
      name: 'unknown',
      confidence: 0.1,
      language,
      context_required: false,
      entities: {},
      raw_text: text
    };
  }

  private extractApplication(text: string): string | undefined {
    const appMap = {
      'chrome': ['chrome', 'متصفح', 'tarayıcı'],
      'firefox': ['firefox', 'فايرفوكس'],
      'word': ['word', 'وورد'],
      'excel': ['excel', 'اكسل'],
      'notepad': ['notepad', 'نوتباد', 'not defteri'],
      'calculator': ['calculator', 'حاسبة', 'hesap makinesi']
    };

    for (const [app, keywords] of Object.entries(appMap)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        return app;
      }
    }

    return undefined;
  }

  private getLastLanguageFromHistory(context: ConversationContext): string {
    const lastMessage = context.conversation_history
      .filter(h => h.includes('User:'))
      .pop();
    
    if (!lastMessage) return 'ar';
    
    const messageText = lastMessage.split('User: ')[1];
    return this.detectLanguage(messageText);
  }
}
