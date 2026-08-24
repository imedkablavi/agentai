import { buildChildProcessEnv } from '../ChildProcessEnv';

describe('buildChildProcessEnv', () => {
  it('does not inherit ambient token or credential variables', () => {
    const env = buildChildProcessEnv({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      API_TOKEN: 'sensitive-token',
      OPENAI_API_KEY: 'sensitive-key',
      AWS_SECRET_ACCESS_KEY: 'sensitive-secret',
    });

    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/tmp/home');
    expect(env.API_TOKEN).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });

  it('forces non-interactive npm metadata settings', () => {
    const env = buildChildProcessEnv({ PATH: '/usr/bin' });
    expect(env.npm_config_yes).toBe('false');
    expect(env.npm_config_audit).toBe('false');
    expect(env.npm_config_fund).toBe('false');
    expect(env.npm_config_update_notifier).toBe('false');
  });
});
