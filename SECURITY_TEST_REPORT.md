# AgentAI Security Test Report

**Branch:** `security/product-architecture-hardening`  
**Base:** `main`  
**Scope:** execution, model/intent routing, subprocesses, filesystem/developer actions, scheduler, memory, audit/logging, voice, CLI packaging, Windows/Linux support claims  
**Qualification status:** **PENDING CI** — actual GitHub Actions results for the final PR head must replace the pending matrix below before this hardening pass is described as qualified.

## Executive summary

The pre-hardening architecture mixed semantic confidence with execution authorization in several places. A high confidence score could satisfy permission checks for destructive/system commands. The repository also contained shell-interpolated subprocess calls, prefix-based filesystem boundary checks, raw runtime logs/state committed in the repository, broad memory persistence, generic approval state, and several secondary execution/privacy paths that did not share one explicit policy boundary.

The hardening branch now establishes these properties:

1. confidence affects interpretation/routing only;
2. every normal skill output is evaluated by a centralized `ExecutionPolicy`;
3. impactful operations are previewed and require exact, command-bound approval;
4. scheduled execution cannot auto-run an operation that needs interactive approval;
5. subprocesses use fixed executables/argument arrays and a reduced environment rather than user-interpolated shells plus ambient credentials;
6. validation uses locally installed tooling only and does not use `npx` as an implicit download path;
7. filesystem/developer/voice-file paths are workspace-scoped with protected-path and symlink checks;
8. local LLM transport is loopback-only in built-in code, shell fallback was removed, and model intent output is normalized to known capabilities;
9. audit/runtime state is private local state outside the repository, with redaction before persistence;
10. memory persistence defaults are privacy-preserving and expose retention/deletion controls;
11. developer writes use atomic replacement, private backups and rollback after failed post-write validation;
12. scheduler one-shot and overlap semantics were hardened to avoid duplicate effects;
13. search selections expire and reject literal local/private-network destinations;
14. network-backed Edge TTS is opt-in instead of an implicit default;
15. README/package metadata no longer claim unmeasured performance or unsupported platform capabilities.

## Findings and remediation

| ID | Pre-hardening / second-pass finding | Risk | Remediation in this branch |
|---|---|---:|---|
| SEC-01 | High intent confidence was treated as permission for system/destructive operations. | Critical | Removed confidence authorization from routing/system/orchestrator paths. `ExecutionPolicy` is the authorization decision point. |
| SEC-02 | User-derived paths/targets were interpolated into shell command strings in execution, Git and validation paths. | High | Replaced built-in execution with `execFile`/`spawn` argument arrays and fixed executables; unknown actions are denied. |
| SEC-03 | Filesystem scope relied on string-prefix checks and did not consistently resolve symlink boundaries. | High | Normalized `path.relative` boundary checks, protected paths, realpath checks, size/binary limits. |
| SEC-04 | CLI/runtime logs and memory/scheduler state were stored in repository paths; session logs included raw text. | High privacy | Removed raw session transcript logging, moved state to `~/.agentai`/`AGENTAI_DATA_DIR`, added redacted structured audit, removed committed runtime state. |
| SEC-05 | Short-term memory persisted by default and repetitive behavior could become long-term memory automatically. | Medium privacy | Short-term persistence off by default; automatic pattern persistence off by default; explicit persistent memory approval; retention/deletion controls. |
| SEC-06 | Confirmation was generic context state rather than a command-bound authorization. | High | Random-ID `PendingExecution`, exact command/preview, five-minute expiry, exact approval tokens, stale approval cancellation. |
| SEC-07 | Scheduler execution had a separate path that could diverge from interactive authorization. | High | Schedules start disabled, need enable approval, and due tasks are re-evaluated in scheduled policy mode. |
| SEC-08 | Developer rollback did not model newly-created targets/private backups as one transaction. | Medium/High | Atomic write, private rollback storage, rollback of existing/new targets, post-write semantic validation. |
| SEC-09 | Package metadata described a Windows assistant and lacked a proper CLI `bin`. | Product/security clarity | Added `agentai` bin/library entry, prepack checks, realistic support matrix and host-boundary docs. |
| SEC-10 | README claimed `< 1 second average` without a reproducible benchmark. | Trust | Removed the claim; no replacement number is asserted without measurement. |
| SEC-11 | Arabic/generic intent regex ordering could shadow specialized system/file intents. | High | Added deterministic specialized-intent precedence and exact system-command patterns; regression tests in Arabic/Turkish/English. |
| SEC-12 | LLM CLI fallback constructed a shell command containing user prompt text. | High | Removed shell execution; fallback now uses `execFile` argv, sanitized environment, loopback HTTP transport, response limits and known-intent normalization. |
| SEC-13 | Test/validation child processes inherited the full AgentAI environment; `npx` could implicitly download validation tooling. | High privacy/supply-chain | Reduced child environment, local-only TypeScript/Jest resolution, no implicit `npx` download in validation/targeted tests. |
| SEC-14 | Selection expiry was described but not actually enforced; literal private/loopback selected URLs could open local endpoints. | Medium | Enforce finite future selection expiry and reject localhost/private/link-local literal addresses before opening. |
| SEC-15 | `once` scheduler entries could remain due after execution and async timer callbacks could overlap. | High reliability/safety | Disable one-shot after first attempt, reject expired one-shot enablement, serialize ticks, advance state after callback failure. |
| SEC-16 | Natural-language `stop_tasks` disabled persistent schedules immediately instead of using command-bound approval. | Medium | Added `scheduler_disable_all` to central policy and stage/approve it through `PendingExecution`. |
| SEC-17 | Voice-file path accepted arbitrary paths and Whisper wrote transcript sidecars near input. | Medium privacy | Workspace-confined supported audio files, 50 MiB cap, private temporary transcript directory and cleanup, reduced subprocess environment. |
| SEC-18 | Edge TTS could become an implicit network privacy boundary. | Medium privacy | Network Edge TTS is disabled by default and requires `AGENTAI_ENABLE_EDGE_TTS=true`; local adapter remains default. |
| SEC-19 | Generated/stale `dist/` was tracked and could differ from hardened source. | Medium release integrity | Removed tracked build output; CI/package flow builds `dist/` from the current source. |

## Security invariants under test

Automated tests cover or were added for:

- high-confidence destructive intent does not bypass approval;
- command-bound approval, exact tokens, cancellation, stale invalidation and scheduler-disable approval;
- unregistered action denial and model-invented intent normalization;
- application allowlist and termination approval;
- workspace traversal, protected path and sibling-prefix rejection;
- Linux system actions denied rather than guessed;
- scheduled approval-bypass prevention;
- one-shot execution at most once and non-overlapping scheduler ticks;
- selection expiry and loopback/private literal URL rejection;
- secret redaction before audit persistence;
- child-process ambient API/cloud credential stripping;
- short-term memory non-persistence by default, opt-in persistence, retention pruning and deletion;
- scheduler disabled-by-default behavior and minimized snapshots;
- developer preview does not modify the target;
- atomic/private rollback and newly-created-file rollback;
- semantic-validation failure triggers rollback;
- ambiguous pronoun-only and compound system intent rejection;
- specialized file/system intent precedence in Arabic/Turkish/English;
- third-party skill output still passes through action allowlisting on the normal executor path;
- voice input workspace confinement and private-by-default voice output;
- oversized assistant input rejection before model processing.

## CI qualification matrix

Workflow: `.github/workflows/security-ci.yml`

| Environment | Typecheck | Jest | Build | Package dry-run | Status |
|---|---:|---:|---:|---:|---|
| Ubuntu / Node 20 | pending | pending | pending | pending | **PENDING** |
| Windows / Node 20 | pending | pending | pending | pending | **PENDING** |

The workflow sets `PUPPETEER_SKIP_DOWNLOAD=true` and the suite uses local/synthetic fixtures. No test intentionally invokes a real system shutdown/restart or depends on a live search provider.

## Failure-mode behavior

| Failure | Expected behavior |
|---|---|
| Intent is ambiguous | Do not route an impacting skill; require explicit target. |
| Intent is high-confidence and destructive | Confidence alone has no authorization effect; preview + approval remains required. |
| LLM returns an unknown action name | Normalize to `unknown`; central action policy cannot gain a capability from the model. |
| Approval text contains additional command text | Do not accept it as approval; stale pending state is cancelled before processing new input. |
| Pending approval expires | Cancel it and require a fresh original command/preview. |
| Skill returns unknown action | Central policy denies it. |
| Path leaves workspace or enters protected location | Deny before built-in file/developer/voice execution. |
| Linux receives power/session action | Deny with explicit unsupported-platform reason. |
| Scheduled task produces approval-gated command | Deny that scheduled run; do not promote it to interactive approval automatically. |
| One-shot task fires | Disable it after the first callback attempt so it cannot remain continuously due. |
| Scheduler callback is still running at next tick | Skip overlapping tick in the same process. |
| Missing local validator | Do not download via `npx`; return partial validation or explicit local-tool failure according to the path. |
| Workspace test reads ambient API key env var | Built-in child environment does not include arbitrary API/cloud secret variables. |
| Static validation of patch preview fails | Do not stage it as an approved target replacement. |
| Post-write project validation fails | Attempt rollback from private backup/delete newly-created target; record rollback/failure. |
| Selected result expired or points to literal local/private host | Deny opening it. |
| Audit detail contains known token/password formats | Redact before JSONL persistence. |
| Audit persistence fails | It does not widen authorization. |
| Memory retention window is exceeded | Prune expired long-term memory. |
| Voice file is outside workspace/unsupported/oversized | Reject before transcription provider/tool access. |
| Edge TTS is not explicitly enabled | Use local configured output adapter; do not attempt network Edge TTS. |

## Platform support conclusions

### Windows

Implemented in source:

- CLI/library build path
- memory/audit/policy/filesystem/developer flows
- built-in mapped application launch/close
- shutdown/restart/lock/sleep using fixed Windows executables/arguments, always approval-gated
- workspace-file voice transcription path (subject to installed local tooling)

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
- best-effort mapped application launch/close when expected binaries exist
- workspace-file voice transcription path (subject to installed local tooling)

Intentionally not claimed:

- Linux shutdown/restart/lock/sleep through AgentAI policy (currently denied)
- universal desktop application/process discovery across GNOME/KDE/Sway/etc.
- universal microphone/audio backend compatibility

### Voice/network privacy

Network Edge TTS is opt-in on all platforms. Enabling `AGENTAI_ENABLE_EDGE_TTS=true` changes the privacy boundary and the configured TTS provider's terms/data handling apply.

## Residual risk

- Third-party skills/custom adapters are trusted JavaScript in the AgentAI process; there is no plugin sandbox.
- An approved `npm run test` executes project-defined code. Reduced environment variables do not remove user-level filesystem/network/process permissions.
- Multiple independent AgentAI processes are not coordinated by a cross-process scheduler lock.
- Literal private-address rejection is not a full DNS-rebinding/browser network sandbox.
- Filesystem TOCTOU races with another local process cannot be completely eliminated by normalization alone.
- Secret redaction is defense-in-depth and cannot recognize every secret encoding.
- Rollback can fail under severe storage, permission, filesystem, or hardware failure.
- Search provider HTML/network behavior can change.
- A locally installed Ollama/model runtime is outside AgentAI's sandboxing/control and may have its own behavior.
- Syntax/tests passing do not prove generated code is correct or secure.

## Release gate

This hardening pass must not be described as Windows/Linux security-qualified until the CI table above contains actual results for the **current final PR head**. Any failed matrix job must be investigated rather than converted into a success claim.
