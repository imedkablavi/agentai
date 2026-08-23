# AgentAI Threat Model

## Purpose

This threat model covers the AgentAI execution, memory, scheduler, and logging architecture in the repository. It focuses on preventing ambiguous/model-generated intent from becoming unauthorized local effects.

## Assets

- user files inside the selected workspace
- files and credentials outside the workspace
- local application/process state
- host power/session state on Windows
- remembered user data and preferences
- scheduled task definitions
- audit evidence
- source code being inspected or patched

## Trust boundaries

### 1. User/model intent → skill routing

Intent text and LLM/classifier output are untrusted interpretation inputs. Confidence is not an authority signal.

**Invariant:** no confidence value, including `1.0`, grants permission to execute an impactful operation.

### 2. Skill → execution layer

A built-in or third-party skill emits an `ExecutionCommand`.

**Invariant:** a skill cannot add an arbitrary command simply by setting a target or low risk level. `ExecutionPolicy` must recognize the action and validate its target.

**Residual risk:** a third-party skill is JavaScript loaded into the AgentAI process. The policy constrains commands routed through the normal executor, but it cannot sandbox malicious plugin code that directly calls Node.js APIs. Third-party skills therefore remain trusted code.

### 3. Workspace → host filesystem

Developer/file features operate in the current process workspace.

**Invariant:** normalized paths and existing symlink resolution must remain within the workspace. VCS, dependency/build, `.env`, credential, private-key and certificate locations are rejected by built-in file/developer paths.

**Residual risk:** the workspace itself is trusted input. A user should not point AgentAI at an untrusted repository and then approve execution of that repository's package scripts without reviewing the preview.

### 4. Preview → approval → execution

Approval-gated actions are represented by a pending command with a random ID and five-minute expiry.

**Invariants:**

- approval is exact, not substring-based
- approval authorizes only the pending command
- unrelated new input cancels stale approval
- cancellation never executes the pending command
- the executor receives the approved command, not a newly classified replacement

### 5. Interactive → scheduled execution

Scheduled tasks are persistent automation.

**Invariants:**

- new tasks start disabled
- enabling a new schedule requires explicit approval
- persisted context snapshots omit conversation history and active topic
- a due task is re-evaluated by `ExecutionPolicy` in `scheduled` mode
- scheduled mode denies any operation requiring interactive approval

### 6. Process → subprocess

Subprocess execution can cross into host command execution.

**Invariant:** built-in execution paths use fixed executables with argument arrays (`execFile`/`spawn` with `shell: false`) instead of interpolating untrusted input into shell command strings.

**Residual risk:** approved project scripts such as `npm run test` execute code defined by the workspace. Approval means the user accepts that project-level execution risk; it is not sandboxed.

### 7. Process → persistent memory/audit storage

Runtime data can contain private information.

**Invariants:**

- default storage is outside the repository (`~/.agentai` or `AGENTAI_DATA_DIR`)
- short-term memory is non-persistent by default
- automatic long-term inference is off by default
- persistent memory writes require explicit approval
- audit data is redacted before persistence
- audit files have bounded rotation
- old committed session/memory/scheduler runtime files are removed from the hardened branch and future paths are ignored

**Residual risk:** redaction is defense-in-depth and cannot mathematically detect every secret format. Callers should avoid including unnecessary content in audit details. Host backups/snapshots can retain deleted files.

## Main threat scenarios

| Threat | Example | Control | Residual risk |
|---|---|---|---|
| Confidence becomes permission | classifier says shutdown with 100% confidence | centralized policy + mandatory system approval | semantic false positives still possible, but do not bypass approval |
| Approval confusion | user says `yes and shutdown` while another action is pending | exact approval parser | social-engineering remains possible if user approves a misleading preview; previews must remain specific |
| Stale approval reuse | pending close-app approval followed by unrelated command | unrelated input cancels pending state | no cross-session durable approval exists |
| Arbitrary shell injection | target contains `;`, `&&`, backticks, `$()` | action/target allowlists + argv subprocess APIs | approved package scripts may themselves invoke shells |
| Path traversal | `../secret`, sibling prefix, symlink escape | `path.relative` boundary + realpath checks | TOCTOU changes by another local process are not fully eliminated |
| Secret logs | token appears in error/message | structured redaction before audit write | unknown secret encodings may evade pattern redaction |
| Raw transcript leakage | CLI writes every input/response to `logs/` | raw session logging removed | terminal/shell history is outside AgentAI's control |
| Memory over-retention | habits stored forever | 30-day default + configurable pruning/deletion | preferences are separate and intentionally retained by memory-clear unless separately changed |
| Scheduled destructive action | daily shutdown intent | scheduled policy rejects interactive-approval commands | safe/non-impacting scheduled actions still execute with user-created schedule |
| Partial developer write | patch written, tests fail | private backup + semantic validation + rollback | rollback can fail under disk/permission/hardware failure; audit records failure/rollback attempts |
| Malicious third-party skill | skill directly imports `child_process` | documentation/trust boundary; policy constrains normal commands | no plugin sandbox; do not load untrusted skills |

## High-impact actions

The built-in policy treats these as approval-gated:

- Windows shutdown/restart/lock/sleep
- application termination
- project test execution
- persistent memory write
- application of a staged code patch
- any future skill command whose `requires_confirmation` flag is true

Linux power/session actions are currently denied rather than implemented through guessed shell commands.

## Developer patch transaction

The developer fix flow is intentionally two-phase:

1. Read a workspace-scoped file.
2. Generate a candidate replacement.
3. Write the candidate to a temporary preview file that preserves the original extension.
4. Run static validation on that preview.
5. Delete/roll back the preview file.
6. Present a preview to the user.
7. Only after command-bound approval, create a private backup and atomically replace the target.
8. Run semantic/project validation.
9. If validation fails, restore the backup (or delete a newly-created target).
10. If validation succeeds, discard the backup.

A passing validator does not prove semantic correctness or security of generated code; it only establishes the checks that actually ran.

## Denial-of-service considerations

- file reads are capped at 500 KB through the built-in text reader
- patch content is capped at 2 MB
- subprocesses have timeouts and output buffers
- search HTTP requests have timeouts and content-size limits
- audit log rotation is bounded
- path scanning ignores dependency/build/VCS directories and has a depth limit

This is not a complete host resource sandbox. Disk exhaustion, malicious workspace build scripts, or hostile external providers can still consume resources within OS/process limits.

## Assumptions

- AgentAI runs as a non-elevated user in normal use.
- The operating system account boundary protects `~/.agentai` from other users.
- The workspace is intentionally selected by the user.
- Node.js and platform executables are trusted.
- Users review previews before approving impactful operations.
- Third-party skills are trusted code unless a future sandbox model is introduced.

## Security regression requirements

Changes to execution, skills, intent routing, memory, scheduler, logging, or path handling should add tests demonstrating the relevant invariant. At minimum, CI should retain coverage for:

- high-confidence destructive action still needs approval
- exact approval binding/cancellation
- unknown action denial
- traversal/protected path denial
- scheduled approval bypass denial
- secret redaction at persisted audit boundary
- memory retention/deletion defaults
- rollback after failed post-write validation
- ambiguous/compound intent rejection
