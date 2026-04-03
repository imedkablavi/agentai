"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceInput = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const VoiceInputAdapter_1 = require("./VoiceInputAdapter");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class VoiceInput {
    constructor(provider = new VoiceInputAdapter_1.DummyVoiceInputAdapter(), whisperCmd = 'python -m whisper') {
        this.provider = provider;
        this.whisperCmd = whisperCmd;
    }
    async listen(audioFilePath) {
        if (!audioFilePath)
            return '';
        const providerText = await this.provider.transcribe(audioFilePath);
        if (providerText.trim())
            return providerText.trim();
        try {
            const escapedPath = audioFilePath.replace(/"/g, '\\"');
            const { stdout } = await execAsync(`${this.whisperCmd} "${escapedPath}" --language auto --task transcribe --output_format txt`);
            const base = path.parse(audioFilePath).name;
            const dir = path.parse(audioFilePath).dir;
            const txtPath = path.join(dir, `${base}.txt`);
            if (fs.existsSync(txtPath)) {
                const content = fs.readFileSync(txtPath, 'utf8');
                return String(content || '').trim();
            }
            return stdout?.trim() || '';
        }
        catch {
            return '';
        }
    }
}
exports.VoiceInput = VoiceInput;
//# sourceMappingURL=VoiceInput.js.map