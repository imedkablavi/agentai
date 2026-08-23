import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExecutionPolicy } from '../ExecutionPolicy';
import { ConversationContext, ExecutionCommand } from '../../types';

function context(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    state: 'IDLE',
    awaiting_followup: false,
    awaiting_confirmation: false,
    conversation_history: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function command(overrides: Partial<ExecutionCommand>): ExecutionCommand {
  return {
    action: 'read_file',
    risk_level: 'low',
    requires_confirmation: false,
    ...overrides,
  };
}

describe('ExecutionPolicy', () => {
  let workspace: string;
  let policy: ExecutionPolicy;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-policy-'));
    fs.writeFileSync(path.join(workspace, 'safe.txt'), 'ok');
    policy = new ExecutionPolicy(workspace, 'win32');
  });

  afterEach(() => fs.rmSync(workspace, { recursive: true, force: true }));

  it('always requires explicit approval for Windows system actions', () => {
    const decision = policy.evaluate(command({ action: 'system_shutdown', risk_level: 'high' }), context());
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it('denies system actions on Linux rather than pretending support', () => {
    const linux = new ExecutionPolicy(workspace, 'linux');
    const decision = linux.evaluate(command({ action: 'system_restart', risk_level: 'high' }), context());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Windows');
  });

  it('rejects unregistered actions even when marked low risk', () => {
    const decision = policy.evaluate(command({ action: 'arbitrary_shell', risk_level: 'low' }), context());
    expect(decision.allowed).toBe(false);
  });

  it('confines file paths to the workspace and protected locations', () => {
    expect(policy.evaluate(command({ target: 'safe.txt' }), context()).allowed).toBe(true);
    expect(policy.evaluate(command({ target: '../outside.txt' }), context()).allowed).toBe(false);
    expect(policy.evaluate(command({ target: '.env' }), context()).allowed).toBe(false);
    expect(policy.evaluate(command({ target: '.git/config' }), context()).allowed).toBe(false);
  });

  it('rejects sibling-prefix and shell-metacharacter path tricks', () => {
    const sibling = `${path.basename(workspace)}-evil/file.txt`;
    expect(policy.evaluate(command({ target: path.join('..', sibling) }), context()).allowed).toBe(false);
    expect(policy.evaluate(command({ target: 'safe.txt;echo pwned' }), context()).allowed).toBe(false);
  });

  it('allows only exact application names and gates termination', () => {
    const open = policy.evaluate(command({ action: 'open_application', target: 'firefox' }), context());
    expect(open.allowed).toBe(true);
    expect(open.requiresApproval).toBe(false);

    const close = policy.evaluate(command({ action: 'close_application', target: 'firefox', risk_level: 'medium' }), context());
    expect(close.allowed).toBe(true);
    expect(close.requiresApproval).toBe(true);

    expect(policy.evaluate(command({ action: 'open_application', target: 'firefox;calc' }), context()).allowed).toBe(false);
  });

  it('requires approval before persistent memory writes', () => {
    const decision = policy.evaluate(command({ action: 'store_memory', params: { content: 'remember this' }, risk_level: 'medium' }), context());
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it('gates test execution and staged patch application', () => {
    const testDecision = policy.evaluate(command({ action: 'dev_test', target: undefined, risk_level: 'medium' }), context());
    expect(testDecision.requiresApproval).toBe(true);

    const preview = policy.evaluate(command({ action: 'dev_fix', target: 'safe.txt', risk_level: 'medium' }), context());
    expect(preview.allowed).toBe(true);
    expect(preview.requiresApproval).toBe(false);

    const apply = policy.evaluate(
      command({ action: 'dev_fix', target: 'safe.txt', risk_level: 'medium' }),
      context({ dev_patch_target: 'safe.txt', dev_patch_content: 'new' }),
    );
    expect(apply.requiresApproval).toBe(true);
  });

  it('never auto-runs an approval-gated action from the scheduler', () => {
    const decision = policy.evaluate(command({ action: 'system_shutdown', risk_level: 'high' }), context(), 'scheduled');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('interactive approval');
  });

  it('honors skill-declared confirmation even for otherwise low-impact actions', () => {
    const decision = policy.evaluate(command({ action: 'open_application', target: 'firefox', requires_confirmation: true }), context());
    expect(decision.requiresApproval).toBe(true);
  });

  it('accepts only exact approval/cancel tokens', () => {
    expect(policy.parseApproval('Yes')).toBe('approve');
    expect(policy.parseApproval('نعم')).toBe('approve');
    expect(policy.parseApproval('Evet')).toBe('approve');
    expect(policy.parseApproval('Cancel')).toBe('cancel');
    expect(policy.parseApproval('yes and shutdown')).toBe('none');
    expect(policy.parseApproval('نعم احذف كل شيء')).toBe('none');
  });
});
