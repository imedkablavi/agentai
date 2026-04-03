"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchGenerator = void 0;
const axios_1 = __importDefault(require("axios"));
class PatchGenerator {
    constructor() {
        this.endpoint = 'http://localhost:11434/api/generate';
        this.model = 'qwen2.5:7b-instruct'; // Can be configurable
    }
    async proposeFix(fileContent, errorContext, filePath) {
        const prompt = `You are an expert developer assistant responding with ONLY code. 
Rewrite the entire following file to fix the reported error. 
DO NOT truncate unchanged code. DO NOT use ellipsis (...).
You MUST provide the FULL updated file content.

File Path: ${filePath}

Error/Context:
${errorContext}

Current Content:
${fileContent}

Fixed Content:`;
        let rawOutput = '';
        try {
            const res = await axios_1.default.post(this.endpoint, {
                model: this.model,
                prompt,
                stream: false
            }, { timeout: 30000 });
            rawOutput = String(res.data?.response || '').trim();
        }
        catch {
            rawOutput = ''; // Explicitly fall through to error handling
        }
        if (!rawOutput) {
            throw new Error('LLM endpoint unreachable or returned empty output.');
        }
        return this.extractCode(rawOutput, fileContent);
    }
    extractCode(raw, original) {
        const blockRegex = /```[\w]*\n([\s\S]*?)```/;
        const match = blockRegex.exec(raw);
        let extracted = match ? match[1].trim() : raw.trim();
        // Remove "Here is the code" artifacts if block was missed
        if (extracted.startsWith('Here')) {
            const idx = extracted.indexOf('\n');
            if (idx > 0)
                extracted = extracted.slice(idx).trim();
        }
        // Strict size threshold: code files rarely compress by 50% unless completely refactored down
        // Reject truncations
        if (original.length > 50 && extracted.length < original.length * 0.4) {
            throw new Error(`Generated patch is too short (${extracted.length} bytes vs ${original.length} bytes). Likely truncated.`);
        }
        // Reject ellipises placeholders
        if (extracted.includes('// ...') || extracted.includes('// ... existing code')) {
            throw new Error(`Generated patch contains ellipsis placeholders. Cannot safely apply partial rewrite.`);
        }
        return extracted;
    }
    async summarizeFile(fileContent, filePath) {
        const prompt = `قم بتحليل هذا الملف برمجياً. اشرح الغرض منه بشكل منظم:
1. وظيفة الملف
2. المشاكل البرمجية (إن وجدت)
3. المخاطر الأمنية وحوافز التحسين

يجب أن يكون الرد باللغة العربية كمهندس برمجيات محترف ومختصر.
مسار الملف: ${filePath}

المحتوى:
${fileContent.substring(0, 4000)}`;
        try {
            const res = await axios_1.default.post(this.endpoint, {
                model: this.model,
                prompt,
                stream: false
            }, { timeout: 15000 });
            return String(res.data?.response || '').trim();
        }
        catch {
            return "الملف عبارة عن كود برمجي. لم أتمكن من الاتصال بمحرك الذكاء الاصطناعي للتلخيص.";
        }
    }
}
exports.PatchGenerator = PatchGenerator;
//# sourceMappingURL=PatchGenerator.js.map