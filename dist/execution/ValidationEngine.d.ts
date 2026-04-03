export declare class ValidationEngine {
    private workspaceRoot;
    private packageCache;
    constructor(workspaceRoot?: string);
    getWorkspacePackages(): {
        dir: string;
        name: string;
        deps: string[];
    }[];
    getImpactedScopes(filePath: string): string[];
    getNearestPackageInfo(filePath: string): {
        root: string;
        pkg: any;
        isWorkspaceRoot: boolean;
    };
    analyzeRisk(filePath: string): {
        level: 'low' | 'medium' | 'high';
        reason: string;
        impactedScopes: string[];
    };
    validateFile(filePath: string): Promise<{
        success: boolean;
        stderr: string;
        stdout: string;
        confidence: 'high' | 'partial';
    }>;
    validateProjectSemantic(affectedFile: string): Promise<{
        success: boolean;
        diff: string;
        scope: string;
    }>;
}
//# sourceMappingURL=ValidationEngine.d.ts.map