"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceController = void 0;
class VoiceController {
    constructor(assistant, input, output) {
        this.assistant = assistant;
        this.input = input;
        this.output = output;
    }
    async processOnce(audioFilePath) {
        const prefs = this.assistant.getPreferences();
        if (!prefs.voice_mode)
            return;
        const text = await this.input.listen(audioFilePath);
        if (!text)
            return;
        const result = await this.assistant.processInput(text);
        await this.output.speak(result.voiceResponse, prefs.language, prefs.voice_response_mode || 'short');
    }
}
exports.VoiceController = VoiceController;
//# sourceMappingURL=VoiceController.js.map