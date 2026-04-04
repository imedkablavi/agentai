import { CommandExecutor } from '../CommandExecutor';
import { ContextManager } from '../../context/ContextManager';
import { MemoryManager } from '../../memory/MemoryManager';
import { ExecutionCommand } from '../../types';

describe('CommandExecutor localization and dev_fix state safety', () => {
  function makeExecutor(): { executor: CommandExecutor; context: any } {
    const memory = { addLongTermMemory: jest.fn() } as unknown as MemoryManager;
    let ctxState: any = {
      conversation_history: [],
      awaiting_confirmation: false,
      awaiting_followup: false,
      state: 'IDLE'
    };
    const context: any = {
      getContext: jest.fn(() => ctxState),
      updateContext: jest.fn((upd: any) => { Object.assign(ctxState, upd); }),
      setState: jest.fn(),
      setLastAction: jest.fn(),
      setSelectionContext: jest.fn()
    };
    const executor = new CommandExecutor(memory, context as ContextManager);
    return { executor, context };
  }

  it('returns localized missing file message for read_file in English', async () => {
    const { executor } = makeExecutor();
    const cmd: ExecutionCommand = { action: 'read_file', target: '', risk_level: 'low', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');
    expect(res.success).toBe(false);
    expect(res.error_detail?.user_message).toContain('File not specified');
  });

  it('keeps staged dev patch when semantic validation fails', async () => {
    const { executor, context } = makeExecutor();
    const ctx = context.getContext();
    ctx.awaiting_confirmation = true;
    ctx.dev_patch_target = 'app.ts';
    ctx.dev_patch_content = 'const x = 1;';

    (executor as any).fsSafety = {
      applyPatch: jest.fn().mockResolvedValue({ success: true, backupPath: 'app.ts.backup' }),
      rollback: jest.fn()
    };
    (executor as any).validator = {
      validateProjectSemantic: jest.fn().mockResolvedValue({ success: false, scope: 'root', diff: 'tests failed' })
    };
    (executor as any).gitSafety = {
      createSafeCheckpoint: jest.fn().mockResolvedValue({ success: false }),
      restoreCheckpoint: jest.fn().mockResolvedValue(true),
      getGitDiff: jest.fn().mockResolvedValue('')
    };

    const cmd: ExecutionCommand = { action: 'dev_fix', target: 'app.ts', risk_level: 'medium', requires_confirmation: false };
    const res = await executor.execute(cmd, 'en');

    expect(res.success).toBe(false);
    const updatedCtx = context.getContext();
    expect(updatedCtx.dev_patch_target).toBe('app.ts');
    expect(updatedCtx.dev_patch_content).toBe('const x = 1;');
    expect(updatedCtx.awaiting_confirmation).toBe(true);
  });
});
