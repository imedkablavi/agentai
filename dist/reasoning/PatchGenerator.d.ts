export declare class PatchGenerator {
    private endpoint;
    private model;
    proposeFix(fileContent: string, errorContext: string, filePath: string): Promise<string>;
    private extractCode;
    summarizeFile(fileContent: string, filePath: string): Promise<string>;
}
//# sourceMappingURL=PatchGenerator.d.ts.map