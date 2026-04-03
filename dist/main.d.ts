#!/usr/bin/env node
declare class WindowsAIAssistantCLI {
    private assistant;
    private rl;
    private sessionLog;
    private voice;
    private voiceController;
    constructor();
    private setupEventHandlers;
    private processUserInput;
    private showHelp;
    private showMemoryInsights;
    private showContext;
    private logInteraction;
    private logSessionStart;
    private saveSessionLog;
    private shutdown;
    start(): void;
}
export { WindowsAIAssistantCLI };
//# sourceMappingURL=main.d.ts.map