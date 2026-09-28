---
name: codex-harness-doctor
description: Use when Codex is slow, inconsistent, context-heavy, making unnecessary tool calls or repeated permission requests, or when auditing AGENTS.md, Skills, plugins, MCP servers, hooks, tool schemas, telemetry, and harness configuration before optimization.
---

# Codex Harness Doctor

## Core principle

Diagnose the effective harness, not isolated files. Keep evidence collection read-only, distinguish observation from inference, and prefer the smallest reversible remediation that preserves quality, safety, and reproducibility. Apply remediation only within an authorized fix request.

Do not assume a component is useful because it is installed. Do not assume it is useless because it is rare.

## Select the mode

| Mode | Use | Allowed work |
| --- | --- | --- |
| `quick` | Default; first pass or incomplete evidence | Static discovery, configuration precedence, source sizes, exact duplicates, obvious conflicts, missing/stale references. Do not run benchmarks or discovered hooks/MCP servers. |
| `deep` | User asks for measurements, profiling, usage, or before/after evidence | Quick audit plus supplied Codex JSONL, OTel metric observations, hook/permission traces, MCP/plugin inventories, and explicitly approved representative read-only runs. |
| `fix-plan` | User asks how to remediate or requests diffs | Produce minimal proposed diffs, risks, verification, and rollback. Apply concrete requested fixes only when the current request or applicable project instructions authorize implementation; otherwise leave them as candidates. |

If the request omits a mode, use `quick`. If it says “fix,” first finish the evidence-backed audit, then produce `fix-plan`; apply concrete requested fixes when the current request or applicable project instructions authorize them, and keep unrelated harness changes as proposals.

## Establish scope

Resolve and report:

1. repository root, current working directory, and target directory;
2. Codex client and version when available;
3. whether project `.codex` layers are trusted;
4. active user/system/profile/project configuration sources and any CLI overrides the user supplies;
5. evidence time range and representative tasks for deep mode.

Never guess a config/log/plugin path. Use documented locations, host-provided inventory, or an explicit user-supplied path. Treat a discovered project config as present but not effective when trust is unknown.

## Collect evidence

### Run deterministic static collection

Use the bundled collector for local Codex CLI/IDE projects. Locate an available Python 3.11+ runtime first (`py`, `python`, `python3`, or the host's bundled runtime); verify its version. Resolve `<skill-dir>` from this installed skill and use absolute paths for the script, repository, and target.

POSIX example, when `python3` is available:

```bash
python3 "<skill-dir>/scripts/harness_doctor.py" quick \
  --repo "<repo-root>" \
  --target "<working-directory>" \
  --project-trusted "<yes|no|unknown>" \
  --format json
```

Windows PowerShell, using the verified executable's absolute path:

```powershell
& "<python-exe>" "<skill-dir>/scripts/harness_doctor.py" quick --repo "<repo-root>" --target "<working-directory>" --project-trusted "<yes|no|unknown>" --format json
```

The collector requires no third-party packages, supports Python 3.11+ on Windows, Linux, and macOS, writes only to stdout, redacts likely secrets, and never executes configured hooks or starts MCP servers. Run `--help` for optional evidence inputs.

Static `--mcp-inventory` and `--plugin-inventory` inputs are allowed in `quick`; they describe already-captured evidence and do not authorize a connection. Runtime trace inputs require `deep`.

For a deep audit, prefer documented Codex signals:

- `codex exec --json` for event JSONL and emitted token usage;
- OTel metrics listed by the current official Advanced Configuration catalog: `hooks.run`, `hooks.run.duration_ms`, `mcp.call`, `mcp.call.duration_ms`, `mcp.tools.list.duration_ms`, `approval.requested`, `tool.call`, `tool.call.duration_ms`, `turn.tool.call`, `turn.token_usage`, `skill.injected`, and `thread.skills.*`; re-check names against the audited Codex version;
- `/mcp verbose`, `/plugins`, `/hooks`, and `/skills` for current host inventory when no machine-readable export exists;
- MCP `tools/list`, server instructions, resources, and tool results only when already available or when a read-only connection check is explicitly approved.

Normalize exported evidence with the input contracts in [references/report-schema.md](references/report-schema.md). Do not claim that the collector consumes arbitrary raw OTLP envelopes; backend/export formats vary.

When automatic config discovery cannot see managed/system/session layers or the invocation used a profile/CLI overrides, supply the selected `--profile` and/or a host-generated `--config-layer-manifest` in true low-to-high precedence order. Supply runtime/plugin Skill roots with `--skill-root SCOPE=PATH`. Missing layers stay `UNAVAILABLE`; never guess their paths.

### Evidence order

Prefer, in order:

1. runtime metric/trace emitted by the audited Codex version;
2. measured serialization of the actual effective object or schema;
3. static source characters/bytes with a documented loading rule;
4. compatible model tokenizer output;
5. a deliberately wide labeled estimate;
6. `UNAVAILABLE`.

Never replace a missing higher-grade signal with an unlabeled estimate.

## Build the effective harness model

### Instructions and configuration

- Build the `AGENTS.md` chain from global scope, then repository root down to the target directory.
- At each directory, select at most one applicable instruction file using override, canonical, then configured fallback precedence.
- Apply the configured combined byte limit and report possible truncation.
- Keep inventory files that are outside the effective target chain separate from active instructions.
- Resolve config precedence across system, user, selected profile, trusted project layers, and supplied CLI overrides. Do not pretend project-local config is active when trust is unknown.
- Treat closer instructions as overriding only conflicting semantics; they do not erase unrelated earlier instructions.

### Skills and plugins

- Inventory repository, user, admin, configured, and plugin-bundled Skills when visible.
- Separate discovery metadata from activation-loaded `SKILL.md` bodies and later references/scripts.
- Record scope, trigger/implicit policy, dependencies, supplied tools/resources/hooks, and observed use/outcomes when available.
- Treat a rare explicit/on-demand Skill as a removal candidate only when stale, broken, redundant, or valueless on representative critical tasks.
- Use one recommendation per component: `KEEP`, `KEEP_ON_DEMAND`, `LIMIT`, `MERGE`, `REPLACE`, `DISABLE`, `REMOVE`, or `INSUFFICIENT_EVIDENCE`.

### MCP

- Keep server `instructions` separate from tool descriptions/schemas in context accounting.
- Count tools, resources, schema bytes, description bytes, startup/list/call latency, failures, result sizes, and overlaps when evidence exists.
- Check documented `enabled_tools`/`disabled_tools` filtering before proposing server removal.
- Treat serialized `tools/list` size as a source-size proxy unless the host exposes actual prompt injection.
- Do not start or authenticate an MCP server merely to complete a quick audit.

### Hooks

- Include hooks from user, system, trusted project, inline config, `hooks.json`, managed, session, and enabled plugin sources when visible.
- Record event, matcher, handler, timeout, `async`, output/context limit, trust state, frequency, status, and duration.
- Remember that matching command hooks for the same event launch concurrently. Sum durations only as work consumed; derive critical-path latency only from invocation-grouped start/end timestamps.
- Protect safety/security hooks. First narrow scope, cache, deduplicate, make incremental, or move non-blocking informational work to `async` where semantics permit.

### Permissions

- Group repeated requests by normalized tool/command/permission/scope and outcome.
- Attribute the outcome to user, policy, sandbox, configuration, or `INSUFFICIENT_EVIDENCE` only when the source reports it.
- Classify denials as expected protective, unnecessary request, over-broad request, wrong path/scope, erroneous command, missing narrow rule, user refusal, policy-enforced, or insufficient evidence.
- Prioritize removing the need, narrowing scope, changing tool/workflow, then proposing a narrow rule. Never recommend broad sandbox relaxation as a latency optimization.

## Measure context overhead

Report these components separately when available:

1. always-loaded instruction chain;
2. Skill discovery metadata and paths;
3. plugin discovery metadata;
4. MCP server instructions;
5. tool/resource descriptions and schemas;
6. activation-only Skill instructions/references;
7. tool-call inputs;
8. tool results;
9. hook-provided additional context;
10. repeated conversation/session context;
11. session-level versus per-turn cost.

For each component, state source, characters, UTF-8 bytes, measured or estimated tokens, loading time, one-time/repeated behavior, context-window percentage when known, method, and confidence.

Use exact token counts only from emitted usage or a compatible tokenizer applied to the exact serialized content. A character ratio must be a range labeled `ESTIMATED`; do not add static component estimates and call the result the actual prompt.

## Find duplicates and conflicts

Search for exact text, semantic overlap, partial overlap, functional duplication, and contradictory obligations across instructions, Skills, plugins, MCP tools, hooks, rules, CI, formatters, linters, and tests.

For every candidate group, state:

- members and scopes;
- overlapping responsibility and meaningful differences;
- evidence type;
- canonical source candidate;
- merge/removal risk;
- expected benefit;
- confidence.

Do not declare components duplicates from names alone. Treat heuristic semantic matches as review candidates, not facts.

## Run the simplification gate

Before scoring remediation, apply `DRY`, `KISS`, and `YAGNI` to the proposed harness—not just to prose size:

1. Keep one canonical owner for each verified responsibility; do not merge components whose differences matter.
2. Prefer narrowing an existing instruction, matcher, tool allowlist, or output limit over adding a new profile, wrapper, hook, script, or service.
3. Do not add telemetry, caching, abstraction, or automation unless a measured finding needs it and the verification plan will use it.
4. Remove recommendations that do not change a named metric, failure mode, safety property, or maintenance burden.
5. Preserve rare on-demand capabilities when they impose negligible always-on cost.
6. Choose the smallest reversible patch that addresses the root cause; reject broad reorganizations for marginal savings.

Record a one-line `complexity delta` for every remediation: what is removed or narrowed, what (if anything) is added, and why the net harness is simpler. Simplification never overrides safety, architecture invariants, or missing-evidence gates.

## Audit `AGENTS.md`

Classify significant instructions as safety, architecture, project standard, workflow, style, reference, duplicate, conflict, removal candidate, Skill candidate, or automation candidate.

Preserve safety constraints, architecture invariants, project-specific conventions, required verification commands, and facts that cannot be inferred reliably from code. Move long specialized procedures to on-demand Skills; move mechanically enforceable rules to linters/tests/hooks without deleting the canonical executable control.

Produce:

1. effective inheritance map;
2. problems with evidence;
3. proposed concise content;
4. unified diff;
5. measured characters/bytes and labeled token estimate or measurement;
6. removal ledger explaining why every deletion is safe.

## Score findings and write the report

Read [references/report-schema.md](references/report-schema.md) before assigning severity, prioritizing remediation, ingesting normalized evidence, writing proposed diffs, or running evals. Use its anchored scoring model and exact report contract.

For every finding, keep three explicit fields:

- **Fact:** directly observed/measured evidence and source.
- **Interpretation:** causal or risk inference, with alternatives.
- **Recommendation:** proposed action conditioned on evidence.

Start with an executive summary, then the required findings table:

| ID | Severity | Component | Finding | Evidence | Impact | Recommendation | Expected benefit | Risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Follow it with context overhead, `AGENTS.md`, duplicate/conflict map, Skills/plugins/MCP inventory, hooks, permissions, remediation roadmap, proposed diffs, verification, and limitations.

## Produce remediation within scope

Split actions into:

- `Immediate`: high-confidence, low-regression changes;
- `Next`: changes requiring targeted validation or small refactoring;
- `Experimental`: hypotheses requiring A/B tasks or evals.

For each action, provide exact files/settings, proposed change, expected benefit, possible regression, verification, and rollback. Generate unified diffs only against captured originals and confirmed current-version syntax. When either is missing, provide labeled prose or pseudocode outside a diff block; never invent configuration keys as placeholders. Apply a diff, disable a component, edit permissions, or install instrumentation only when that operation is authorized by the current request and applicable project instructions; otherwise keep it as a proposal.

## Verify before/after

Compare the same representative task set and environment. Measure when available:

- effective always-on instruction bytes/tokens;
- discovery metadata and tool-schema size;
- exposed tool count;
- mean/P50/P95 tool calls and wall time;
- time to first useful action and total task time;
- approval request rate/outcomes;
- error/failure rate;
- task success and output-quality rubric;
- safety/invariant preservation.

Accept an optimization only when overhead or latency improves, task quality does not fall beyond the predeclared tolerance, errors do not increase, and safety constraints remain intact. If full evals are unavailable, run or propose the smallest reproducible read-only smoke test and label the result provisional.

## Degrade gracefully

When telemetry, tokenization, traces, plugin inventory, MCP schemas, or permission causes are missing:

1. list the missing signal;
2. complete available static analysis;
3. mark affected fields `UNAVAILABLE` or `INSUFFICIENT_EVIDENCE`;
4. lower confidence;
5. provide an exact safe collection instruction from the report reference;
6. avoid conclusions that require the missing signal.

## Safety boundaries

- Remain read-only by default.
- Do not execute destructive commands, discovered hooks, or arbitrary plugin/MCP code.
- Do not weaken sandboxing, approval policy, rules, managed controls, or security hooks for convenience.
- Do not transmit local data to external services.
- Redact keys, tokens, cookies, authorization headers, credentials, private keys, and sensitive payloads.
- Do not expose raw prompts or tool results unless the user explicitly approves and the data is sanitized.
- Prefer stdout or a new report file; never overwrite harness configuration during audit.

## Completion gate

Finish only when:

- scope and effective precedence are explicit;
- every claim has a fact source and evidence grade;
- missing data is visible;
- recommendations use the required disposition vocabulary;
- no estimate is labeled measured;
- proposed changes are minimal, reversible, and either within current authority or clearly marked as proposals;
- verification and rollback exist for every remediation;
- the simplification gate removed speculative or net-complexity-increasing actions;
- the report includes all required sections or explicitly marks them unavailable.

## Common failure patterns

| Failure | Correction |
| --- | --- |
| Audit only the nearest `AGENTS.md` | Rebuild the effective global-to-target chain and byte cap. |
| Add concurrent hook durations as latency | Report work sum separately; require grouped timestamps for critical path. |
| Treat all discovered Skill bodies as always loaded | Separate metadata discovery from activation-only bodies/references. |
| Call serialized schemas “prompt tokens” | Label source-size proxy unless host serialization/injection is observed. |
| Remove a rare incident Skill | Check critical utility, on-demand activation, staleness, and failure evidence. |
| Recommend an allow rule after repeated denials | First remove the operation or narrow the workflow. |
| Present semantic similarity as duplication | Mark it as a candidate and require manual/behavioral confirmation. |
| Put schematic or guessed keys in a diff | Use prose/pseudocode outside diff until originals and current syntax are verified. |
| Hide unavailable telemetry | Surface the gap and lower confidence. |
