import { CommandExecutor } from '../CommandExecutor';
import { MemoryManager } from '../../memory/MemoryManager';
import { ContextManager } from '../../context/ContextManager';
import { ExecutionCommand } from '../../types';

describe('CommandExecutor secure developer flows', () => {
  let memory: any;
  let context: any;
  let executor: CommandExecutor;
  let audit: any;

  beforeEach(() => {
    memory = { addLongTermMemory: jest.fn() };
    audit = { record: jest.fn(), recordError: jest.fn() };

    const ctxState: any = {
      state: 'IDLE',
      conversation_history: [],
      awaiting_confirmation: false,
      awaiting_followup: false,
    };
    context = {
      getContext: jest.fn(() => ctxState),
      updateContext: jest.fn((updates) => { Object.assign(ctxState, updates); }),
      setState: jest.fn((state) => { ctxState.state = state; }),
      setLastAction: jest.fn((action) => { ctxState.last_action = action; }),
      setSelectionContext: jest.fn(),
    };

    executor = new CommandExecutor(memory as MemoryManager, context as ContextManager, audit);
    (executor as any).fsSafety = {
      readFile: jest.fn().mockResolvedValue({ content: 'const a = 1;' }),
      applyPatch: jest.fn().mockResolvedValue({ success: true, backupPath: 'mock.backup', createdNewFile: false }),
      rollback: jest.fn().mockReturnValue(true),
      discardBackup: jest.fn(),
    };
    (executor as any).patchGen = {
      proposeFix: jest.fn().mockResolvedValue('```ts\nconst a = 2;\n```'),
      summarizeFile: jest.fn().mockResolvedValue('file summary'),
    };
    (executor as any).validator = {
      analyzeRisk: jest.fn().mockReturnValue({ level: 'medium', reason: 'local', impactedScopes: ['/tmp'] }),
      getNearestPackageInfo: jest.fn().mockReturnValue({ root: process.cwd(), pkg: { scripts: { test: 'jest' } } }),
      validateProjectSemantic: jest.fn().mockResolvedValue({ success: true, diff: 'OK', scope: process.cwd() }),
      validateFile: jest.fn().mockResolvedValue({ success: true, stderr: '', stdout: 'OK', confidence: 'high' }),
    };
    (executor as any).gitSafety = {
      createSafeCheckpoint: jest.fn().mockResolvedValue({ success: false }),
      restoreCheckpoint: jest.fn().mockResolvedValue(true),
      getGitDiff: jest.fn().mockResolvedValue('diff --git a/app.ts b/app.ts'),
    };
  });

  it('dev_inspect succeeds without modifying the file', async () => {
    const cmd: ExecutionCommand = { action: 'dev_inspect', target: 'app.ts', risk_level: 'low', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('dev_inspect');
    expect((executor as any).fsSafety.applyPatch).not.toHaveBeenCalled();
  });

  it('dev_test reports failure without a test script', async () => {
    (executor as any).validator.getNearestPackageInfo = jest.fn().mockReturnValue({ root: process.cwd(), pkg: { scripts: {} } });
    const cmd: ExecutionCommand = { action: 'dev_test', target: 'missing.test.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(false);
  });

  it('dev_fix produces a normalized preview and stages it without applying the target', async () => {
    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('dev_fix_preview');
    expect(context.getContext().awaiting_confirmation).toBe(true);
    expect(context.getContext().dev_patch_content).toBe('const a = 2;');
    expect((executor as any).fsSafety.applyPatch).toHaveBeenCalledWith(expect.stringContaining('.agentai-preview-'), 'const a = 2;');
    expect((executor as any).fsSafety.rollback).toHaveBeenCalled();
  });

  it('applies an already-approved staged patch and discards its backup on success', async () => {
    context.getContext().awaiting_confirmation = true;
    context.getContext().dev_patch_target = 'app.ts';
    context.getContext().dev_patch_content = 'const updated = true;';

    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(true);
    expect((executor as any).fsSafety.applyPatch).toHaveBeenCalledWith('app.ts', 'const updated = true;');
    expect((executor as any).validator.validateProjectSemantic).toHaveBeenCalledWith('app.ts');
    expect((executor as any).fsSafety.discardBackup).toHaveBeenCalledWith('mock.backup');
    expect(context.getContext().dev_patch_content).toBeUndefined();
  });

  it('rolls back after a partial write when semantic validation fails', async () => {
    context.getContext().awaiting_confirmation = true;
    context.getContext().dev_patch_target = 'app.ts';
    context.getContext().dev_patch_content = 'const broken = true;';
    (executor as any).validator.validateProjectSemantic = jest.fn().mockResolvedValue({
      success: false,
      diff: 'tests failed',
      scope: process.cwd(),
    });

    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(false);
    expect((executor as any).fsSafety.rollback).toHaveBeenCalledWith('app.ts', 'mock.backup', false);
  });

  it('keeps open/read file actions read-only', async () => {
    const openCmd: ExecutionCommand = { action: 'open_file', target: 'app.ts', risk_level: 'low', requires_confirmation: false };
    const readCmd: ExecutionCommand = { action: 'read_file', target: 'app.ts', risk_level: 'low', requires_confirmation: false };
    expect((await executor.execute(openCmd, 'en')).success).toBe(true);
    expect((await executor.execute(readCmd, 'en')).success).toBe(true);
    expect((executor as any).fsSafety.applyPatch).not.toHaveBeenCalledWith('app.ts', expect.anything());
  });

  it('refuses legacy direct confirmation flags inside the executor', async () => {
    const cmd: ExecutionCommand = { action: 'system_shutdown', risk_level: 'high', requires_confirmation: true };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(false);
    expect(res.requires_followup).toBe(true);
  });
});
