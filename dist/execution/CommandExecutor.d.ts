import { ExecutionCommand, SkillResult } from '../types';
import { MemoryManager } from '../memory/MemoryManager';
import { ContextManager } from '../context/ContextManager';
export declare class CommandExecutor {
    private memory;
    private context;
    private fsSafety;
    private patchGen;
    private validator;
    private gitSafety;
    constructor(memory: MemoryManager, context: ContextManager);
    private logDevAction;
    execute(command: ExecutionCommand, intentLanguage: 'ar' | 'tr' | 'en'): Promise<SkillResult>;
    private execOpenApp;
    private execOpenFile;
    private execReadFile;
    private execSummarizeLogs;
    private execCloseApp;
    private execWebSearch;
    private execYouTubeSearch;
    private execSystem;
    private execSelection;
    private execStoreMemory;
    private execDevInspect;
    private execDevTest;
    private execDevFix;
    private error;
    private confirmationMessage;
    private confirmKeyword;
    private fallbackError;
    private riskLevelText;
    private confidenceLevelText;
    private msg;
    private searchMulti;
    private ddg;
    private bing;
    private searchYouTube;
}
//# sourceMappingURL=CommandExecutor.d.ts.map