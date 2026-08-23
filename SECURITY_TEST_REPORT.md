# AgentAI Security Test Report

**Branch:** `security/product-architecture-hardening`  
**Base:** `main`  
**Scope:** execution, skill routing, intent ambiguity, filesystem/developer actions, scheduler, memory, audit/logging, CLI packaging, Windows/Linux support claims  
**Qualification status:** **PENDING CI** — this report is updated with actual GitHub Actions results before the hardening pass is considered qualified.

## Executive summary

The pre-hardening architecture mixed semantic confidence with execution authorization in several places. A high confidence score could satisfy permission checks for destructive/system commands. The repository also contained shell-interpolated subprocess calls, prefix-based filesystem boundary checks, raw runtime logs/state committed in the repository, broad memory persistence, and approval state that was not cryptographically/random-ID bound to a specific pending command.

This branch changes the architecture so that:

1. confidence affects interpretation/routing only;
2. every normal skill output is evaluated by a centralized `ExecutionPolicy`;
3. impactful operations are previewed and require exact, command-bound approval;
4. scheduled execution cannot auto-run an operation that needs interactive approval;
5. subprocesses use fixed executables and argument arrays rather than user-interpolated shell command strings;
6. filesystem/developer paths are workspace-scoped with protected-path and symlink checks;
7. audit/runtime state is private local state outside the repository, with redaction before persistence;
8. memory persistence defaults are privacy-preserving and expose retention/deletion controls;
9. developer writes use atomic replacement, private backups and rollback after failed post-write validation;
10. README/package metadata no longer claim unmeasured performance or Windows-only/general Linux capabilities that are not implemented.

## Findings and remediation

| ID | Pre-hardening finding | Risk | Remediation in this branch |
|---|---|---:|---|
| SEC-01 | High intent confidence was treated as permission for system/destructive operations. | Critical | Removed confidence authorization from `SkillRouter`, `SystemSkill`, and orchestrator flow. `ExecutionPolicy` is now the authorization decision point. |
| SEC-02 | User-derived paths/targets were interpolated into shell command strings in execution, Git and validation paths. | High | Replaced built-in execution with `execFile`/`spawn` argument arrays and fixed executables; unknown actions are denied. |
| SEC-03 | Filesystem scope relied on string-prefix checks and did not consistently resolve symlink boundaries. | High | Normalized `path.relative` boundary checks, protected paths, realpath checks, size/binary limits. |
| SEC-04 | CLI/runtime logs and memory/scheduler state were stored in repository paths; session logs included raw user/assistant text. | High privacy | Removed raw session transcript logging, moved state to `~/.agentai`/`AGENTAI_DATA_DIR`, added redacted structured audit trail, removed committed runtime state from the branch. |
| SEC-05 | Short-term memory persisted by default and repetitive behavior could become long-term memory automatically. | Medium privacy | Short-term persistence off by default; automatic pattern persistence off by default; explicit persistent memory is approval-gated; 30-day default retention plus deletion APIs/CLI. |
| SEC-06 | Confirmation was represented largely as generic context state rather than a command-bound authorization. | High | Added random-ID `PendingExecution` record with exact command/preview and five-minute expiry. Exact approval tokens only; unrelated input cancels stale pending state. |
| SEC-07 | Scheduler execution had a separate path that could diverge from interactive authorization. | High | New schedules start disabled and need approval. Due tasks are re-evaluated in `scheduled` policy mode; approval-gated commands are denied for that run. |
| SEC-08 | Developer fix rollback did not model newly-created targets/private backups as one explicit transaction. | Medium/High | Same-directory atomic temp write, private rollback storage, rollback of existing or newly-created target, post-write semantic validation. |
| SEC-09 | Package metadata described a Windows assistant and did not expose a proper CLI `bin`. | Product/security clarity | Added `agentai` bin/library entry, prepack checks, realistic support matrix and host-boundary documentation. |
| SEC-10 | README claimed `< 1 second average` response time without a reproducible benchmark. | Trust | Removed the performance claim. No replacement number is asserted without measurement. |

## Security invariants under test

The branch includes automated tests for:

- high-confidence destructive intent does not bypass approval;
- command-bound approval, exact approval token parsing, cancellation, and stale-approval invalidation;
- unregistered action denial;
- application allowlist and termination approval;
- workspace traversal, protected path and sibling-prefix rejection;
- Linux system actions denied rather than guessed;
- scheduled approval-bypass prevention;
- secret redaction before audit persistence;
- audit deletion;
- short-term memory non-persistence by default;
- opt-in short-term persistence;
- long-term retention pruning and deletion;
- scheduler disabled-by-default behavior and minimized snapshots;
- developer preview does not modify the target;
- atomic/private rollback and newly-created-file rollback;
- semantic-validation failure triggers rollback;
- ambiguous pronoun-only input and compound destructive intent rejection;
- third-party skill output still passes through action allowlisting when it uses the normal executor path.

## CI qualification matrix

Workflow: `.github/workflows/security-ci.yml`

| Environment | Typecheck | Jest | Build | Package dry-run | Status |
|---|---:|---:|---:|---:|---|
| Ubuntu / Node 20 | pending | pending | pending | pending | **PENDING** |
| Windows / Node 20 | pending | pending | pending | pending | **PENDING** |

The workflow sets `PUPPETEER_SKIP_DOWNLOAD=true` and the test suite is designed around local/synthetic fixtures. No test intentionally invokes a real system shutdown/restart or depends on a live search provider.

## Failure-mode behavior

| Failure | Expected behavior |
|---|---|
| Intent is low-confidence/ambiguous | Do not route an impacting skill; ask for a more explicit target. |
| Intent is high-confidence and destructive | Confidence alone has no authorization effect; preview + approval is still required. |
| Approval text contains additional command text | It is not accepted as approval. The old pending approval is cancelled when the text is treated as a new input. |
| Pending approval expires | Cancel it; require the original operation to be issued again. |
| Skill returns unknown action | Central policy denies it. |
| Path leaves workspace or enters protected location | Deny before built-in file/developer execution. |
| Linux receives power/session action | Deny with explicit unsupported-platform reason. |
| Scheduled task produces approval-gated command | Deny that scheduled run; do not promote it to interactive approval automatically. |
| Static validation of patch preview fails | Do not stage it as an approved target replacement. |
| Post-write project validation fails | Attempt rollback from private backup/delete newly-created target; record rollback/failure audit event. |
| Audit detail contains known token/password formats | Redact before JSONL persistence. |
| Audit persistence itself fails | It does not widen authorization. Policy/execution decision remains independent. |
| Memory retention window is exceeded | Prune expired long-term memory on load/update. |
| Runtime storage deletion requested | Delete local state files on best-effort filesystem semantics; no secure-erase claim. |

## Platform support conclusions

### Windows

Implemented in source:

- CLI/library build path
- memory/audit/policy/filesystem/developer flows
- built-in mapped application launch/close
- shutdown/restart/lock/sleep using fixed Windows executables/arguments, always approval-gated

Not proven by this automated audit:

- availability of every mapped desktop application
- microphone/audio device compatibility
- behavior under every enterprise endpoint/ACL policy
- physical shutdown/sleep on real machines (intentionally not run in CI)

### Linux

Implemented in source:

- CLI/library build path
- memory/audit/policy/filesystem/developer flows
- web/search logic
- best-effort mapped application launch/close when the expected binary exists

Intentionally not claimed:

- Linux shutdown/restart/lock/sleep through AgentAI policy (currently denied)
- universal desktop application/process discovery across GNOME/KDE/Sway/etc.
- universal microphone/audio backend compatibility

## Residual risk

- Third-party skills are trusted JavaScript in the AgentAI process; there is no plugin sandbox.
- An approved `npm run test` executes project-defined code. The user must trust/review the workspace before approval.
- Filesystem TOCTOU races with another local process cannot be completely eliminated by path normalization alone.
- Secret redaction is defense-in-depth and cannot recognize every possible secret encoding.
- Rollback can fail under severe storage, permission, filesystem, or hardware failure; the code attempts and audits rollback but does not claim transactional guarantees across host failure.
- Search provider HTML/network behavior can change; this audit does not make provider-availability claims.
- Syntax/tests passing do not prove generated code is correct or secure.

## Release gate

This hardening pass should not be described as security-qualified until the CI table above contains actual results for the current PR head. Any failed matrix job must be investigated rather than converted into a success claim.
