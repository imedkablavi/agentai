import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditTrail } from '../AuditTrail';

describe('AuditTrail', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-audit-'));
  });

  afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it('persists structured redacted events without raw secrets', () => {
    const audit = new AuditTrail(dataDir);
    audit.record({
      action: 'test_action',
      outcome: 'failure',
      target: 'safe.txt',
      detail: {
        authorization: 'Bearer top-secret-token',
        message: 'token=another-secret',
        safe: 'visible',
      },
    });

    const raw = fs.readFileSync(audit.getPath(), 'utf8');
    expect(raw).not.toContain('top-secret-token');
    expect(raw).not.toContain('another-secret');
    expect(raw).toContain('[REDACTED]');
    expect(raw).toContain('visible');
  });

  it('supports local audit deletion', () => {
    const audit = new AuditTrail(dataDir);
    audit.record({ action: 'test_action', outcome: 'success' });
    expect(fs.existsSync(audit.getPath())).toBe(true);
    audit.clear();
    expect(fs.existsSync(audit.getPath())).toBe(false);
  });
});
