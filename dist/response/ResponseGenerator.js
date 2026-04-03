"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseGenerator = void 0;
class ResponseGenerator {
    constructor() {
        this.responseTemplates = {
            ar: {
                success: {
                    search: 'لقيت {count} نتيجة. تحب أشغل أول فيديو؟',
                    application: 'تم فتح {application} بنجاح.',
                    system: 'تم تنفيذ الأمر "{command}" بنجاح.',
                    memory: 'تم حفظ الذاكرة بنجاح.',
                    selection: 'تم اختيار العنصر رقم {index} بنجاح.',
                    dev_inspect: 'تم فحص الكود {target}. النتيجة: {result}',
                    dev_test: 'تم تشغيل الاختبارات بنجاح. النتيجة: {result}',
                    dev_fix: 'تم إصلاح المشكلة في {target}.',
                    dev_fix_preview: 'تم اقتراح إصلاح لـ {target}:\n{result}'
                },
                error: {
                    general: 'حصل خطأ: {error}',
                    not_found: 'ما لقيت شي يطابق طلبك.',
                    permission: 'ما عندي صلاحية لتنفيذ هذا الأمر.',
                    context: 'أحتاج إلى مزيد من السياق.',
                    network: 'في مشكلة بالاتصال. جرب مرة ثانية.'
                },
                followup: {
                    search: 'شو تحب تسوي؟ تقدر تختار رقم أو تبحث عن شي ثاني.',
                    application: 'تحب أسوي شي ثاني مع {application}?',
                    system: 'هل تحب تأكيد الأمر؟',
                    selection: 'هل تحب تختار شي ثاني؟',
                    dev_inspect: 'هل تحتاج إلى اقتراح إصلاح أو تريد تشغيل الاختبارات؟',
                    dev_test: 'هل تحب أصلح أخطاء الاختبار؟',
                    dev_fix: 'هل تحب أراجع الكود بعد الإصلاح؟',
                    dev_fix_preview: 'هل تريد تطبيق هذا الإصلاح؟'
                }
            },
            tr: {
                success: {
                    search: '{count} sonuç buldum. İlk videoyu oynatmamı ister misin?',
                    application: '{application} başarıyla açıldı.',
                    system: '"{command}" komutu başarıyla çalıştırıldı.',
                    memory: 'Bellek başarıyla kaydedildi.',
                    selection: '{index} numaralı öğe başarıyla seçildi.',
                    dev_inspect: 'Kod incelendi {target}. Sonuç: {result}',
                    dev_test: 'Testler başarıyla tamamlandı. Sonuç: {result}',
                    dev_fix: '{target} üzerindeki hata düzeltildi.',
                    dev_fix_preview: '{target} için düzeltme önerildi:\n{result}'
                },
                error: {
                    general: 'Hata oluştu: {error}',
                    not_found: 'Aramanıza uygun bir şey bulamadım.',
                    permission: 'Bu komutu çalıştırmak için iznim yok.',
                    context: 'Daha fazla bağlama ihtiyacım var.',
                    network: 'Bağlantı sorunu yaşıyorum. Tekrar deneyin.'
                },
                followup: {
                    search: 'Ne yapmak istersin? Bir numara seçebilir veya başka bir şey arayabilirsin.',
                    application: '{application} ile başka bir şey yapmamı ister misin?',
                    system: 'Komutu onaylamak ister misin?',
                    selection: 'Başka bir şey seçmek ister misin?',
                    dev_inspect: 'Hata düzeltme önermemi veya testleri çalıştırmamı ister misin?',
                    dev_test: 'Test hatalarını düzeltmemi ister misin?',
                    dev_fix: 'Düzeltmeden sonra kodu incelememi ister misin?',
                    dev_fix_preview: 'Bu düzeltmeyi uygulamak ister misin?'
                }
            },
            en: {
                success: {
                    search: 'Found {count} results. Would you like me to play the first video?',
                    application: '{application} opened successfully.',
                    system: 'Command "{command}" executed successfully.',
                    memory: 'Memory saved successfully.',
                    selection: 'Item number {index} selected successfully.',
                    dev_inspect: 'Inspected {target}. Result: {result}',
                    dev_test: 'Tests executed. Result: {result}',
                    dev_fix: 'Fixed issue in {target}.',
                    dev_fix_preview: 'Proposed fix for {target}:\n{result}'
                },
                error: {
                    general: 'An error occurred: {error}',
                    not_found: "I couldn't find anything matching your request.",
                    permission: "I don't have permission to execute this command.",
                    context: 'I need more context.',
                    network: 'Having connection issues. Please try again.'
                },
                followup: {
                    search: 'What would you like to do? You can select a number or search for something else.',
                    application: 'Would you like me to do something else with {application}?',
                    system: 'Would you like to confirm the command?',
                    selection: 'Would you like to select something else?',
                    dev_inspect: 'Do you want me to suggest a fix or run tests?',
                    dev_test: 'Should I fix any test errors?',
                    dev_fix: 'Would you like me to run tests to verify the fix?',
                    dev_fix_preview: 'Do you want to apply this fix?'
                }
            }
        };
    }
    generateResponse(result, context) {
        const language = this.detectLanguage(context);
        const templates = this.responseTemplates[language];
        if (result.success) {
            return this.generateSuccessResponse(result, templates.success);
        }
        else {
            return this.generateErrorFromResult(result, templates.error);
        }
    }
    generateFollowUp(result, context) {
        const language = this.detectLanguage(context);
        const templates = this.responseTemplates[language];
        if (!result.success) {
            return '';
        }
        const actionType = this.determineActionType(result);
        const followupTemplate = templates.followup[actionType];
        if (!followupTemplate) {
            return '';
        }
        return this.formatTemplate(followupTemplate, result.data);
    }
    generateErrorResponse(error, language) {
        const messages = {
            ar: {
                network: 'حدثت مشكلة في الاتصال. {msg}',
                permission: 'صلاحيات غير كافية. {msg}',
                context: 'السياق غير كافٍ. {msg}',
                unknown: 'حصل خطأ غير معروف. {msg}'
            },
            tr: {
                network: 'Bağlantı sorunu oluştu. {msg}',
                permission: 'Yetersiz izinler. {msg}',
                context: 'Bağlam yetersiz. {msg}',
                unknown: 'Bilinmeyen bir hata oluştu. {msg}'
            },
            en: {
                network: 'Connection issue occurred. {msg}',
                permission: 'Insufficient permissions. {msg}',
                context: 'Insufficient context. {msg}',
                unknown: 'An unknown error occurred. {msg}'
            }
        };
        const template = messages[language][error.type] || messages[language].unknown;
        return template.replace('{msg}', error.user_message || '');
    }
    formatForVoice(text) {
        // Remove complex formatting for voice output
        return text
            .replace(/\{[^}]+\}/g, '') // Remove template placeholders
            .replace(/\[.*?\]/g, '') // Remove brackets
            .replace(/\(.*\)/g, '') // Remove parentheses
            .replace(/https?:\/\/[^\s]+/g, 'link') // Replace URLs with "link"
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    formatForText(text) {
        // Enhance text formatting for visual output
        return text
            .replace(/\{([^}]+)\}/g, (match, key) => {
            // Highlight template variables
            return `**${key}**`;
        })
            .replace(/\n/g, '\n\n') // Add spacing between paragraphs
            .trim();
    }
    generateSuccessResponse(result, templates) {
        const actionType = this.determineActionType(result);
        const template = templates[actionType] || templates.general;
        return this.formatTemplate(template, result.data);
    }
    generateErrorFromResult(result, templates) {
        const errorType = this.determineErrorType(result);
        const template = templates[errorType] || templates.general;
        return this.formatTemplate(template, { error: result.error });
    }
    determineActionType(result) {
        if (result.data?.query && result.data?.results)
            return 'search';
        if (result.data?.application)
            return 'application';
        if (result.data?.command)
            return 'system';
        if (result.data?.action === 'memory_stored')
            return 'memory';
        if (result.data?.action === 'opened' && result.data?.index)
            return 'selection';
        if (result.data?.action === 'dev_inspect')
            return 'dev_inspect';
        if (result.data?.action === 'dev_test')
            return 'dev_test';
        if (result.data?.action === 'dev_fix')
            return 'dev_fix';
        if (result.data?.action === 'dev_fix_preview')
            return 'dev_fix_preview';
        return 'general';
    }
    determineErrorType(result) {
        const error = result.error?.toLowerCase() || '';
        if (error.includes('permission') || error.includes('access'))
            return 'permission';
        if (error.includes('not found') || error.includes('no results'))
            return 'not_found';
        if (error.includes('context') || error.includes('missing'))
            return 'context';
        if (error.includes('network') || error.includes('connection'))
            return 'network';
        return 'general';
    }
    detectLanguage(context) {
        // Try to detect language from conversation history
        if (context.conversation_history.length > 0) {
            const lastMessage = context.conversation_history
                .filter(h => h.includes('User:'))
                .pop();
            if (lastMessage) {
                const messageText = lastMessage.split('User: ')[1];
                return this.detectLanguageFromText(messageText);
            }
        }
        return 'ar'; // Default to Arabic
    }
    detectLanguageFromText(text) {
        const arabicChars = /[\u0600-\u06FF]/;
        const turkishChars = /[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/;
        if (arabicChars.test(text))
            return 'ar';
        if (turkishChars.test(text))
            return 'tr';
        return 'en';
    }
    formatTemplate(template, data) {
        return template.replace(/\{([^}]+)\}/g, (match, key) => {
            const keys = key.split('.');
            let value = data;
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined)
                    break;
            }
            return value !== undefined ? String(value) : match;
        });
    }
    generateProactiveSuggestion(context) {
        const language = this.detectLanguage(context);
        const suggestions = {
            ar: [
                'تحب أبحث عن شي؟',
                'هل تحب أفتح تطبيق؟',
                'عندك أي طلب ثاني؟',
                'هل تحب أشغل فيديو؟'
            ],
            tr: [
                'Bir şey aramamı ister misin?',
                'Bir uygulama açmamı ister misin?',
                'Başka bir isteğin var mı?',
                'Bir video oynatmamı ister misin?'
            ],
            en: [
                'Would you like me to search for something?',
                'Would you like me to open an application?',
                'Do you have any other requests?',
                'Would you like me to play a video?'
            ]
        };
        const languageSuggestions = suggestions[language];
        return languageSuggestions[Math.floor(Math.random() * languageSuggestions.length)];
    }
    generateContextualHelp(context) {
        const language = this.detectLanguage(context);
        const helpMessages = {
            ar: [
                'تقدر تقول: "افتح كروم" أو "دور لي فيديوهات عن البرمجة" أو "أطفئ الجهاز"',
                'أوامر متوفرة: فتح تطبيقات، بحث، يوتيوب، أوامر النظام',
                'مثال: "شغل سبوتيفاي" أو "ابحث عن طريقة عمل الكيك"'
            ],
            tr: [
                'Şunları söyleyebilirsin: "Chrome uygulamasını aç" veya "Programlama hakkında videolar bul" veya "Bilgisayarı kapat"',
                'Mevcut komutlar: Uygulama açma, arama, YouTube, sistem komutları',
                'Örnek: "Spotify çal" veya "Pasta yapımı hakkında ara"'
            ],
            en: [
                'You can say: "open chrome" or "find videos about programming" or "shutdown computer"',
                'Available commands: Open applications, search, YouTube, system commands',
                'Example: "play spotify" or "search how to make cake"'
            ]
        };
        return helpMessages[language][Math.floor(Math.random() * helpMessages[language].length)];
    }
}
exports.ResponseGenerator = ResponseGenerator;
//# sourceMappingURL=ResponseGenerator.js.map