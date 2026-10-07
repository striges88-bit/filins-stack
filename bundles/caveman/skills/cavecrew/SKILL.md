---
name: cavecrew
description: >
  When to delegate to `cavecrew-investigator` (locate code), `cavecrew-builder`
  (1-2 file edit) or `cavecrew-reviewer` (diff review) instead of working inline
  or using `Explore`. Their output is compressed, so main context lasts longer.
---

Cavecrew = three subagent presets that answer in the compact, grammatical ASD-STE100-machine default (tool runs: one status line in, one out; nothing between routine calls). Same job as Anthropic defaults (`Explore`, edit-style agents, reviewer); difference is the tool-result they return is compressed, so main context shrinks per delegation.

## When to use cavecrew vs alternatives

| Task | Use |
|---|---|
| "Where is X defined / what calls Y / list uses of Z" | `cavecrew-investigator` |
| Same but you also want suggestions/architecture commentary | `Explore` (vanilla) |
| Surgical edit, ≤2 files, scope obvious | `cavecrew-builder` |
| New feature / 3+ files / cross-cutting refactor | Main thread, or `feature-dev:code-architect` if installed |
| Review diff, branch, or file for bugs | `cavecrew-reviewer` |
| Deep code review with rationale + alternatives | `Code Reviewer` (vanilla) if installed, else main thread |
| One-line answer you already know | Main thread, no subagent |

Choose cavecrew when a bounded, structured result is useful. Use ordinary prose when the reader needs explanation.

## Why this exists (the real win)

A concise child report can reduce what the parent reads. The child still spends input and output tokens, and delegation has startup cost. A shorter report does not prove lower total usage. No local token-saving ratio has been measured. Use one child only when its separate task earns that cost.

## Output contracts

What main thread can rely on per agent:

**`cavecrew-investigator`**
```
<Header>:
- path:line — `symbol` — short note
totals: <counts>.
```
Or `No match.` Always file-path-first, line-number-attached, backticked symbols. Safe to grep with `path:\d+`.

**`cavecrew-builder`**
```
<path:line-range> — <change ≤10 words>.
verified: <re-read OK | mismatch @ path:line>.
```
Or one of: `too-big.` / `needs-confirm.` / `ambiguous.` / `regressed.` (terminal first token).

**`cavecrew-reviewer`**
```
path:line: <emoji> <severity>: <problem>. <fix>.
totals: N🔴 N🟡 N🔵 N❓
```
Or `No issues.` Findings sorted file → line ascending.

## Chaining patterns

**Locate → fix → verify** (most common):
1. `cavecrew-investigator` returns site list.
2. Main thread picks 1-2 sites, hands paths to `cavecrew-builder`.
3. `cavecrew-reviewer` audits the diff.

**Parallel scout** (when investigation is broad):
Spawn 2-3 `cavecrew-investigator` calls in one message (different angles: defs vs callers vs tests). Aggregate in main thread.

**Single-shot edit** (when site is already known):
Skip investigator. Hand exact path:line to `cavecrew-builder` directly.

## What NOT to do

- Don't use `cavecrew-builder` when you don't already know the file. Spawn investigator first or main thread will eat tokens passing context.
- Don't chain `cavecrew-investigator → cavecrew-builder` for a 5-file refactor. Builder will return `too-big.` and you'll have wasted a turn.
- Don't ask `cavecrew-reviewer` for "general feedback" — it returns findings only, no architecture opinions. Use `Code Reviewer` for that when installed.
- Keep structured output grammatical and clear. Use extra words when decision-relevant facts, clarity, or exact technical evidence require them.

## Auto-clarity (inherited)

Subagents state risks, conditions, and required actions clearly for security warnings, irreversible-action confirmations, and ambiguous output. Keep the grammatical default style.

## Codex adapter
Use Codex tools: rg for search and shell/file tools for reads. Read launch-subagent before delegation and obey the user model-routing rules. Native roles cavecrew-investigator, cavecrew-builder and cavecrew-reviewer are installed as Codex TOML agents. Claude tool names and haiku presets do not apply. Start with one bounded child; parallel scouts require distinct independent deliverables. Read-only agents cannot edit files.
