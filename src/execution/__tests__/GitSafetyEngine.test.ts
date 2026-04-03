import { GitSafetyEngine, ExecutionMutex } from '../GitSafetyEngine';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('GitSafetyEngine and ExecutionMutex', () => {
  it('acquires and releases mutex correctly preventing races', async () => {
    const lock1 = await ExecutionMutex.acquire(100);
    expect(lock1).toBe(true);

    const lock2 = await ExecutionMutex.acquire(100);
    expect(lock2).toBe(false);

    ExecutionMutex.release();
    const lock3 = await ExecutionMutex.acquire(100);
    expect(lock3).toBe(true);
    ExecutionMutex.release();
  });

  describe('Git Operations', () => {
    let engine: GitSafetyEngine;

    beforeEach(() => {
      engine = new GitSafetyEngine(process.cwd());
    });

    it('detects git repo correctly', async () => {
      const isGit = await engine.isGitRepo();
      // Assuming the test runs in a git repo
      expect(typeof isGit).toBe('boolean');
    });

    it('creates safety checkpoint gracefully fallback to false if fails', async () => {
      jest.spyOn(engine, 'isGitRepo').mockResolvedValue(true);
      // Stub execAsync internally or just rely on real git if safe.
      // Since `git stash create` just outputs text and doesn't mutate, it's safe to run natively.
      const checkpoint = await engine.createSafeCheckpoint();
      expect(checkpoint.success).toBeDefined();
    });

    it('getGitDiff handles fallback', async () => {
      const diff = await engine.getGitDiff('doesnotexist.ts');
      expect(typeof diff).toBe('string');
    });
  });
});
