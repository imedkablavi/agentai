import {
  IntentEngine as IIntentEngine,
  Intent,
  ConversationContext,
} from '../types';

type Language = 'ar' | 'tr' | 'en';
type PatternMap = Record<Language, Record<string, RegExp[]>>;

export class IntentEngine implements IIntentEngine {
  private readonly intentPatterns: PatternMap = {
    ar: {
      schedule_task: [
        /كل\s+يوم\s+(?:الصبح|صباحًا|صباحا)?\s*(?:عند|على)?\s*(\d{1,2}:\d{2})?\s*(.+)/i,
        /جَدْوِل\s+(.+)\s+كل\s+يوم\s+(\d{1,2}:\d{2})/i,
      ],
      stop_tasks: [
        /أوقف\s+المهام/i,
        /ألغِ\s+هذا/i,
      ],
      open_application: [
        /افتح\s+(.+)/i,
        /شغل\s+(.+)/i,
        /ابدأ\s+(.+)/i,
        /افتحلي\s+(.+)/i,
      ],
      close_application: [
        /أغلق\s+(.+)/i,
        /اقفل\s+(.+)/i,
        /أطفئ\s+(.+)/i,
        /أنهي\s+(.+)/i,
      ],
      search_web: [
        /ابحث\s+عن\s+(.+)/i,
        /دور\s+لي\s+على\s+(.+)/i,
        /لقني\s+(.+)/i,
        /شوف\s+لي\s+(.+)/i,
      ],
      youtube_search: [
        /دور\s+لي\s+فيديو\s+عن\s+(.+)/i,
        /شوف\s+لي\s+فيديو\s+(.+)/i,
        /يوتيوب\s+(.+)/i,
        /فيديو\s+(.+)/i,
      ],
      system_command: [
        /^\s*أطفئ\s+(?:الجهاز|الكمبيوتر)\s*$/i,
        /^\s*إيقاف\s+التشغيل\s*$/i,
        /^\s*(?:أعد|إعادة)\s+التشغيل\s*$/i,
        /^\s*(?:قفل|اقفل)\s+الشاشة\s*$/i,
        /^\s*وضع\s+السبات\s*$/i,
      ],
      select_item: [
        /اختر\s+رقم\s+(\d+)/i,
        /اختار\s+(\d+)/i,
        /شغل\s+رقم\s+(\d+)/i,
        /نفذ\s+رقم\s+(\d+)/i,
      ],
      continue_action: [
        /كمّل/i,
        /استمر/i,
        /أكمل/i,
        /تمام/i,
        /نفذ/i,
      ],
      memory_command: [
        /تذكر\s+(.+)/i,
        /احفظ\s+(.+)/i,
        /من\s+الآن\s+فصاعدًا\s+(.+)/i,
      ],
      dev_inspect: [
        /راجع\s+هذا\s+الملف/i,
        /افتح\s+المشروع/i,
        /تفحص\s+(.+)/i,
        /راجع\s+(.+)/i,
      ],
      dev_test: [
        /شغّل\s+الاختبارات/i,
        /شغل\s+الاختبار/i,
        /اختبر\s+(.+)/i,
      ],
      dev_fix: [
        /صلّح\s+الخطأ/i,
        /صلح\s+لمشكلة/i,
        /أصلح\s+(.+)/i,
        /صلّح\s+المشكلة/i,
      ],
      open_file: [
        /افتح\s+الملف\s+(.+)/i,
        /افتح\s+ملف\s+(.+)/i,
      ],
      read_file: [
        /اقرأ\s+الملف\s+(.+)/i,
        /اقرأ\s+لي\s+الخطأ/i,
        /اقرأ\s+(.+)/i,
      ],
      summarize_logs: [
        /لخّص\s+السجلات/i,
        /لخص\s+اللوغ/i,
        /اعرض\s+الاخطاء/i,
      ],
    },
    tr: {
      schedule_task: [
        /her\s+gün\s+saat\s+(\d{1,2}:\d{2})\s+(.+)/i,
        /(.+)\s+her\s+gün\s+saat\s+(\d{1,2}:\d{2})/i,
      ],
      stop_tasks: [
        /görevleri\s+durdur/i,
        /bu\s+görevi\s+iptal\s+et/i,
      ],
      open_application: [
        /aç\s+(.+)/i,
        /başlat\s+(.+)/i,
        /çalıştır\s+(.+)/i,
      ],
      close_application: [
        /kapat\s+(.+)/i,
        /sonlandır\s+(.+)/i,
        /bitir\s+(.+)/i,
      ],
      search_web: [
        /ara\s+(.+)/i,
        /bul\s+(.+)/i,
        /search\s+(.+)/i,
      ],
      youtube_search: [
        /youtube\s+(.+)/i,
        /video\s+ara\s+(.+)/i,
        /bul\s+video\s+(.+)/i,
      ],
      system_command: [
        /^\s*bilgisayarı\s+kapat\s*$/i,
        /^\s*kapat\s+sistem\s*$/i,
        /^\s*yeniden\s+başlat\s*$/i,
        /^\s*ekranı\s+kilit\s*$/i,
        /^\s*uyku\s+modu\s*$/i,
      ],
      select_item: [
        /seç\s+(\d+)/i,
        /numara\s+(\d+)/i,
        /aç\s+numara\s+(\d+)/i,
      ],
      continue_action: [
        /devam/i,
        /tamam/i,
        /peki/i,
        /yap/i,
      ],
      memory_command: [
        /hatırla\s+(.+)/i,
        /kaydet\s+(.+)/i,
        /bundan\s+sonra\s+(.+)/i,
      ],
      dev_inspect: [
        /kodu\s+incele/i,
        /projeyi\s+aç/i,
        /incele\s+(.+)/i,
      ],
      dev_test: [
        /testleri\s+çalıştır/i,
        /test\s+et\s+(.+)/i,
      ],
      dev_fix: [
        /hatayı\s+düzelt/i,
        /düzelt\s+(.+)/i,
      ],
      open_file: [
        /dosyayı\s+aç\s+(.+)/i,
        /dosya\s+aç\s+(.+)/i,
      ],
      read_file: [
        /dosyayı\s+oku\s+(.+)/i,
        /dosya\s+oku\s+(.+)/i,
      ],
      summarize_logs: [
        /günlükleri\s+özetle/i,
        /hataları\s+göster/i,
      ],
    },
    en: {
      schedule_task: [
        /every\s+day\s+at\s+(\d{1,2}:\d{2})\s*(.+)/i,
        /schedule\s+(.+)\s+daily\s+at\s+(\d{1,2}:\d{2})/i,
      ],
      stop_tasks: [
        /stop\s+tasks/i,
        /cancel\s+this/i,
      ],
      open_application: [
        /open\s+(.+)/i,
        /start\s+(.+)/i,
        /launch\s+(.+)/i,
        /run\s+(.+)/i,
      ],
      close_application: [
        /close\s+(.+)/i,
        /quit\s+(.+)/i,
        /exit\s+(.+)/i,
        /terminate\s+(.+)/i,
      ],
      search_web: [
        /search\s+for\s+(.+)/i,
        /find\s+(.+)/i,
        /look\s+up\s+(.+)/i,
        /google\s+(.+)/i,
      ],
      youtube_search: [
        /youtube\s+(.+)/i,
        /search\s+youtube\s+for\s+(.+)/i,
        /find\s+video\s+(.+)/i,
        /watch\s+(.+)/i,
      ],
      system_command: [
        /^\s*(?:shutdown|shut\s+down|power\s+off)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i,
        /^\s*(?:restart|reboot)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i,
        /^\s*lock\s+(?:the\s+)?(?:screen|computer|pc)\s*$/i,
        /^\s*(?:sleep|hibernate|standby)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i,
      ],
      select_item: [
        /select\s+(\d+)/i,
        /choose\s+(\d+)/i,
        /pick\s+(\d+)/i,
        /open\s+number\s+(\d+)/i,
      ],
      continue_action: [
        /continue/i,
        /proceed/i,
        /okay/i,
        /go\s+ahead/i,
        /execute/i,
        /do\s+it/i,
      ],
      memory_command: [
        /remember\s+(.+)/i,
        /save\s+(.+)/i,
        /from\s+now\s+on\s+(.+)/i,
      ],
      dev_inspect: [
        /inspect\s+code/i,
        /review\s+this\s+file/i,
        /open\s+project/i,
        /inspect\s+(.+)/i,
        /review\s+(.+)/i,
      ],
      dev_test: [
        /run\s+tests?/i,
        /test\s+(.+)/i,
      ],
      dev_fix: [
        /fix\s+bug/i,
        /fix\s+error/i,
        /fix\s+(.+)/i,
      ],
      open_file: [
        /open\s+file\s+(.+)/i,
      ],
      read_file: [
        /read\s+file\s+(.+)/i,
        /read\s+the\s+error/i,
      ],
      summarize_logs: [
        /summarize\s+logs?/i,
        /show\s+errors?/i,
      ],
    },
  };

  // Specific intents win ties over broad language patterns. This prevents generic
  // "open/close" expressions from shadowing file/system-control semantics.
  private readonly intentPriority: Record<string, number> = {
    system_command: 100,
    open_file: 95,
    read_file: 95,
    summarize_logs: 95,
    dev_fix: 90,
    dev_test: 90,
    dev_inspect: 90,
    schedule_task: 85,
    stop_tasks: 85,
    select_item: 80,
    memory_command: 75,
    youtube_search: 65,
    search_web: 60,
    close_application: 50,
    open_application: 50,
    continue_action: 40,
  };

  private readonly entityPatterns = {
    application: [
      /(chrome|firefox|word|excel|notepad|calculator|spotify|discord|telegram)/i,
      /(متصفح|كروم|فايرفوكس|وورد|اكسل|نوتباد|حاسبة|سبوتيفاي|ديسكورد|تليغرام)/i,
      /(tarayıcı|chrome|firefox|word|excel|notepad|hesap makinesi|spotify|discord|telegram)/i,
    ],
    url: [
      /https?:\/\/[^\s]+/i,
      /www\.[^\s]+/i,
      /[^\s]+\.com/i,
      /[^\s]+\.net/i,
      /[^\s]+\.org/i,
    ],
    number: /\b\d+\b/,
  };

  async classify(text: string, context: ConversationContext): Promise<Intent> {
    const language = this.detectLanguage(text);
    const patterns = this.intentPatterns[language] || this.intentPatterns.ar;
    let bestIntent: Intent = {
      name: 'unknown',
      confidence: 0,
      language,
      context_required: false,
      entities: {},
      raw_text: text,
    };

    for (const [intentName, regexPatterns] of Object.entries(patterns)) {
      for (const pattern of regexPatterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const confidence = this.calculatePatternConfidence(text, match);
        const higherConfidence = confidence > bestIntent.confidence;
        const equalConfidence = Math.abs(confidence - bestIntent.confidence) < Number.EPSILON;
        const higherPriority = this.priority(intentName) > this.priority(bestIntent.name);

        if (higherConfidence || (equalConfidence && higherPriority)) {
          bestIntent = {
            name: intentName,
            confidence,
            language,
            context_required: this.isContextRequired(intentName),
            entities: this.initialEntities(intentName, text, match),
            raw_text: text,
          };
        }
      }
    }

    if (context.awaiting_followup && bestIntent.name === 'unknown') {
      bestIntent = this.inferFollowUpIntent(text, language);
    }

    bestIntent.confidence = this.calculateConfidence(bestIntent, context);
    return bestIntent;
  }

  async extractEntities(text: string, intent: Intent): Promise<Intent> {
    const entities = { ...intent.entities };
    const application = this.extractApplication(text);
    if (application) entities.application = application;

    for (const pattern of this.entityPatterns.url) {
      const match = text.match(pattern);
      if (match) {
        entities.url = match[0];
        break;
      }
    }

    const numberMatch = text.match(this.entityPatterns.number);
    if (numberMatch) entities.index = parseInt(numberMatch[0], 10);

    if (intent.name.includes('search') && !entities.query) {
      const queryMatch = text.match(/(?:ابحث|دور|لقني|شوف|ara|bul|search|find|look up)\s+(?:عن|لي|على|for|up)?\s*(.+)/i);
      if (queryMatch) entities.query = queryMatch[1].trim();
    }

    if (intent.name === 'schedule_task') {
      Object.assign(entities, this.extractScheduleEntities(text, intent.language));
    }

    if (['open_file', 'read_file', 'summarize_logs', 'dev_inspect', 'dev_test', 'dev_fix'].includes(intent.name)) {
      const pathMatch = text.match(/([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/);
      if (pathMatch) entities.file_path = pathMatch[1];
    }

    return { ...intent, entities };
  }

  calculateConfidence(intent: Intent, context: ConversationContext): number {
    let confidence = intent.confidence;

    if (context.awaiting_followup && intent.context_required) confidence += 0.2;
    if (context.active_skill && intent.name.includes('continue')) confidence += 0.3;

    if (context.conversation_history.length > 0) {
      const lastLanguage = this.getLastLanguageFromHistory(context);
      if (lastLanguage === intent.language) confidence += 0.1;
    }

    const meaningfulEntities = Object.values(intent.entities).filter(value => value !== undefined && value !== null && value !== '').length;
    confidence += 0.1 * meaningfulEntities;
    return Math.min(confidence, 1);
  }

  private initialEntities(intentName: string, text: string, match: RegExpMatchArray): Intent['entities'] {
    const entities: Intent['entities'] = {};
    const application = this.extractApplication(text);
    if (application) entities.application = application;

    if (intentName === 'select_item' && match[1]) entities.index = parseInt(match[1], 10);
    if (intentName === 'schedule_task') return { ...entities, ...this.extractScheduleEntities(text, this.detectLanguage(text)) };

    if (match[1] && !['system_command', 'stop_tasks', 'continue_action'].includes(intentName)) {
      entities.query = match[1].trim();
    }
    return entities;
  }

  private extractScheduleEntities(text: string, language: Language): Record<string, string> {
    const timeMatch = text.match(/(\d{1,2}:\d{2})/);
    const result: Record<string, string> = {};
    if (timeMatch) result.at = timeMatch[1];

    let query = '';
    if (language === 'ar') {
      const second = text.match(/جَدْوِل\s+(.+)\s+كل\s+يوم\s+\d{1,2}:\d{2}/i);
      query = second?.[1]?.trim() || text.replace(/^كل\s+يوم\s+(?:الصبح|صباحًا|صباحا)?\s*(?:عند|على)?\s*(?:\d{1,2}:\d{2})?\s*/i, '').trim();
    } else if (language === 'tr') {
      const second = text.match(/^(.+)\s+her\s+gün\s+saat\s+\d{1,2}:\d{2}\s*$/i);
      query = second?.[1]?.trim() || text.replace(/^her\s+gün\s+saat\s+\d{1,2}:\d{2}\s*/i, '').trim();
    } else {
      const second = text.match(/schedule\s+(.+)\s+daily\s+at\s+\d{1,2}:\d{2}/i);
      query = second?.[1]?.trim() || text.replace(/^every\s+day\s+at\s+\d{1,2}:\d{2}\s*/i, '').trim();
    }

    if (query) result.query = query;
    return result;
  }

  private detectLanguage(text: string): Language {
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/.test(text)) return 'tr';
    return 'en';
  }

  private calculatePatternConfidence(text: string, match: RegExpMatchArray): number {
    const normalizedLength = Math.max(1, text.trim().length);
    let confidence = match[0].length / normalizedLength;
    if (match[0].length === normalizedLength) confidence += 0.2;
    if (text.includes(' ') && match.length > 1) confidence += 0.1;
    return Math.min(confidence, 0.9);
  }

  private isContextRequired(intentName: string): boolean {
    return ['select_item', 'continue_action', 'memory_command'].includes(intentName);
  }

  private inferFollowUpIntent(text: string, language: Language): Intent {
    const trimmed = text.trim();
    if (/^\d+$/.test(trimmed)) {
      return {
        name: 'select_item',
        confidence: 0.8,
        language,
        context_required: true,
        entities: { index: parseInt(trimmed, 10) },
        raw_text: text,
      };
    }

    const continuePattern: Record<Language, RegExp> = {
      ar: /^\s*(?:كمّل|استمر|أكمل|نفذ)\s*$/i,
      tr: /^\s*(?:devam|peki|yap)\s*$/i,
      en: /^\s*(?:continue|proceed|okay|go\s+ahead|execute|do\s+it)\s*$/i,
    };
    const confirmPattern: Record<Language, RegExp> = {
      ar: /^\s*(?:نعم|أكيد|تمام)\s*$/i,
      tr: /^\s*(?:evet|onay|tamam)\s*$/i,
      en: /^\s*(?:yes|confirm|approve)\s*$/i,
    };

    if (confirmPattern[language].test(trimmed)) {
      return { name: 'confirm_action', confidence: 0.9, language, context_required: true, entities: {}, raw_text: text };
    }
    if (continuePattern[language].test(trimmed)) {
      return { name: 'continue_action', confidence: 0.85, language, context_required: true, entities: {}, raw_text: text };
    }
    return { name: 'unknown', confidence: 0.1, language, context_required: false, entities: {}, raw_text: text };
  }

  private extractApplication(text: string): string | undefined {
    const normalized = text.toLocaleLowerCase();
    const appMap: Record<string, string[]> = {
      chrome: ['chrome', 'كروم', 'متصفح', 'tarayıcı'],
      firefox: ['firefox', 'فايرفوكس'],
      word: ['word', 'وورد'],
      excel: ['excel', 'اكسل'],
      notepad: ['notepad', 'نوتباد', 'not defteri'],
      calculator: ['calculator', 'حاسبة', 'hesap makinesi'],
      spotify: ['spotify', 'سبوتيفاي'],
      discord: ['discord', 'ديسكورد'],
      telegram: ['telegram', 'تليغرام', 'تلغرام'],
    };

    for (const [app, keywords] of Object.entries(appMap)) {
      if (keywords.some(keyword => normalized.includes(keyword.toLocaleLowerCase()))) return app;
    }
    return undefined;
  }

  private priority(intentName: string): number {
    return this.intentPriority[intentName] || 0;
  }

  private getLastLanguageFromHistory(context: ConversationContext): Language {
    const lastMessage = context.conversation_history.filter(item => item.includes('User:')).pop();
    if (!lastMessage) return 'ar';
    return this.detectLanguage(lastMessage.split('User: ')[1] || '');
  }
}
