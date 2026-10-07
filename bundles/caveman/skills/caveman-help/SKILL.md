---
name: caveman-help
description: >
  Quick-reference card for the three caveman skills and their commands.
  Trigger: /caveman-help or "caveman help".
---

# Caveman Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in caveman style.

## Modes

| Mode | Trigger | What change |
|------|---------|-------------|
| **caveman** | `/caveman` | ASD-STE100-machine. Maximum brevity, grammatical sentences, every technical fact kept. Default. |
| **ultracave** | `/ultracave` (alias `/caveman ultra`) | Grammar stripped. Fragments, one word when enough, each fact once. |
| **megacave** | `/megacave` (alias `/caveman wenyan`) | Classical Chinese 文言文. Far fewer characters, technical terms verbatim. |

Mode stick until changed or session end.
`/caveman status` reports current mode without changing it. Claude Code and the standalone OpenCode plugin read stored state; other hosts use conversation context and report `unknown` if no mode is known.

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **caveman-commit** | `/caveman-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **caveman-review** | `/caveman-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **caveman-compress** | `/caveman-compress <file>` | Shorten a selected prose file. Show the measured size change; token and cost savings require separate evidence. |
| **caveman-help** | `/caveman-help` | This card. |

## Deactivate

Say "stop caveman" or "normal mode". Resume anytime with `/caveman`.

## Language

Keep user's language by default — reply in the language user writes, never switch regardless of example text or multilingual context elsewhere. Compress the style, not the language. Technical terms, code, commands, commit types, and exact error strings stay verbatim unless user ask for translation.

## Codex invocation and local settings

In Codex, invoke a skill with `$caveman` or select it from the skills menu. Slash forms in this card are upstream aliases, not guaranteed native Codex commands. CLI commands such as `caveman stats` are separate shell commands.

Voice mode, hook enabled/trust state, and proxy mode are separate controls. Do not infer an active voice from installed files or configured defaults. Report unknown when no active mode is established.

The local runtime settings file is `~/.caveman-cloud/config.json`. Inspect resolved settings with `caveman tools config get`. `think.mode` controls request transforms, not the reply language. Claude/OpenCode defaultMode and flag-file recipes do not configure native Codex activation.

This installation excludes Cloud and durable Cavemem memory. CCR recovery remains available. Normal caveman uses ASD-STE100-machine; ultracave and megacave need explicit requests. Savings in this Desktop installation have not been measured.

## More

Full docs: https://github.com/JuliusBrussee/caveman

## Maintained CLI binding

All shell CLI Caveman invocations use `& "$env:USERPROFILE/.codex/maintained/caveman/releases/filin-20261007-r1/caveman.ps1" <args>` explicitly. Preserve existing home/CCR selections and ordinary command permissions. Bare `caveman` or `cave` executable names resolve mutable upstream shims. Slash skill aliases remain skill commands.
