# Security Policy

## Scope

AgentAI executes user-authorized local actions. Security reports are especially relevant when they show that an untrusted or ambiguous input can cross one of these boundaries without the documented approval:

- execute an unregistered/arbitrary command
- escape the configured workspace path boundary
- perform an approval-gated action without a command-bound approval
- reuse an approval for a different operation
- cause scheduled execution to bypass an interactive approval requirement
- persist secrets or raw private conversation data in audit/runtime logs contrary to the documented defaults
- read protected credential/key locations through built-in file/developer actions
- leave a partially applied developer patch after validation failure without attempting rollback

Model quality, provider availability, and generated-code correctness are not by themselves security vulnerabilities unless they cross an execution/privacy boundary.

## Supported code

Security fixes target the current default branch and the latest explicitly published release, if a release exists. Older commits, local forks, and modified third-party skills are not automatically supported.

## Reporting a vulnerability

Do not post secrets, private logs, personal data, access tokens, or a working harmful payload in a public issue.

Preferred reporting path:

1. Use the repository's GitHub **Security → Advisories → New draft security advisory** flow when it is available to you.
2. Include the affected commit/version, platform, exact preconditions, expected boundary, observed boundary crossing, and a minimal safe reproduction.
3. Redact credentials and personal data from logs/screenshots.

If private advisories are unavailable, open a public issue that contains only a high-level statement that you have a potential security report and request a private disclosure channel. Do not include exploit details in that issue.

## What a useful report contains

- operating system and Node.js version
- AgentAI commit/release
- whether the process was run as a normal or elevated user
- configured workspace and `AGENTAI_DATA_DIR` behavior (paths may be generalized)
- the input/skill command that crossed the boundary
- whether an approval preview was shown
- whether the action came from interactive or scheduled execution
- a minimal repository fixture, if the issue depends on filesystem layout
- redacted audit evidence if relevant

## Execution security model

The security architecture is intentionally fail-closed at the authorization layer:

- Intent confidence does not authorize execution.
- Skills produce `ExecutionCommand` objects; they do not directly gain shell authority.
- `ExecutionPolicy` allowlists actions and validates targets/scopes.
- Impactful actions require a preview and exact command-bound approval.
- Scheduled mode rejects commands that require interactive approval.
- Built-in subprocess paths use fixed executables and argument arrays instead of interpolating user text through a shell.
- File/developer operations are scoped to the current workspace and reject protected locations.

A third-party skill can still contain arbitrary JavaScript and therefore belongs to the same trust domain as the AgentAI process. Do not load untrusted skills. AgentAI is not a Node.js plugin sandbox.

## Data handling

Default runtime state lives under `~/.agentai` or `AGENTAI_DATA_DIR`.

- short-term conversation memory is not persisted by default
- long-term automatic pattern inference is disabled by default
- explicit memory persistence is approval-gated
- scheduler snapshots omit conversation history/active topic
- audit entries are structurally redacted before persistence
- raw session transcript logging was removed from the CLI

Filesystem deletion is ordinary file deletion. AgentAI does not claim secure erase against filesystem snapshots, backups, journaling, or SSD wear-leveling.

## Safe testing

Use synthetic/local fixtures. Do not test vulnerability reports by shutting down production machines, deleting unrelated user data, or using credentials that are not yours.

For system-action tests, mock the executor or use the policy tests; the automated suite does not intentionally power off CI hosts.

## Threat model

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for trust boundaries, threats, mitigations, and residual risk.
