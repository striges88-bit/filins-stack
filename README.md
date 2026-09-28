# Filin's Stack

A portable snapshot of my Codex skills and global agent instructions. Clone it on another computer, then copy the pieces you want into your Codex home directory.

## Contents

| Path | Purpose |
| --- | --- |
| `global/AGENTS.md` | Global rules for how the agent works. |
| `skills/codex-harness-doctor` | Diagnose Codex setup and performance. |
| `skills/defuddle` | Extract readable Markdown from web pages. |
| `skills/deslop` | Remove unnecessary AI-generated code. |
| `skills/github-task-lifecycle` | Track work tied to GitHub issues. |
| `skills/goal-loop` | Guide persistent plan, act, test, review loops. |
| `skills/investigate-first` | Find evidence before changing code. |
| `skills/last30days` | Research recent public discussion. |
| `skills/launch-subagent` | Delegate bounded tasks to subagents. |
| `skills/lean-build` | Keep feature work focused. |
| `skills/surgical-patch` | Make narrow, verified bug fixes. |
| `skills/thermo-nuclear-code-quality-review` | Run a strict maintainability review. |

## Install on another computer

Clone this repository. Copy a skill directory into `~/.codex/skills/` only if that name is not already installed. To use the global rules, copy `global/AGENTS.md` to `~/.codex/AGENTS.md` after reviewing any existing file. Do not overwrite local changes.

For example, in PowerShell:

```powershell
git clone https://github.com/striges88-bit/filins-stack.git
cd filins-stack
$codex = Join-Path $HOME '.codex'
$skills = @(Get-ChildItem .\skills -Directory)
$rules = Join-Path $codex 'AGENTS.md'
if (Test-Path $rules) { throw "Review existing global rules: $rules" }
foreach ($skill in $skills) {
    $target = Join-Path (Join-Path $codex 'skills') $skill.Name
    if (Test-Path $target) { throw "Already installed: $target" }
}
New-Item -ItemType Directory -Path (Join-Path $codex 'skills') -Force | Out-Null
foreach ($skill in $skills) {
    Copy-Item $skill.FullName (Join-Path (Join-Path $codex 'skills') $skill.Name) -Recurse
}
Copy-Item .\global\AGENTS.md $rules
```

These are snapshots of installed skills, not an automatic updater. Some skills need optional external tools or credentials; see their `SKILL.md` files. `last30days` comes from [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) under MIT; its license and the bundled client's license are included in that directory.
