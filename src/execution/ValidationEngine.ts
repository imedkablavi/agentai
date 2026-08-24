import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { redactedError, redactString } from '../security/Redaction';
import { buildChildProcessEnv } from '../security/ChildProcessEnv';

const execFileAsync = promisify(execFile);

export class ValidationEngine {
  private readonly workspaceRoot: string;
  private packageCache: { dir: string; name: string; deps: string[] }[] | null = null;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public getWorkspacePackages(): { dir: string; name: string; deps: string[] }[] {
    if (this.packageCache) return this.packageCache;

    const results: { dir: string; name: string; deps: string[] }[] = [];
    const scan = (dir: string, depth: number): void => {
      if (depth > 3 || !this.isInsideWorkspace(dir)) return;
      if (/(^|[\\/])(?:node_modules|\.git|dist|build)([\\/]|$)/.test(dir)) return;

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isSymbolicLink()) continue;
          if (item.isDirectory()) {
            scan(path.join(dir, item.name), depth + 1);
          } else if (item.name === 'package.json') {
            try {
              const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
              if (pkg.name) {
                const deps = [
                  ...Object.keys(pkg.dependencies || {}),
                  ...Object.keys(pkg.peerDependencies || {}),
                  ...Object.keys(pkg.devDependencies || {}),
                ];
                results.push({ dir, name: pkg.name, deps });
              }
            } catch {
              // Ignore malformed package metadata during discovery.
            }
          }
        }
      } catch {
        // Unreadable directories are excluded from validation scope.
      }
    };

    scan(this.workspaceRoot, 0);
    this.packageCache = results;
    return results;
  }

  public getImpactedScopes(filePath: string): string[] {
    const absolute = this.safeAbsolutePath(filePath);
    if (!absolute) return [this.workspaceRoot];
    const { root, pkg } = this.getNearestPackageInfo(absolute);
    if (!pkg?.name) return [root];

    const impacted = new Set<string>([root]);
    for (const candidate of this.getWorkspacePackages()) {
      if (candidate.dir !== root && candidate.deps.includes(pkg.name)) impacted.add(candidate.dir);
    }
    return Array.from(impacted);
  }

  public getNearestPackageInfo(filePath: string): { root: string; pkg: any; isWorkspaceRoot: boolean } {
    const absolute = this.safeAbsolutePath(filePath) || this.workspaceRoot;
    let currentDir = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory() ? absolute : path.dirname(absolute);

    while (this.isInsideWorkspace(currentDir)) {
      const pkgPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          return { root: currentDir, pkg, isWorkspaceRoot: currentDir === this.workspaceRoot };
        } catch {
          // Continue walking to a parent package boundary.
        }
      }
      if (currentDir === this.workspaceRoot) break;
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    return { root: this.workspaceRoot, pkg: {}, isWorkspaceRoot: true };
  }

  public analyzeRisk(filePath: string): { level: 'low' | 'medium' | 'high'; reason: string; impactedScopes: string[] } {
    const impactedScopes = this.getImpactedScopes(filePath);
    const normalized = filePath.replace(/\\/g, '/');

    if (/(^|\/)(package\.json|tsconfig\.json|vite\.config|webpack\.config|\.env)/i.test(normalized)) {
      return { level: 'high', reason: 'Root/build configuration can affect the whole execution environment.', impactedScopes };
    }
    if (/(^|\/)(index|main)\.(ts|js|tsx|jsx)$/i.test(normalized)) {
      return { level: 'high', reason: 'Entrypoint changes can affect application startup.', impactedScopes };
    }
    if (impactedScopes.length > 1) {
      return { level: 'high', reason: `Shared package affects ${impactedScopes.length - 1} dependent scope(s).`, impactedScopes };
    }
    if (/\.(test|spec)\.(ts|js|jsx|tsx)$/i.test(normalized)) {
      return { level: 'low', reason: 'Change is scoped to a test file.', impactedScopes };
    }
    return { level: 'medium', reason: 'Change is local to one package but still modifies executable source.', impactedScopes };
  }

  async validateFile(filePath: string): Promise<{ success: boolean; stderr: string; stdout: string; confidence: 'high' | 'partial' }> {
    const absolute = this.safeAbsolutePath(filePath);
    if (!absolute) return { success: false, stderr: 'Path is outside workspace scope', stdout: '', confidence: 'high' };
    const ext = path.extname(absolute).toLowerCase();

    if (ext === '.json') {
      try {
        JSON.parse(fs.readFileSync(absolute, 'utf8'));
        return { success: true, stderr: '', stdout: 'JSON is valid', confidence: 'high' };
      } catch (error) {
        return { success: false, stderr: redactedError(error), stdout: '', confidence: 'high' };
      }
    }

    const { root: scopedRoot, pkg } = this.getNearestPackageInfo(absolute);
    try {
      if (ext === '.ts' || ext === '.tsx') {
        if (pkg.scripts?.typecheck) {
          await this.run(this.npmExecutable(), ['run', 'typecheck'], scopedRoot, 20_000);
          return { success: true, stderr: '', stdout: 'TypeScript validation passed', confidence: 'high' };
        }

        const localTsc = this.resolveLocalNodeCli(scopedRoot, 'typescript', ['bin', 'tsc']);
        if (!localTsc) {
          return {
            success: true,
            stderr: '',
            stdout: 'No local TypeScript validator is installed; validation confidence is partial.',
            confidence: 'partial',
          };
        }

        await this.run(process.execPath, [localTsc, '--noEmit', '--isolatedModules', absolute], scopedRoot, 20_000);
        return { success: true, stderr: '', stdout: 'TypeScript validation passed', confidence: 'high' };
      }

      if (ext === '.js' || ext === '.jsx') {
        await this.run(process.execPath, ['--check', absolute], scopedRoot, 10_000);
        return { success: true, stderr: '', stdout: 'JavaScript syntax passed', confidence: 'high' };
      }
    } catch (error: any) {
      return {
        success: false,
        stderr: redactString(String(error?.stderr || error?.message || 'Validation failed'), 3000),
        stdout: redactString(String(error?.stdout || ''), 3000),
        confidence: 'high',
      };
    }

    return { success: true, stderr: '', stdout: 'No static validator is configured for this file type.', confidence: 'partial' };
  }

  async validateProjectSemantic(affectedFile: string): Promise<{ success: boolean; diff: string; scope: string }> {
    const impactedScopes = this.getImpactedScopes(affectedFile);
    let allPassed = true;
    let combinedOutput = '';
    let runCount = 0;

    for (const scopeRoot of impactedScopes) {
      if (!this.isInsideWorkspace(scopeRoot)) {
        allPassed = false;
        combinedOutput += '[scope]: rejected outside workspace boundary.\n';
        continue;
      }

      const pkgPath = path.join(scopeRoot, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (!pkg.scripts?.test) continue;
        runCount += 1;
        await this.run(this.npmExecutable(), ['run', 'test'], scopeRoot, 30_000);
        combinedOutput += `[${pkg.name || path.basename(scopeRoot)}]: tests passed.\n`;
      } catch (error: any) {
        allPassed = false;
        combinedOutput += `[${path.basename(scopeRoot)}]: tests failed - ${redactString(String(error?.stderr || error?.message || 'unknown error'), 1000)}\n`;
      }
    }

    if (runCount === 0) {
      return {
        success: true,
        diff: 'No test suite was found in impacted scopes; validation confidence is partial.',
        scope: impactedScopes.join(', '),
      };
    }

    return { success: allPassed, diff: combinedOutput, scope: impactedScopes.join(', ') };
  }

  private async run(executable: string, args: string[], cwd: string, timeout: number): Promise<void> {
    await execFileAsync(executable, args, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      env: buildChildProcessEnv(),
    });
  }

  private resolveLocalNodeCli(scopeRoot: string, packageName: string, scriptParts: string[]): string | null {
    const roots = scopeRoot === this.workspaceRoot ? [scopeRoot] : [scopeRoot, this.workspaceRoot];
    for (const root of roots) {
      const candidate = path.join(root, 'node_modules', packageName, ...scriptParts);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  private safeAbsolutePath(filePath: string): string | null {
    if (!filePath || /[\u0000\r\n]/.test(filePath)) return null;
    const absolute = path.resolve(this.workspaceRoot, filePath);
    return this.isInsideWorkspace(absolute) ? absolute : null;
  }

  private isInsideWorkspace(candidate: string): boolean {
    const relative = path.relative(this.workspaceRoot, path.resolve(candidate));
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  }

  private npmExecutable(): string { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }
}
