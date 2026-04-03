"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceOutput = void 0;
const voiceMap = {
    ar: 'Microsoft Farid Online (Natural) - Arabic (Egypt)',
    tr: 'Microsoft Seda Online (Natural) - Turkish (Turkey)',
    en: 'Microsoft Aria Online (Natural) - English (US)'
};
class VoiceOutput {
    async speak(text, language) {
        const voice = voiceMap[language] || voiceMap.en;
        const short = (text || '').split(/[.!؟!]/)[0];
        if (!short)
            return;
        try {
            // Adapter-only: log the chosen voice and text (no audio playback in CLI)
            console.log(`🔊 (${voice}) ${short}`);
        }
        catch (e) {
            console.warn('Voice output failed:', e);
        }
    }
}
exports.VoiceOutput = VoiceOutput;
//# sourceMappingURL=VoiceOutput.js.map