import { ValidationEngine } from '../ValidationEngine';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-engine-test-'));
    engine = new ValidationEngine(workDir);
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('detects nearest package boundary', () => {
    const pkgDir = path.join(workDir, 'packages', 'ui');
    fs.mkdirSync(pkgDir, { recursive: true });
    
    // Write package.json
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@my/ui', scripts: { test: 'echo "ok"' } }));
    
    // Create nested file
    const targetFile = path.join(pkgDir, 'src', 'components', 'Button.ts');
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, 'export const btn = 1;');

    const info = engine.getNearestPackageInfo(targetFile);
    expect(info.root).toBe(pkgDir);
    expect(info.pkg.name).toBe('@my/ui');
    expect(info.isWorkspaceRoot).toBe(false);
  });

  it('defaults to workspace root if no package.json found', () => {
    const targetFile = path.join(workDir, 'src', 'index.ts');
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, 'export const app = 1;');

    const info = engine.getNearestPackageInfo(targetFile);
    expect(info.root).toBe(workDir);
    expect(info.isWorkspaceRoot).toBe(true);
  });

  it('scales risk based on file type and impact', () => {
    // Config files are high risk
    const packageRisk = engine.analyzeRisk(path.join(workDir, 'package.json'));
    expect(packageRisk.level).toBe('high');

    // Test files are low risk
    const testRisk = engine.analyzeRisk(path.join(workDir, 'src', 'app.test.ts'));
    expect(testRisk.level).toBe('low');

    // Local code is medium
    const codeRisk = engine.analyzeRisk(path.join(workDir, 'src', 'app.ts'));
    expect(codeRisk.level).toBe('medium');
  });
});
