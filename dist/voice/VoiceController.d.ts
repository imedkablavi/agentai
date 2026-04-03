import { AIAssistant } from '../AIAssistant';
import { VoiceInput } from './VoiceInput';
import { VoiceOutput } from './VoiceOutput';
export declare class VoiceController {
    private assistant;
    private input;
    private output;
    constructor(assistant: AIAssistant, input: VoiceInput, output: VoiceOutput);
    processOnce(audioFilePath?: string): Promise<void>;
}
//# sourceMappingURL=VoiceController.d.ts.map