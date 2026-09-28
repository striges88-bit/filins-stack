---
name: launch-subagent
description: Read before launching an internal subagent or an explicitly selected external agent. Use for bounded independent delegation and result verification.
---

# Subagent delegation

Use the host's subagent tools for bounded independent work when delegation is authorized and useful. Follow the user's current model preferences and the models actually exposed by the host; fall back without blocking the task. Give each agent the needed context, constraints, output contract, and exclusive write scope. Context inheritance depends on the host and fork settings. Verify delegated results. If delegation is unavailable or adds no value, continue locally. Do not create a user-visible Codex task for an internal subtask.

- Delegate only self-contained tasks with clear success criteria.
- Split work so independent agents do not touch the same files; keep tightly coupled edits in one loop.
- Keep the brief narrow and include all context the agent cannot inherit.
- Review the returned files, diff, and verification evidence before trusting the result.
