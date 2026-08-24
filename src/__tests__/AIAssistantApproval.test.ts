import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AIAssistant } from '../AIAssistant';
import { ExecutionPolicy } from '../security/ExecutionPolicy';
import { Intent } from '../types';

describe('AIAssistant command-bound approval flow', () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  let assistant: AIAssistant;
  let execute: jest.Mock;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-approval-'));
    previousDataDir = process.env.AGENTAI_DATA_DIR;
    process.env.AGENTAI_DATA_DIR = dataDir;

    assistant = new AIAssistant();
    (assistant as any).policy = new ExecutionPolicy(process.cwd(), 'win32');
    execute = jest.fn().mockResolvedValue({ success: true, data: { action: 'system_shutdown' } });
    (assistant as any).executor.execute = execute;

    (assistant as any).llm.infer = jest.fn(async (text: string) => {
      const normalized = text.trim().toLowerCase();
      if (normalized === 'shutdown') {
        const intent: Intent = {
          name: 'system_command',
          confidence: 1,
          language: 'en',
          context_required: false,
          entities: {},
          raw_text: 'shutdown',
        };
        return intent;
      }
      if (normalized === 'stop tasks') {
        const intent: Intent = {
          name: 'stop_tasks',
          confidence: 1,
          language: 'en',
          context_required: false,
          entities: {},
          raw_text: 'stop tasks',
        };
        return intent;
      }
      return null;
    });
  });

  afterEach(() => {
    assistant.shutdown();
    if (previousDataDir === undefined) delete process.env.AGENTAI_DATA_DIR;
    else process.env.AGENTAI_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('does not execute a destructive system command solely because confidence is high', async () => {
    const preview = await assistant.processInput('shutdown');
    expect(preview.requiresFollowUp).toBe(true);
    expect(preview.response.toLowerCase()).toContain('preview');
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires an exact approval token and does not reuse stale approval', async () => {
    await assistant.processInput('shutdown');
    await assistant.processInput('yes and shutdown');
    expect(execute).not.toHaveBeenCalled();

    await assistant.processInput('shutdown');
    await assistant.processInput('Yes');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toMatchObject({ action: 'system_shutdown', requires_confirmation: false });
  });

  it('cancellation prevents execution', async () => {
    await assistant.processInput('shutdown');
    const cancelled = await assistant.processInput('Cancel');
    expect(cancelled.response).toContain('cancelled');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not disable schedules before a command-bound approval', async () => {
    const disableAll = jest.spyOn((assistant as any).scheduler, 'disableAll');

    const preview = await assistant.processInput('stop tasks');
    expect(preview.requiresFollowUp).toBe(true);
    expect(disableAll).not.toHaveBeenCalled();
    expect(preview.context.pending_execution?.command.action).toBe('scheduler_disable_all');

    await assistant.processInput('Yes');
    expect(disableAll).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects oversized input before LLM or memory processing', async () => {
    const infer = (assistant as any).llm.infer as jest.Mock;
    infer.mockClear();
    const result = await assistant.processInput('x'.repeat(8001));
    expect(result.response).toContain('8,000');
    expect(infer).not.toHaveBeenCalled();
  });
});
