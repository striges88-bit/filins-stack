# Filin's Stack

A portable snapshot of Codex skills and global agent instructions. Clone it on another computer and install only the pieces you need.

## Contents

| Path | Purpose |
| --- | --- |
| `global/AGENTS.md` | Global rules for how the agent works. |
| [`bundles/caveman`](bundles/caveman) | Pinned Codex adaptation, guarded lifecycle, read-only upstream monitor and complete architecture map. |
| `skills/codex-harness-doctor` | Diagnose Codex setup and performance. |
| `skills/defuddle` | Extract readable Markdown from web pages. |
| `skills/deslop` | Remove unnecessary AI-generated code. |
| `skills/github-task-lifecycle` | Track work tied to GitHub issues. |
| `skills/goal-loop` | Guide persistent plan, act, test, review loops. |
| `skills/investigate-first` | Find evidence before changing code. |
| `skills/last30days` | Research recent public discussion. |
| `skills/launch-subagent` | Delegate bounded tasks to subagents. |
| `skills/lean-build` | Keep feature work focused. |
| `skills/level-up` | Assess knowledge with seven adaptive questions. |
| `skills/show-me` | Explain ideas with small diagrams and visual sketches. |
| `skills/skill-cleaner` | Audit skill usage, duplicates, and prompt cost. |
| `skills/surgical-patch` | Make narrow, verified bug fixes. |
| `skills/thermo-nuclear-code-quality-review` | Run a strict maintainability review. |
| `skills/verify-and-stop` | Check acceptance criteria and stop when proven. |
| `skills/verify-this` | Test a specific claim against fresh evidence. |

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

On macOS or Linux, follow the same paths and check for existing files before copying. These are snapshots, not an automatic updater. Review changes before replacing an installed copy.

`skill-cleaner` needs a Node runtime with `--experimental-strip-types`. After installing it, run `npm ci --ignore-scripts --no-audit --no-fund` from its directory; `node_modules` is not tracked. Other skills may need external tools or credentials; consult their `SKILL.md` files. `level-up` writes learning notes inside the active project.

`last30days` comes from [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) under MIT. Its license and the bundled client's license are included in that directory. No repository-wide license has been selected for the other files.

The Caveman bundle has a separate reviewed lifecycle. The skill-copy example above does not install or update its runtime. See its [bundle instructions](bundles/caveman/README.md) and [architecture](bundles/caveman/assets/architecture.png). Upstream changes require manual security and compatibility review.
