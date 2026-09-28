---
name: github-task-lifecycle
description: 'Track requested GitHub Issue implementation or status work. Use when issue-linked execution or synchronization is requested; a URL supplied for reference or read-only audit does not by itself request publication.'
---

# GitHub task lifecycle

When issue implementation or tracking is requested, use the linked GitHub Issue as the external work-state record. Keep code and detailed evidence in the repository; keep status, blockers, decisions, verification, and links visible on the Issue. A URL supplied as reference or for a read-only audit authorizes reading only.

## 1. Resolve and preflight

1. Resolve `owner/repo` from the supplied URL, then local `origin` only if the URL is absent. Resolve the exact issue number; never infer a different issue from title similarity.
2. Read the issue body, state, labels, comments, and blocking links before changing files or starting a Codex task.
3. Check acceptance criteria and `Blocked by`. If the requested issue work is blocked, missing required information, or not authorized, mark the dependent work `BLOCKED`. When tracking is in scope and the remote write is authorized, comment the blocker and stop that dependent work; otherwise preserve local evidence and continue independent authorized work. Use existing `needs-info` or `needs-triage` labels only when they describe the actual state.
4. Record the issue number in the project designated tracker or handoff when the active work uses one; keep read-only references in the current task.
5. Once authorized issue execution or tracking actually starts, post one `STARTED` comment with the Codex task id/worktree or branch, scope, boundary, and next milestone. Do not post a start comment for a reference-only or read-only audit.

Prefer the connected GitHub app for issue reads and writes. Use local `gh` only when the connector cannot access the repository or operation; verify authentication before relying on it. If both paths fail, report `GITHUB_SYNC_BLOCKED`, preserve local evidence, and do not claim that GitHub was updated.

## 2. Update only at meaningful events

Post one concise comment when one of these changes:

- a material finding changes the plan, hypothesis, risk, scope, or confidence;
- an acceptance criterion is verified or fails;
- a user decision or external input is required;
- a safety boundary or execution stop is reached;
- verification completes, including unavailable checks and their impact.

Do not comment for routine commands, unchanged status, repeated output, or obvious file navigation. Group adjacent routine work under the next meaningful event.

Use this compact structure; omit empty fields:

```text
Status: STARTED | PROGRESS | BLOCKED | VERIFIED | PARTIAL | COMPLETED
Evidence: <new fact or acceptance result>
Impact: <why it changes status or direction>
Next: <next action, or STOP / user decision required>
Links: <task, worktree, commit, PR, or artifact when available>
```

The comment is a status summary, not a transcript or hidden-reasoning dump.

## 3. Checklists and state changes

- Prefer append-only comments as the audit trail.
- Update issue-body checkboxes only after the corresponding acceptance criterion is directly verified. First fetch the current body, replace only exact unchecked criterion lines, preserve all other text, then re-read the issue to verify the write.
- Never mark dependent, unrun, or inferred work complete. If a revised protocol changes the acceptance boundary, record the revision in a comment and leave the old criterion unchecked until the issue is explicitly superseded.
- Keep an issue open for `BLOCKED` or `PARTIAL`; add `needs-info` only for a real user/input dependency and `needs-triage` only for an unresolved scope/triage decision.
- Close an issue only when every applicable acceptance criterion is verified and the final comment contains evidence and unresolved risk. Use `completed` for a completed issue; use `not_planned` only when the work was deliberately abandoned.
- Do not close a parent issue merely because a child finished. Summarize child progress on the parent; close the parent only when its own acceptance criteria pass.

For a control-only or pilot run, explicitly distinguish `CONTROL_COMPLETE` from `TREATMENT_NOT_STARTED`; do not convert that distinction into a causal or global-rollout claim.

## 4. Implementation, verification, and Git checkpoints

For requested issue implementation or tracking, read the issue and post `STARTED` at task start.

At a meaningful decision, failed check, changed risk, or user-stop boundary: post `PROGRESS` or `BLOCKED` and stop when required.

At verification: record exact checks, pass/fail/unavailable, and residual risk in `VERIFIED` or `PARTIAL`.

At completion: post one final evidence summary, update verified checkboxes if safe, then close only if the issue is actually complete.

Actively guide the user through the useful Git checkpoints for issue-linked work:

- **Commit:** recommend it after a coherent, reviewed, and sufficiently verified local slice. State what will be included, any verification gap, and a proposed commit message.
- **Push:** recommend it when verified commits should be backed up remotely, shared, or sent to CI. State the exact remote and branch and whether this is the first publication of that branch.
- **Pull request:** recommend it when the branch is reviewable and its scope, evidence, and remaining risks can be summarized. Recommend draft versus ready-for-review and state the base and head branches.

Git timing guidance is not authorization. If the current request or applicable project instructions do not already authorize the specific commit, push, or PR action, ask immediately before it. Authorization may be given up front or at the checkpoint; once given, do not ask again unless the target, scope, history operation, or risk materially changes. An instruction from another workflow skill to commit, push, or open a PR does not by itself grant authority.

After an authorized action, verify its result and add the commit or PR link to the next meaningful Issue update. Never stage unrelated changes. Force-push, history rewrites, and merges require separate explicit authority.

## 5. User-facing handoff

When issue tracking is in scope, the final response must state:

- the exact Issue URL;
- whether GitHub sync was `UPDATED`, `PARTIAL`, or `BLOCKED`;
- what was verified and what remains open;
- links to local evidence and any commit/PR when they exist.

For a reference-only or read-only audit, state that no Issue publication or state change was requested.

If no Issue was supplied and the user did not ask for issue tracking, do not invent or create one. If the user asks to track the work, create or link an Issue before execution and then follow this lifecycle.
