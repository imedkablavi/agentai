"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceOutput = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const VoiceOutputAdapter_1 = require("./VoiceOutputAdapter");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const voiceMap = {
    ar: 'Microsoft Farid Online (Natural) - Arabic (Egypt)',
    tr: 'Microsoft Seda Online (Natural) - Turkish (Turkey)',
    en: 'Microsoft Aria Online (Natural) - English (US)'
};
class VoiceOutput {
    constructor(adapter = new VoiceOutputAdapter_1.ConsoleVoiceOutputAdapter(), edgeTtsCmd = 'edge-tts') {
        this.adapter = adapter;
        this.edgeTtsCmd = edgeTtsCmd;
    }
    async speak(text, language, mode = 'short') {
        const cleaned = String(text || '').trim();
        if (!cleaned)
            return;
        const voice = voiceMap[language] || voiceMap.en;
        const spoken = mode === 'long' ? cleaned : cleaned.split(/[.!؟！]/)[0].trim();
        if (!spoken)
            return;
        try {
            await execFileAsync(this.edgeTtsCmd, ['--voice', voice, '--text', spoken]);
            return;
        }
        catch {
            await this.adapter.speak(spoken, language);
        }
    }
}
exports.VoiceOutput = VoiceOutput;
//# sourceMappingURL=VoiceOutput.js.map