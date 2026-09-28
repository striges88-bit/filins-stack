---
name: skill-cleaner
description: "Codex/OpenClaw skill audit: live budget, usage, duplicates, compact descriptions."
---

# Skill Cleaner

Use this when trimming skill prompt budget, finding duplicate skills, auditing enabled/disabled skill roots, or deciding which skills/plugins to remove.

## Workflow

1. Use an available Node runtime that supports `--experimental-strip-types`. For an authorized installation or update, install the pinned dependency once from this skill directory with `npm ci --ignore-scripts --no-audit --no-fund`. Routine audits reuse that installation; if it is missing during a read-only audit, report the missing prerequisite without changing the audited skill.

Run the analyzer from the installed skill directory:

```bash
node --experimental-strip-types scripts/skill-cleaner.ts --months 3
```

Useful variants:

```bash
node --experimental-strip-types scripts/skill-cleaner.ts --model gpt-6-astra --months 3
node --experimental-strip-types scripts/skill-cleaner.ts --no-logs
node --experimental-strip-types scripts/skill-cleaner.ts --no-live --no-logs
node --experimental-strip-types scripts/skill-cleaner.ts --months 6 --max-log-mb 800 --deep-logs
node --experimental-strip-types scripts/skill-cleaner.ts --context-tokens 272000 --budget-percent 2 --no-logs
node --experimental-strip-types scripts/skill-cleaner.ts --root ~/Dropbox/boxd/skills --no-logs
node --experimental-strip-types scripts/skill-cleaner.ts --root ~/.agents/skills --root-only --no-logs
```

From another working directory, replace `scripts/skill-cleaner.ts` with the installed skill's absolute script path. `--model` selects the model record used for budget sizing; it does not switch the Codex CLI or Desktop model.

2. Read the report in this order:
- `Skill Budget`: the selected inventory, 2% budget, budgeted usage, and full-description pressure.
- `Description candidates`: long descriptions where redundant wording can be removed while preserving clear trigger conditions.
- `Duplicates`: same skill name or near-identical description/body across Codex, plugin cache, repo siblings, and personal skill roots.
- `Unused candidates`: no recent user mention or actual `SKILL.md` read in recent Codex/OpenClaw logs. This is absence of observed evidence, not proof that a skill is unused.
- `Root summary`: where skills came from and whether config marks them disabled.

3. Before deleting or editing:
- Verify the kept copy exists and is loaded.
- Prefer deleting repo-local or `agent-scripts` duplicates when Codex built-ins cover them.
- Keep repo-local OpenClaw maintainer skills when they encode repo policy or live operations.
- Preserve trigger nouns in descriptions: product, tool, action, object.

## Analyzer Notes

- `filesystem_inventory` is the local `SKILL.md` scan over configured roots. It supplies duplicate, disabled, and archived-cache diagnostics.
- `cli_prompt_inventory` is the optional `codex debug prompt-input` result from the Codex CLI runtime. Its status is `available`, `unavailable`, or `not-requested`; an empty or failed diagnostic does not prove that no skills exist.
- When the CLI result is available, selected skills come from that model-visible prompt. With `--no-live`, `--root-only`, or an unavailable CLI diagnostic, selected skills come from the enabled filesystem scan and are labelled as a fallback.
- `desktop_catalog` is not queried by this script. CLI prompt output, filesystem inventory, and the Codex Desktop catalog are separate evidence sources; this report does not infer Desktop state from either of the first two.
- The script mirrors Codex's model-visible line shape: `- name: description (file: path)`.
- It applies Codex-like frontmatter rules: YAML frontmatter only, default name from parent dir, single-line sanitized `name` and `description`.
- It follows Codex `core-skills/src/render.rs`: 2% of raw `context_window`, token cost `ceil(utf8_bytes / 4)`, then full descriptions -> equal description truncation -> omitted minimum lines. Alias-table line cost is included.
- It reads `~/.codex/models_cache.json` for the model selected by `--model`; fallback is 272,000 tokens and 2%.
- The config reader uses the pinned `smol-toml` parser, then extracts disabled skill paths/names and plugin flags. It supports basic/literal and multiline strings, quoted keys, and inline tables; unrelated and nested plugin settings do not become enablement flags. Parse errors expose only a generic diagnostic and available line/column numbers, never source text or values.
- It scans only normal Codex/plugin/repo skill roots by default. Extra folders such as Dropbox archives are included only with `--root <path>`.
- `--root-only` requires at least one `--root <path>`, skips the live Codex inventory, and scans only those supplied roots.
- It realpath-dedupes roots, so symlinked roots such as `~/.codex/skills/agent-scripts -> ~/Projects/agent-scripts/skills` do not create false duplicates.
- For duplicate names, it reports description/body similarity and suggests deletion candidates only when bodies are near copies. Keep priority defaults to direct Codex system skills, then direct Codex skills, then plugin skills, then personal/repo copies.
- It scans `~/.codex/history.jsonl` and recent `~/.codex/sessions/**/*.jsonl` by default. Add `--deep-logs` for archived sessions and common OpenClaw/Clawd log folders.
- Usage evidence is heuristic: user `$skill`/`use skill` mentions and paths observed in tool-call arguments.

## Output Policy

- Suggest first; edit only when the user asks.
- If asked to apply cleanup, make small grouped commits: descriptions, deletes, config disables.
- Do not delete ignored/untracked skill dirs without naming the destination or confirming they are disposable.
