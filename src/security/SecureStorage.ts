import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

export function getAgentDataDir(): string {
  const configured = process.env.AGENTAI_DATA_DIR?.trim();
  return path.resolve(configured || path.join(os.homedir(), '.agentai'));
}

export function ensurePrivateDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows and some filesystems do not expose POSIX permissions.
  }
}

export function writePrivateFileAtomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensurePrivateDir(dir);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    try {
      fs.chmodSync(tempPath, 0o600);
    } catch {
      // Best effort on platforms without POSIX permission support.
    }
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Do not mask the original storage error.
      }
    }
  }
}

export function writePrivateJsonAtomic(filePath: string, value: unknown): void {
  writePrivateFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
