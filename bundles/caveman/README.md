# Maintained Caveman for Codex

`filin-20261007-r1` freezes the reviewed local CLI, five companion EXEs and Node v24.13.0 in one versioned release. Existing state, Core gates, full-safe default, Learn autopilot and its `--no-remember` scan stay selected. Cloud, Cavemem and Pixel stay excluded.

The bundle's `.gitattributes` preserves exact source bytes on Windows checkout. Do not normalize pinned files before a manual review and lock update.

## Contents and provenance

`cli/` contains the complete 27-file installed npm input plus one maintained resolver module. The input already contains local reviewed adaptations. It is not a pristine npm tarball or a TypeScript rebuild. `provenance-lock.json` records the adapted input hashes, upstream npm identity, saved publish attestation, embedded binary build commit and maintained skill hashes separately.

`skills/` contains eleven existing Codex adaptations. `roles/` contains three existing roles. The help, Learn and statistics skills bind shell commands explicitly to the maintained launcher. Slash aliases continue to select skills. Models and role capabilities remain unchanged.

The JS changes bind companion paths before canonical dispatch and replace the shared resolver. Missing release files fail. Inherited binary overrides and PATH cannot select another companion. The native launcher binds pinned `NODE`, non-Pixel policy and telemetry-off before the Go hook enters its native IPC path. Core-off and Record suppression remain effective.

Upstream CLI code uses Apache-2.0. Its LICENSE and NOTICE remain intact. `licenses/` preserves nine exact release licensing assets and the version-specific Node LICENSE. These notices do not establish permission to redistribute every binary component. No EXE, Node runtime, private config, journal, authentication, history, CCR database or proxy log belongs in this Git bundle.

`optional/` preserves exact installed npm SDK 1.2.0 and middleware 1.0.0 implementations without dependencies or caches. All 20 SDK files and 50 middleware files match their saved pinned tarballs and SHA-512 integrity values. Middleware retains its declared SDK range `^1.2.0`; this snapshot pins SDK 1.2.0 separately. Optional framework peers are absent. Package metadata records supported framework versions. Importing these files does not install peers or integrate a project.

The separate Chrome MV3 unpacked extension 1.2.0 has 17 exact files matching the inspected source's staged output at commit `99aafe151a1be72be783e662858e8a0955add59f`. It remains unloaded. Its storage permission and Chrome `storage.sync` behavior remain visible in its manifest and privacy notice. The Pi integration in `cli/dist/caveman-pi-extension.mjs` is a different component. Python SDK/middleware retain matching-commit license snapshots only. No installed Python package was observed in `C:/Python314/Lib/site-packages`.

Optional implementation snapshots are also staged under `cli/optional/` and covered by release hashes. They are unactivated source snapshots. Their unmodified framework/native resolution behavior is not an approved runtime integration or closure proof.

## Architecture

Open the [portable viewer](assets/viewer.html), [rendered map](assets/architecture.png) or [component inventory](assets/components.json). The upstream inventory preserves 125 source records and 207 conditional relations. The main map selects 31 edges for readable data paths. Inventory membership does not imply local availability or activation. Component status distinguishes installed, optional, available snapshots and excluded capabilities.

## Stage and inspect

Python 3.11 or newer and the existing reviewed Windows artifacts are required. No dependency installation runs. Use PowerShell from this directory.

```powershell
$release = Join-Path $env:USERPROFILE '.codex/maintained/caveman/releases/filin-20261007-r1'
python .\lifecycle.py stage --release $release --home $env:USERPROFILE
python .\lifecycle.py plan --release $release --home $env:USERPROFILE --plan '<private-plan-directory>'
python .\checks.py --release $release --evidence '<private-check-directory>'
python .\lifecycle.py self-check
python .\watch-upstream.py --state '<private-state-directory>/watch.json' --self-check
```

Stage hashes existing EXEs and Node against the lock. Its generated `release-manifest.json` owns release paths, file hashes and the required environment. Repeated staging verifies the existing release and source. A different source fails. Windows and Chrome remain external platform dependencies.

A plan contains typed owned-file mutations and exact before/after backups. Keep the plan outside this public bundle. `--registration-release` can prepare final registrations against a different future release path while checking an existing staged release. Review all mutations before applying.

The migration changes all twelve owned hook commands, including stored `PostToolUseFailure`, both MCP commands and companion environments, the global Shrink command references, explicit shell bindings in global instructions and three skills, and the Codex integration journal ownership. It preserves unrelated hooks, matchers, timeouts, flags, trust hashes, configuration fields and Chrome selection. Unexpected owned hook command flags require review. Original installation backups stay intact. Migration backups are separate.

```powershell
python .\lifecycle.py apply --plan '<reviewed-private-plan-directory>'
python .\lifecycle.py verify --plan '<reviewed-private-plan-directory>'
```

Apply and rollback validate every owned file before the first write. Any drift rejects the operation. Rollback restores only a complete matching after-state. It leaves newer files and live state databases intact.

## Trust and runtime gates

Run lifecycle verification before hook trust reconciliation. The host owns trust. Read actual `hooks/list` current hashes, then use the documented `config/batchWrite` trusted-hash flow. Never compute a replacement trust hash or reuse a historical hash for a new command.

Record trust reconciliation as a separate guarded transaction. Back up exact config bytes and any journal ownership digest changes. Validate that only the reviewed trusted-hash entries and corresponding ownership digest changed. Before lifecycle rollback, undo that trust transaction only when its whole after-state still matches. This restores the lifecycle plan's after-state. Then run lifecycle rollback. A changed trust after-state stops rollback. Do not rebaseline blindly.

Registration changes select future consumers. They do not replace an already running backend. Matching `nativeruntime.Call` source sends bounded IPC to the state-owned server and spawns no executable. SessionStart, UserPromptSubmit and PostCompact can revive a missing local proxy through the pinned maintained resolver. The current listener can remain the old executable until explicit restart.

For an authorized fresh foreground start after the old listener has been handled separately:

```powershell
& "$env:USERPROFILE/.codex/maintained/caveman/releases/filin-20261007-r1/caveman.ps1" start --host 127.0.0.1 --port 8787
```

`start` spawns the pinned proxy and performs no registration installation. This bundle starts no service and kills no process. The old detached proxy requires an explicit authorized restart. A Codex restart alone need not terminate it. Restart Codex separately to refresh loaded hooks and MCP consumers. Observe fresh hook delivery, MCP executable identities and listener ownership before claiming runtime isolation.

## Commands and checks

All shell CLI invocations use the absolute maintained `caveman.ps1` or pinned Node/index pair. Preserve home/CCR environment selections and ordinary command approvals. Bare `caveman` and `cave` commands still resolve mutable upstream shims.

The canonical CLI blocks updater, installer, enable/disable, registration rewrites, Pixel conversion and wrapper auto-registration paths. `wrap` and `run` are blocked. Existing explicit proxy/MCP registrations cover this installation. Ordinary Shrink, Compress, Browse, recovery, help and approved Learn remain available. Future wrapper support needs a reviewed no-registration path.

`checks.py` verifies file closure and JS syntax, rejects canonical mutation commands, ignores hostile binary overrides, fails on missing companions, executes with empty PATH, proves finite-command exit 7 and saved-file exit 0, recovers each full original without a query, and compares twelve exact Core hook outputs through the staged native launcher. It uses isolated state and suppresses Learn/proxy activity during those cases. Controlled checks do not prove Desktop delivery or the existing backend's identity.

`watch-upstream.py` reads public GitHub latest-release and main-commit metadata only. Responses are bounded to 1 MiB each and 20 seconds per request. The first successful run records a silent baseline. Identical metadata and repeated identical failures produce no notification. New changes and new failures set `notify=true`. The caller decides whether to notify. The monitor never installs, advances pins, fetches executable code, changes globals, starts services, restarts or publishes. Every promotion requires manual security and compatibility review.
