import { redactString, redactValue } from '../Redaction';

describe('secret redaction', () => {
  it('redacts bearer tokens and common credential assignments', () => {
    const value = redactString('Authorization: Bearer abcdefghijklmnop token=supersecret password=hunter2');
    expect(value).not.toContain('abcdefghijklmnop');
    expect(value).not.toContain('supersecret');
    expect(value).not.toContain('hunter2');
    expect(value).toContain('[REDACTED]');
  });

  it('redacts sensitive object keys recursively', () => {
    const value = redactValue({
      request: {
        api_key: 'abc123',
        cookie: 'session=value',
        safe: 'visible',
      },
    }) as any;
    expect(value.request.api_key).toBe('[REDACTED]');
    expect(value.request.cookie).toBe('[REDACTED]');
    expect(value.request.safe).toBe('visible');
  });

  it('removes credentials embedded in URLs', () => {
    const value = redactString('https://user:secret@example.com/private');
    expect(value).not.toContain('secret@example.com');
    expect(value).toContain('[REDACTED]@');
  });
});
