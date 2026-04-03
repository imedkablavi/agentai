import { CommandExecutor } from '../CommandExecutor';
import { MemoryManager } from '../../memory/MemoryManager';
import { ContextManager } from '../../context/ContextManager';
import { ExecutionCommand } from '../../types';

describe('CommandExecutor Dev Flows', () => {
  let memory: any;
  let context: any;
  let executor: CommandExecutor;

  beforeEach(() => {
    // Mock memory
    memory = {
      addLongTermMemory: jest.fn(),
    };

    // Mock context
    let ctxState: any = {
       conversation_history: [],
       awaiting_confirmation: false,
       awaiting_followup: false
    };
    context = {
      getContext: jest.fn(() => ctxState),
      updateContext: jest.fn((upd) => { Object.assign(ctxState, upd) }),
      setState: jest.fn(),
      setLastAction: jest.fn(),
      setSelectionContext: jest.fn()
    };

    executor = new CommandExecutor(memory as MemoryManager, context as ContextManager);

    // Mock internal units cleanly by injecting stubs instead of actual file system triggers
    (executor as any).fsSafety = {
      readFile: jest.fn().mockResolvedValue({ content: 'const a = 1;' }),
      applyPatch: jest.fn().mockResolvedValue({ success: true, backupPath: 'mock.backup' }),
      rollback: jest.fn()
    };

    (executor as any).patchGen = {
      proposeFix: jest.fn().mockResolvedValue('```\nconst a = 2;\n```'),
      summarizeFile: jest.fn().mockResolvedValue('الملف سليم')
    };

    (executor as any).validator = {
      analyzeRisk: jest.fn().mockReturnValue({ level: 'medium', reason: 'local', impactedScopes: ['/tmp'] }),
      getNearestPackageInfo: jest.fn().mockReturnValue({ root: process.cwd(), pkg: { scripts: { test: 'jest' } } }),
      validateProjectSemantic: jest.fn().mockResolvedValue({ success: true, diff: 'OK' }),
      validateFile: jest.fn().mockResolvedValue({ success: true, stderr: '', stdout: 'OK', confidence: 'high' })
    };
    (executor as any).gitSafety = {
      createSafeCheckpoint: jest.fn().mockResolvedValue({ success: false }),
      restoreCheckpoint: jest.fn().mockResolvedValue(true),
      getGitDiff: jest.fn().mockResolvedValue('diff --git a/app.ts b/app.ts')
    };
  });

  it('dev_inspect succeeds and produces summary', async () => {
    const cmd: ExecutionCommand = { action: 'dev_inspect', target: 'app.ts', risk_level: 'low', requires_confirmation: false };
    const res = await executor.execute(cmd, 'ar');
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('dev_inspect');
    expect(res.data?.result).toContain('الملف سليم');
  });

  it('dev_test returns failure when tests fail', async () => {
    (executor as any).validator.getNearestPackageInfo = jest.fn().mockReturnValue({
      root: process.cwd(),
      pkg: { scripts: {} }
    });
    const cmd: ExecutionCommand = { action: 'dev_test', target: 'missing.test.ts', risk_level: 'low', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(false);
  });

  it('dev_fix generates preview and requires confirmation', async () => {
    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'ar');
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('dev_fix_preview');
    expect(res.requires_followup).toBe(true);
    
    // Verify context was staged
    const updatedCtx = context.getContext();
    expect(updatedCtx.awaiting_confirmation).toBe(true);
    expect(updatedCtx.dev_patch_content).toBe('```\nconst a = 2;\n```');
  });

  it('dev_fix applies patch when confirmation is met', async () => {
    // Prime the context
    context.getContext().awaiting_confirmation = true;
    context.getContext().dev_patch_target = 'app.ts';
    context.getContext().dev_patch_content = 'const updated = true;';

    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    
    // Mock the syntax check internally since child_process uses actual `node --check`
    jest.spyOn((executor as any), 'logDevAction').mockImplementation(() => {});

    const res = await executor.execute(cmd, 'ar');
    expect(res.success).toBe(true);
    expect((executor as any).fsSafety.applyPatch).toHaveBeenCalledWith('app.ts', 'const updated = true;');
  });

  it('open_file and read_file are safe and return content', async () => {
    const openCmd: ExecutionCommand = { action: 'open_file', target: 'app.ts', risk_level: 'low', requires_confirmation: false };
    const readCmd: ExecutionCommand = { action: 'read_file', target: 'app.ts', risk_level: 'low', requires_confirmation: false };

    const openRes = await executor.execute(openCmd, 'ar');
    const readRes = await executor.execute(readCmd, 'ar');

    expect(openRes.success).toBe(true);
    expect(openRes.data?.action).toBe('open_file');
    expect(readRes.success).toBe(true);
    expect(readRes.data?.action).toBe('read_file');
  });
});
