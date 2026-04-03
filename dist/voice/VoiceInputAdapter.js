"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummyVoiceInputAdapter = void 0;
class DummyVoiceInputAdapter {
    async transcribe() {
        return '';
    }
    detectLanguage(text) {
        const arabic = /[\u0600-\u06FF]/.test(text);
        const turkish = /[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/.test(text);
        if (arabic)
            return 'ar';
        if (turkish)
            return 'tr';
        return 'en';
    }
}
exports.DummyVoiceInputAdapter = DummyVoiceInputAdapter;
//# sourceMappingURL=VoiceInputAdapter.js.map