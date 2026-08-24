const SAFE_ENV_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'COMSPEC',
  'HOME',
  'USERPROFILE',
  'TMP',
  'TEMP',
  'TMPDIR',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_RUNTIME_DIR',
  'CI',
  'NODE_ENV',
] as const;

/**
 * Build a deliberately small environment for tools that execute workspace code.
 *
 * This is not an OS sandbox: child processes can still access resources permitted
 * to the current user. The goal is to avoid handing arbitrary workspace scripts
 * ambient API keys/tokens through environment variables by default.
 */
export function buildChildProcessEnv(
  source: NodeJS.ProcessEnv = process.env,
  extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }

  env.npm_config_yes = 'false';
  env.npm_config_audit = 'false';
  env.npm_config_fund = 'false';
  env.npm_config_update_notifier = 'false';

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}
