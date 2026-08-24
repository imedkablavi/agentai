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
        client_secret: 'private',
        safe: 'visible',
      },
    }) as any;
    expect(value.request.api_key).toBe('[REDACTED]');
    expect(value.request.cookie).toBe('[REDACTED]');
    expect(value.request.client_secret).toBe('[REDACTED]');
    expect(value.request.safe).toBe('visible');
  });

  it('removes credentials embedded in URLs', () => {
    const value = redactString('https://user:secret@example.com/private');
    expect(value).not.toContain('secret@example.com');
    expect(value).toContain('[REDACTED]@');
  });

  it('redacts newer token and private-key formats', () => {
    const githubToken = ['github', '_pat_', '11AAABBBCCCDDDEEEFFF_', 'abcdefghijklmnopqrstuvwxyz'].join('');
    const awsKey = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
    const slackToken = ['xoxb', '-', '123456789012', '-', 'abcdefghijklmnop'].join('');
    const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----\n', 'abc123secret\n', '-----END ', 'PRIVATE KEY-----'].join('');
    const value = redactString([githubToken, awsKey, slackToken, privateKey].join('\n'));

    expect(value).not.toContain(githubToken);
    expect(value).not.toContain(awsKey);
    expect(value).not.toContain(slackToken);
    expect(value).not.toContain('abc123secret');
    expect(value).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('minimizes a private home directory in persisted text', () => {
    const value = redactString('/home/alice/projects/private/app.ts failed', 2000, ['/home/alice']);
    expect(value).toBe('~/projects/private/app.ts failed');
    expect(value).not.toContain('/home/alice');
  });
});
