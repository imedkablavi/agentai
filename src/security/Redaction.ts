const SENSITIVE_KEY = /(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|cookie|session|credential|private[_-]?key)/i;

const STRING_REDACTIONS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]'],
  [/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_TOKEN]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]'],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_API_KEY]'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]'],
  [/(https?:\/\/[^\s:/]+:)[^@\s]+@/gi, '$1[REDACTED]@'],
  [/((?:api[_-]?key|token|password|passwd|secret|cookie|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]'],
];

export function redactString(input: string, maxLength = 2000): string {
  let output = input;
  for (const [pattern, replacement] of STRING_REDACTIONS) {
    output = output.replace(pattern, replacement);
  }
  if (output.length > maxLength) {
    output = `${output.slice(0, maxLength)}…[TRUNCATED]`;
  }
  return output;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redactValue(item, depth + 1));

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactValue(item, depth + 1);
    }
    return output;
  }

  return redactString(String(value));
}

export function redactedError(error: unknown): string {
  if (error instanceof Error) return redactString(error.message, 1000);
  return redactString(String(error), 1000);
}
