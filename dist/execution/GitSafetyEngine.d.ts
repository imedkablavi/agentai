export declare class ExecutionMutex {
    private static locked;
    static acquire(timeoutMs?: number): Promise<boolean>;
    static release(): void;
}
export declare class GitSafetyEngine {
    private workspaceRoot;
    constructor(workspaceRoot?: string);
    isGitRepo(): Promise<boolean>;
    createSafeCheckpoint(): Promise<{
        success: boolean;
        hash?: string;
    }>;
    restoreCheckpoint(hash: string): Promise<boolean>;
    getGitDiff(targetPath: string): Promise<string>;
}
//# sourceMappingURL=GitSafetyEngine.d.ts.map