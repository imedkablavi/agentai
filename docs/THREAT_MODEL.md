# AgentAI Threat Model

## Purpose

This threat model covers the AgentAI execution, memory, scheduler, model/reasoning, voice, and logging architecture. It focuses on preventing ambiguous/model-generated intent, workspace data, or provider output from becoming unauthorized local effects or unnecessary privacy exposure.

## Assets

- user files inside the selected workspace
- files and credentials outside the workspace
- environment variables containing API/cloud credentials
- local application/process state
- host power/session state on Windows
- remembered user data and preferences
- scheduled task definitions
- audit evidence
- source code being inspected or patched
- audio/transcript data

## Trust boundaries

### 1. User/model intent → skill routing

Intent text and LLM/classifier output are untrusted interpretation inputs. Confidence is not an authority signal.

**Invariants:**

- no confidence value, including `1.0`, grants permission to execute an impactful operation
- model-produced intent names are normalized to a known set; an LLM cannot invent an execution capability
- specialized intents use deterministic precedence so generic `open`/`close` matches do not silently shadow file/system semantics
- oversized user input is rejected before LLM/memory processing

### 2. Skill → execution layer

A built-in or third-party skill emits an `ExecutionCommand`.

**Invariant:** a skill cannot add an arbitrary command simply by setting a target or low risk level. `ExecutionPolicy` must recognize the action and validate its target.

**Residual risk:** a third-party skill is JavaScript loaded into the AgentAI process. The policy constrains commands routed through the normal executor, but it cannot sandbox malicious plugin code that directly calls Node.js APIs. Third-party skills therefore remain trusted code.

### 3. Workspace → host filesystem

Developer/file/voice-file features operate in the current process workspace.

**Invariants:** normalized paths and existing symlink resolution must remain within the workspace. VCS, dependency/build, `.env`, credential, private-key and certificate locations are rejected by built-in file/developer paths. Push-to-talk input is restricted to supported regular audio files within the workspace and a bounded size.

**Residual risk:** the workspace itself is trusted input. A user should not point AgentAI at an untrusted repository and then approve execution of that repository's package scripts without reviewing the preview.

### 4. Preview → approval → execution

Approval-gated actions are represented by a pending command with a random ID and five-minute expiry.

**Invariants:**

- approval is exact, not substring-based
- approval authorizes only the pending command
- unrelated new input cancels stale approval
- cancellation never executes the pending command
- the executor receives the approved command, not a newly classified replacement
- disabling all scheduled tasks through natural-language intent is also preview/approval gated

### 5. Interactive → scheduled execution

Scheduled tasks are persistent automation.

**Invariants:**

- new tasks start disabled
- enabling a new schedule requires explicit approval
- persisted context snapshots omit conversation history and active topic
- a due task is re-evaluated by `ExecutionPolicy` in `scheduled` mode
- scheduled mode denies any operation requiring interactive approval
- one-shot tasks are disabled after their first execution attempt
- timer ticks are serialized to prevent overlapping duplicate runs
- expired one-shot tasks cannot be newly enabled

### 6. Process → subprocess

Subprocess execution crosses into host command execution.

**Invariants:**

- built-in execution paths use fixed executables with argument arrays (`execFile`/`spawn` with `shell: false`) instead of interpolating untrusted input into shell command strings
- subprocess environments are reduced to operational/session variables instead of inheriting ambient API keys and cloud credentials by default
- validation uses locally installed TypeScript/Jest tooling; it does not invoke `npx` as an implicit download mechanism
- targeted Jest execution passes the target as an argument to a locally installed runner

**Residual risk:** approved project scripts such as `npm run test` execute code defined by the workspace. Environment stripping reduces accidental credential exposure but does not sandbox filesystem, network, process, IPC, or OS-account permissions.

### 7. Process → local model service

Intent reasoning and code-generation helpers use a local Ollama endpoint.

**Invariants:**

- built-in HTTP endpoint is fixed to `127.0.0.1:11434`
- HTTP proxying is disabled for these local model requests
- CLI fallback uses `execFile` with separate arguments, not a shell string
- model output is length-limited and intent output is normalized before routing
- patch-generation input/output sizes are bounded

**Residual risk:** AgentAI cannot prove how a locally installed model/runtime itself was configured. A modified/local Ollama installation could have independent telemetry or extensions outside AgentAI's control.

### 8. Process → persistent memory/audit storage

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

### 9. Voice input/output → privacy boundary

Audio/transcript and spoken output may contain private information.

**Invariants:**

- built-in PTT paths are workspace-confined, extension-allowlisted, regular files, and size bounded
- Whisper temporary text output is written to private application data rather than alongside the user's audio and is removed after use
- Whisper subprocess environment is reduced
- network-backed Edge TTS is disabled by default and requires explicit `AGENTAI_ENABLE_EDGE_TTS=true` opt-in

**Residual risk:** enabling network TTS changes the privacy boundary and may send spoken text to the configured provider. Custom voice adapters are trusted code/providers and can define their own data handling.

### 10. Search result → external/local URL opening

Search provider output is untrusted external data.

**Invariants:**

- selection contexts expire
- only unauthenticated HTTP(S) URLs are accepted
- loopback, localhost, and common private/link-local address ranges are rejected before opening selected URLs

**Residual risk:** hostname DNS resolution can change after policy evaluation. The current control rejects literal/local hostnames and private literal addresses but is not a full browser/network sandbox or DNS-rebinding defense.

## Main threat scenarios

| Threat | Example | Control | Residual risk |
|---|---|---|---|
| Confidence becomes permission | classifier says shutdown with 100% confidence | centralized policy + mandatory system approval | semantic false positives still possible, but do not bypass approval |
| Model invents action | LLM returns `arbitrary_shell` | intent-name normalization + action allowlist | malicious in-process plugins remain trusted code |
| Approval confusion | user says `yes and shutdown` while another action is pending | exact approval parser | user can still approve a misleading preview; previews must remain specific |
| Stale approval reuse | pending close-app approval followed by unrelated command | unrelated input cancels pending state | no cross-session durable approval exists |
| Arbitrary shell injection | prompt/path contains shell operators | argv subprocess APIs; shell fallback removed | approved package scripts may themselves invoke shells |
| Child-process secret theft | test script reads `OPENAI_API_KEY` from inherited environment | reduced subprocess environment | workspace code can still access user-readable files/network |
| Implicit tool download | validator invokes missing `npx tsc` | local-only validation tools | missing tool reduces validation confidence/causes explicit failure |
| Path traversal | `../secret`, sibling prefix, symlink escape | `path.relative` boundary + realpath checks | TOCTOU changes by another local process are not fully eliminated |
| Search result opens local admin | provider returns `http://127.0.0.1/...` | selection expiry + public HTTP(S)/private-address rejection | DNS rebinding remains outside current scope |
| Secret logs | token appears in error/message | structured redaction before audit write | unknown secret encodings may evade pattern redaction |
| Raw transcript leakage | CLI writes every input/response to `logs/` | raw session logging removed | terminal/shell history is outside AgentAI's control |
| Voice transcript sidecar leak | Whisper writes `audio.txt` beside input | private temporary output dir + cleanup | crash/OS failure can leave private temp state until later cleanup/manual removal |
| Network TTS privacy surprise | voice output silently calls Edge TTS | network TTS disabled by default + explicit opt-in | provider policy applies when enabled |
| Memory over-retention | habits stored forever | 30-day default + configurable pruning/deletion | preferences are separate and intentionally retained by memory-clear unless separately changed |
| Scheduled destructive action | daily shutdown intent | scheduled policy rejects interactive-approval commands | safe/non-impacting scheduled actions still execute with user-created schedule |
| Repeating one-shot action | past `once` timestamp remains due every tick | one-shot disabled after first attempt + expired enable rejection | persistence/storage failure can still affect scheduler state durability |
| Scheduler callback overlap | slow task exceeds timer period | serialized tick guard | multiple independent AgentAI processes are not coordinated by a cross-process lock |
| Partial developer write | patch written, tests fail | private backup + semantic validation + rollback | rollback can fail under disk/permission/hardware failure; audit records failure/rollback attempts |
| Malicious third-party skill | skill directly imports `child_process` | documentation/trust boundary; policy constrains normal commands | no plugin sandbox; do not load untrusted skills |

## High-impact actions

The built-in policy treats these as approval-gated:

- Windows shutdown/restart/lock/sleep
- application termination
- project test execution
- persistent memory write
- application of a staged code patch
- disabling all scheduled tasks through natural-language intent
- any future skill command whose `requires_confirmation` flag is true

Linux power/session actions are currently denied rather than implemented through guessed shell commands.

## Developer patch transaction

The developer fix flow is intentionally two-phase:

1. Read a workspace-scoped file.
2. Generate a candidate replacement through the local model boundary.
3. Write the candidate to a temporary preview file that preserves the original extension.
4. Run static validation on that preview with local tooling.
5. Delete/roll back the preview file.
6. Present a preview to the user.
7. Only after command-bound approval, create a private backup and atomically replace the target.
8. Run semantic/project validation under a reduced subprocess environment.
9. If validation fails, restore the backup (or delete a newly-created target).
10. If validation succeeds, discard the backup.

A passing validator does not prove semantic correctness or security of generated code; it only establishes the checks that actually ran.

## Denial-of-service considerations

- assistant input is capped at 8,000 characters before model/memory processing
- file reads are capped at 500 KB through the built-in text reader
- patch-generator source/input/output sizes are bounded
- audio input is capped at 50 MiB and supported extensions
- subprocesses have timeouts and output buffers
- search/model HTTP requests have timeouts and content-size limits
- audit log rotation is bounded
- path scanning ignores dependency/build/VCS directories and has a depth limit
- scheduler intervals are bounded and ticks do not overlap

This is not a complete host resource sandbox. Disk exhaustion, malicious workspace build scripts, hostile external providers, or multiple concurrent AgentAI processes can still consume resources within OS/process limits.

## Assumptions

- AgentAI runs as a non-elevated user in normal use.
- The operating system account boundary protects `~/.agentai` from other users.
- The workspace is intentionally selected by the user.
- Node.js and platform executables are trusted.
- Users review previews before approving impactful operations.
- Third-party skills and custom adapters are trusted code unless a future sandbox model is introduced.
- Network TTS remains disabled unless the user intentionally opts in.

## Security regression requirements

Changes to execution, skills, intent routing, model reasoning, memory, scheduler, voice, logging, or path handling should add tests demonstrating the relevant invariant. At minimum, CI should retain coverage for:

- high-confidence destructive action still needs approval
- exact approval binding/cancellation
- scheduler disable approval
- unknown action/model-intent denial
- traversal/protected path denial
- expired/private URL selection denial
- scheduled approval bypass denial
- one-shot and non-overlapping scheduler semantics
- child environment secret stripping
- local-only validation tooling
- secret redaction at persisted audit boundary
- memory retention/deletion defaults
- voice workspace/privacy defaults
- rollback after failed post-write validation
- ambiguous/compound intent rejection and specialized-intent precedence
