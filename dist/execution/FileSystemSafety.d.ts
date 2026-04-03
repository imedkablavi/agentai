export declare class FileSystemSafety {
    private workspaceRoot;
    constructor(workspaceRoot?: string);
    isSafePath(targetPath: string): boolean;
    readFile(targetPath: string): Promise<{
        content: string;
        error?: string;
    }>;
    applyPatch(targetPath: string, newContent: string): Promise<{
        success: boolean;
        backupPath?: string;
    }>;
    rollback(targetPath: string, backupPath: string): boolean;
    private logAction;
}
//# sourceMappingURL=FileSystemSafety.d.ts.map