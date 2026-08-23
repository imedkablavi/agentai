import { FileSystemSafety } from '../FileSystemSafety';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileSystemSafety', () => {
  let fsSafety: FileSystemSafety;
  let workDir: string;
  let dataDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-safety-work-'));
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-safety-data-'));
    fsSafety = new FileSystemSafety(workDir, dataDir);
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('allows safe creation and reading inside workspace', async () => {
    const file = 'hello.txt';
    const content = 'hello world';
    fs.writeFileSync(path.join(workDir, file), content);

    expect(fsSafety.isSafePath(file)).toBe(true);
    const result = await fsSafety.readFile(file);
    expect(result.error).toBeUndefined();
    expect(result.content).toBe(content);
  });

  it('blocks traversal, absolute escapes and protected paths', () => {
    expect(fsSafety.isSafePath('../outside.txt')).toBe(false);
    if (process.platform !== 'win32') expect(fsSafety.isSafePath('/etc/passwd')).toBe(false);
    expect(fsSafety.isSafePath('folder/../../forbidden')).toBe(false);
    expect(fsSafety.isSafePath('node_modules/test.js')).toBe(false);
    expect(fsSafety.isSafePath('.git/config')).toBe(false);
    expect(fsSafety.isSafePath('.env')).toBe(false);
    expect(fsSafety.isSafePath('config/.env.local')).toBe(false);
    expect(fsSafety.isSafePath('secret.pem')).toBe(false);
  });

  it('stores rollback backups outside the workspace and restores atomically', async () => {
    const file = 'app.ts';
    fs.writeFileSync(path.join(workDir, file), 'original code');
    const receipt = await fsSafety.applyPatch(file, 'new code');

    expect(receipt.success).toBe(true);
    expect(receipt.backupPath).toBeDefined();
    expect(path.resolve(receipt.backupPath!)).toContain(path.resolve(dataDir));
    expect(path.resolve(receipt.backupPath!)).not.toContain(path.resolve(workDir) + path.sep);
    expect(fs.readFileSync(path.join(workDir, file), 'utf8')).toBe('new code');

    expect(fsSafety.rollback(file, receipt.backupPath, receipt.createdNewFile)).toBe(true);
    expect(fs.readFileSync(path.join(workDir, file), 'utf8')).toBe('original code');
    expect(fs.existsSync(receipt.backupPath!)).toBe(false);
  });

  it('removes a newly-created file during rollback', async () => {
    const receipt = await fsSafety.applyPatch('new.ts', 'export const value = 1;');
    expect(receipt.success).toBe(true);
    expect(receipt.createdNewFile).toBe(true);
    expect(fs.existsSync(path.join(workDir, 'new.ts'))).toBe(true);
    expect(fsSafety.rollback('new.ts', receipt.backupPath, receipt.createdNewFile)).toBe(true);
    expect(fs.existsSync(path.join(workDir, 'new.ts'))).toBe(false);
  });

  it('leaves the original file unchanged when invalid content is rejected', async () => {
    const file = 'app.ts';
    fs.writeFileSync(path.join(workDir, file), 'valid');
    const receipt = await fsSafety.applyPatch(file, '   ');
    expect(receipt.success).toBe(false);
    expect(fs.readFileSync(path.join(workDir, file), 'utf8')).toBe('valid');
  });

  it('blocks reading large and binary files', async () => {
    fs.writeFileSync(path.join(workDir, 'large.txt'), Buffer.alloc(501 * 1024, 'a'));
    expect((await fsSafety.readFile('large.txt')).error).toContain('File too large');

    fs.writeFileSync(path.join(workDir, 'binary.bin'), Buffer.from([1, 2, 0, 4]));
    expect((await fsSafety.readFile('binary.bin')).error).toContain('Binary');
  });
});
