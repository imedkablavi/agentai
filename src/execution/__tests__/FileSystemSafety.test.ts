import { FileSystemSafety } from '../FileSystemSafety';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileSystemSafety', () => {
  let fsSafety: FileSystemSafety;
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-safety-test-'));
    fsSafety = new FileSystemSafety(workDir);
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('allows safe creation and reading inside workspace', async () => {
    const file = 'hello.txt';
    const content = 'hello world';
    const targetPath = path.join(workDir, file);
    fs.writeFileSync(targetPath, content);

    expect(fsSafety.isSafePath(file)).toBe(true);
    const result = await fsSafety.readFile(file);
    expect(result.error).toBeUndefined();
    expect(result.content).toBe(content);
  });

  it('blocks path traversal outside workspace', async () => {
    expect(fsSafety.isSafePath('../outside.txt')).toBe(false);
    expect(fsSafety.isSafePath('/etc/passwd')).toBe(false);
    expect(fsSafety.isSafePath('folder/../../forbidden')).toBe(false);
  });

  it('blocks reading from protected node_modules directory', async () => {
    expect(fsSafety.isSafePath('node_modules/test.js')).toBe(false);
    expect(fsSafety.isSafePath('src/node_modules/test.js')).toBe(false);
    expect(fsSafety.isSafePath('.env')).toBe(false);
    expect(fsSafety.isSafePath('config/.env.local')).toBe(false);
  });

  it('creates backup and rolls back correctly', async () => {
    const file = 'app.ts';
    const content = 'original code';
    const newContent = 'new code';
    const targetPath = path.join(workDir, file);
    
    fs.writeFileSync(targetPath, content);
    const { success, backupPath } = await fsSafety.applyPatch(file, newContent);
    
    expect(success).toBe(true);
    expect(backupPath).toBeDefined();
    expect(fs.readFileSync(targetPath, 'utf8')).toBe(newContent);
    expect(fs.readFileSync(backupPath!, 'utf8')).toBe(content);

    // Now roll it back
    const rolledBack = fsSafety.rollback(file, backupPath!);
    expect(rolledBack).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe(content);
  });

  it('fails writing if size rules violated or empty string provided', async () => {
    const file = 'app.ts';
    fs.writeFileSync(path.join(workDir, file), 'valid');
    
    // Writing completely empty file should fail our integrity check
    const { success } = await fsSafety.applyPatch(file, '   ');
    expect(success).toBe(false);
    
    // Rollback is automatic on failure, so file should remain 'valid'
    expect(fs.readFileSync(path.join(workDir, file), 'utf8')).toBe('valid');
  });

  it('blocks reading large files', async () => {
    const file = 'large.txt';
    const targetPath = path.join(workDir, file);
    
    // Allocate 501KB
    const buf = Buffer.alloc(501 * 1024, 'a');
    fs.writeFileSync(targetPath, buf);

    const result = await fsSafety.readFile(file);
    expect(result.error).toContain('File too large');
  });
});
