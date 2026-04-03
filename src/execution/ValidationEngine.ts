import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class ValidationEngine {
  private workspaceRoot: string;
  private packageCache: { dir: string; name: string; deps: string[] }[] | null = null;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  // Helper to discover all packages up to depth 3
  public getWorkspacePackages(): { dir: string; name: string; deps: string[] }[] {
    if (this.packageCache) return this.packageCache;
    
    const results: { dir: string; name: string; deps: string[] }[] = [];
    const scan = (dir: string, depth: number) => {
      if (depth > 3) return;
      if (dir.includes('node_modules') || dir.includes('.git')) return;

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            scan(path.join(dir, item.name), depth + 1);
          } else if (item.name === 'package.json') {
             try {
               const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
               if (pkg.name) {
                 const allDeps = [
                   ...Object.keys(pkg.dependencies || {}),
                   ...Object.keys(pkg.peerDependencies || {}),
                   ...Object.keys(pkg.devDependencies || {})
                 ];
                 results.push({ dir, name: pkg.name, deps: allDeps });
               }
             } catch {}
          }
        }
      } catch {}
    };

    scan(this.workspaceRoot, 0);
    this.packageCache = results;
    return results;
  }

  public getImpactedScopes(filePath: string): string[] {
    const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    const { root, pkg } = this.getNearestPackageInfo(absoluteFilePath);
    if (!pkg?.name) return [root];

    const currentName = pkg.name;
    const allPkgs = this.getWorkspacePackages();
    const impacted = new Set<string>();
    impacted.add(root);

    // Find any package that depends on currentName
    for (const p of allPkgs) {
      if (p.dir !== root && p.deps.includes(currentName)) {
        impacted.add(p.dir);
      }
    }

    return Array.from(impacted);
  }

  public getNearestPackageInfo(filePath: string): { root: string; pkg: any; isWorkspaceRoot: boolean } {
    const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    let currentDir = path.dirname(absoluteFilePath);
    
    while (currentDir.startsWith(this.workspaceRoot)) {
      const pkgPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          return { root: currentDir, pkg, isWorkspaceRoot: currentDir === this.workspaceRoot };
        } catch {}
      }
      if (currentDir === this.workspaceRoot) break;
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    return { root: this.workspaceRoot, pkg: {}, isWorkspaceRoot: true };
  }

  public analyzeRisk(filePath: string): { level: 'low' | 'medium' | 'high'; reason: string; impactedScopes: string[] } {
    const { root, isWorkspaceRoot, pkg } = this.getNearestPackageInfo(filePath);
    const normalized = filePath.replace(/\\/g, '/');
    const impactedScopes = this.getImpactedScopes(filePath);
    
    const isShared = impactedScopes.length > 1;
    const dependentsCount = impactedScopes.length - 1;
    
    if (normalized.match(/(package\.json|tsconfig\.json|vite\.config|\.env|webpack)/)) {
      return { level: 'high', reason: 'تعديل على إعدادات جذرية تؤثر على بيئة العمل.', impactedScopes };
    }
    
    // Explicit entrypoint modification logic
    if (normalized.match(/(index|main)\.(ts|js|tsx|jsx)$/)) {
      return { level: 'high', reason: 'تعديل على نقطة دخول هيكلية قد يكسر بناء التطبيق.', impactedScopes };
    }

    if (isShared) {
      return { level: 'high', reason: `تعديل في وحدة مشتركة تؤثر على ${dependentsCount} حزم أخرى تعتمد عليها.`, impactedScopes };
    }

    if (normalized.match(/\.(test|spec)\.(ts|js|jsx|tsx)$/)) {
      return { level: 'low', reason: 'تعديل على ملف اختبار معزول.', impactedScopes };
    }

    return { level: 'medium', reason: 'نطاق التأثير محلي داخل الحزمة.', impactedScopes };
  }

  async validateFile(filePath: string): Promise<{ success: boolean; stderr: string; stdout: string; confidence: 'high' | 'partial' }> {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check if JSON
    if (ext === '.json') {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        return { success: true, stderr: '', stdout: 'JSON is valid', confidence: 'high' };
      } catch (e: any) {
        return { success: false, stderr: e.message, stdout: '', confidence: 'high' };
      }
    }

    const { root: scopingRoot, pkg } = this.getNearestPackageInfo(filePath);
    
    if (ext === '.ts' || ext === '.tsx') {
      try {
        if (pkg.scripts?.typecheck) {
           await execAsync('npm run typecheck', { timeout: 15000, cwd: scopingRoot });
        } else {
           await execAsync(`npx tsc --noEmit --isolatedModules "${filePath}"`, { timeout: 15000, cwd: scopingRoot });
        }
        return { success: true, stderr: '', stdout: 'Syntax OK', confidence: 'high' };
      } catch (e: any) {
        return { success: false, stderr: e.stderr || e.message, stdout: e.stdout || '', confidence: 'high' };
      }
    }

    if (ext === '.js' || ext === '.jsx') {
      try {
        await execAsync(`node --check "${filePath}"`, { timeout: 10000, cwd: scopingRoot });
        return { success: true, stderr: '', stdout: 'Syntax OK', confidence: 'high' };
      } catch (e: any) {
        return { success: false, stderr: e.stderr || e.message, stdout: e.stdout || '', confidence: 'high' };
      }
    }

    // Default for other files
    return { success: true, stderr: '', stdout: 'No static validator found, assuming valid.', confidence: 'partial' };
  }

  async validateProjectSemantic(affectedFile: string): Promise<{ success: boolean; diff: string; scope: string }> {
    const impactedScopes = this.getImpactedScopes(affectedFile);
    let allPassed = true;
    let combinedOutput = '';
    let runCount = 0;

    for (const scopeRoot of impactedScopes) {
      const pkgPath = path.join(scopeRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.test) {
          try {
            await execAsync(`npm run test`, { timeout: 30000, cwd: scopeRoot });
            combinedOutput += `[${pkg.name || scopeRoot}]: Tests passed.\n`;
            runCount++;
          } catch (e: any) {
            allPassed = false;
            combinedOutput += `[${pkg.name || scopeRoot}]: Tests failed - ${e.stderr || e.message}\n`;
          }
        }
      }
    }
    
    if (runCount === 0) {
      return { success: true, diff: 'No test suites found across impacted scopes. Confidence partial.', scope: impactedScopes.join(', ') };
    }
    
    return { success: allPassed, diff: combinedOutput, scope: impactedScopes.join(', ') };
  }
}
