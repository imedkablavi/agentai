"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleVoiceOutputAdapter = void 0;
class ConsoleVoiceOutputAdapter {
    async speak(text, _language) {
        console.log(`🔊 ${text}`);
    }
}
exports.ConsoleVoiceOutputAdapter = ConsoleVoiceOutputAdapter;
//# sourceMappingURL=VoiceOutputAdapter.js.map