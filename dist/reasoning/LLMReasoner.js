"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMReasoner = void 0;
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const util_1 = require("util");
class LLMReasoner {
    constructor() {
        this.endpoint = 'http://localhost:11434/api/generate';
        this.model = 'qwen2.5:7b-instruct';
        this.systemPrompt = ('أنت عقل تفكير لمساعد شخصي يعمل على Windows.\n' +
            'مهمتك فهم العربية الطبيعية (حتى العامية)، أو التركية أو الإنجليزية،\n' +
            'واستخراج نية واحدة فقط بصيغة JSON التالية،\n' +
            'بدون تنفيذ، بدون شرح، بدون نص زائد.\n\n' +
            '{\n' +
            '  "intent_name": "string",\n' +
            '  "confidence": 0.0,\n' +
            '  "language": "ar | tr | en",\n' +
            '  "entities": {\n' +
            '    "application": null,\n' +
            '    "query": null,\n' +
            '    "time": null,\n' +
            '    "repeat": null,\n' +
            '    "index": null\n' +
            '  },\n' +
            '  "follow_up": null\n' +
            '}\n');
    }
    async infer(text) {
        try {
            const prompt = `${this.systemPrompt}\n\nالنص:\n${text}`;
            const res = await axios_1.default.post(this.endpoint, {
                model: this.model,
                prompt,
                stream: false
            }, { timeout: 15000 });
            const raw = String(res.data?.response || '').trim();
            const jsonStr = this.extractJson(raw);
            if (!jsonStr)
                return null;
            const parsed = JSON.parse(jsonStr);
            if (!parsed || typeof parsed !== 'object')
                return null;
            const language = (parsed.language === 'ar' || parsed.language === 'tr' || parsed.language === 'en') ? parsed.language : 'ar';
            const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.0;
            const entities = parsed.entities || {};
            const intent = {
                name: parsed.intent_name || 'unknown',
                confidence,
                language,
                context_required: false,
                entities: {
                    application: entities.application || undefined,
                    query: entities.query || undefined,
                    index: entities.index || undefined,
                    time: entities.time || undefined,
                    repeat: entities.repeat || undefined
                },
                raw_text: text
            };
            return intent;
        }
        catch {
            // Fallback: CLI invocation
            try {
                const runPath = process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs\\Ollama\\ollama.exe` : 'ollama';
                const cmd = `"${runPath}" run ${this.model} "${this.systemPrompt}\n\nنص: ${text.replace(/"/g, '\"')}"`;
                const { stdout } = await (0, util_1.promisify)(child_process_1.exec)(cmd, { timeout: 20000 });
                const raw = stdout.trim();
                const jsonStr = this.extractJson(raw);
                if (!jsonStr)
                    return null;
                const parsed = JSON.parse(jsonStr);
                const language = (parsed.language === 'ar' || parsed.language === 'tr' || parsed.language === 'en') ? parsed.language : 'ar';
                const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.0;
                const entities = parsed.entities || {};
                const intent = {
                    name: parsed.intent_name || 'unknown',
                    confidence,
                    language,
                    context_required: false,
                    entities: {
                        application: entities.application || undefined,
                        query: entities.query || undefined,
                        index: entities.index || undefined,
                        time: entities.time || undefined,
                        repeat: entities.repeat || undefined
                    },
                    raw_text: text
                };
                return intent;
            }
            catch {
                return null;
            }
        }
    }
    extractJson(s) {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start)
            return null;
        return s.slice(start, end + 1);
    }
}
exports.LLMReasoner = LLMReasoner;
//# sourceMappingURL=LLMReasoner.js.map