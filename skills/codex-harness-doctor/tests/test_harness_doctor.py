import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "harness_doctor.py"


def run_doctor(*args: str) -> dict:
    completed = subprocess.run(
        [sys.executable, str(SCRIPT), *args, "--format", "json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode:
        raise AssertionError(
            f"doctor failed ({completed.returncode})\nstdout={completed.stdout}\nstderr={completed.stderr}"
        )
    return json.loads(completed.stdout)


def run_doctor_text(*args: str, output_format: str = "markdown") -> str:
    completed = subprocess.run(
        [sys.executable, str(SCRIPT), *args, "--format", output_format],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode:
        raise AssertionError(f"doctor failed ({completed.returncode})\n{completed.stderr}")
    return completed.stdout


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        digest.update(str(path.relative_to(root)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


class HarnessDoctorTests(unittest.TestCase):
    def test_output_survives_ascii_console_encoding(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp) / "repo"
            repo.mkdir()
            environment = os.environ.copy()
            environment["PYTHONIOENCODING"] = "ascii"

            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "quick", "--repo", str(repo), "--format", "markdown"],
                check=False,
                capture_output=True,
                text=True,
                env=environment,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("# Codex harness evidence brief", completed.stdout)

    def test_quick_discovers_effective_agents_and_skill_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            home = base / "home"
            repo = base / "repo"
            target = repo / "services" / "api"
            (home / ".codex").mkdir(parents=True)
            (home / ".agents" / "skills" / "rare-incident").mkdir(parents=True)
            target.mkdir(parents=True)
            (repo / ".git").mkdir()
            (repo / "AGENTS.md").write_text("Keep invariant X.\n", encoding="utf-8")
            (target / "AGENTS.override.md").write_text("Run targeted API tests.\n", encoding="utf-8")
            (home / ".codex" / "AGENTS.md").write_text("Never expose secrets.\n", encoding="utf-8")
            (home / ".agents" / "skills" / "rare-incident" / "SKILL.md").write_text(
                "---\nname: rare-incident\ndescription: Use when recovering a rare production incident.\n---\n\n# Rare\n",
                encoding="utf-8",
            )

            result = run_doctor(
                "quick",
                "--repo",
                str(repo),
                "--target",
                str(target),
                "--codex-home",
                str(home / ".codex"),
                "--user-home",
                str(home),
            )

            selected = [Path(item["path"]).name for item in result["agents"]["effective_chain"]]
            self.assertEqual(selected, ["AGENTS.md", "AGENTS.md", "AGENTS.override.md"])
            skill = result["skills"]["items"][0]
            self.assertEqual(skill["name"], "rare-incident")
            self.assertEqual(skill["activation"], "on-demand_or_explicit")
            self.assertEqual(result["context"]["token_measurement"], "unavailable")

    def test_hook_summary_does_not_treat_concurrent_work_as_serial_latency(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            trace = base / "hooks.jsonl"
            rows = []
            for duration in [820, 910, 880, 870, 940]:
                rows.append({"hook_id": "global", "event": "PostToolUse", "duration_ms": duration, "exit_status": 0})
            for duration in [760, 800, 790, 830, 810]:
                rows.append({"hook_id": "repo", "event": "PostToolUse", "duration_ms": duration, "exit_status": 0})
            trace.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")

            result = run_doctor("deep", "--repo", str(repo), "--hook-trace", str(trace))

            hooks = result["runtime"]["hooks"]
            self.assertEqual(hooks["observed_work_sum_ms"], 8410.0)
            self.assertIsNone(hooks["observed_critical_path_ms"])
            self.assertIn("cannot be derived", hooks["critical_path_note"])
            self.assertEqual(hooks["by_hook"]["global"]["p95_ms"], 940.0)

    def test_permission_groups_and_secret_redaction(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            trace = base / "permissions.jsonl"
            secret = "sk-proj-abcdefghijklmnop"
            rows = [
                {"tool": "Bash", "command": "rm -rf build", "outcome": "denied", "actor": "policy", "reason": "recursive delete forbidden"},
                {"tool": "Bash", "command": "rm -rf build", "outcome": "denied", "actor": "policy", "reason": "recursive delete forbidden"},
                {"tool": "upload", "arguments": {"authorization": f"Bearer {secret}"}, "outcome": "denied", "actor": "user"},
            ]
            trace.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")

            result = run_doctor("deep", "--repo", str(repo), "--permission-trace", str(trace))

            groups = result["runtime"]["permissions"]["groups"]
            repeated = next(group for group in groups if group["actor"] == "policy")
            self.assertEqual(repeated["count"], 2)
            self.assertEqual(repeated["classification"], "policy-enforced denial")
            rendered = json.dumps(result)
            self.assertNotIn(secret, rendered)

    def test_mcp_inventory_reports_serialized_source_size_not_prompt_tokens(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            inventory = base / "mcp.json"
            payload = {
                "servers": [
                    {
                        "name": "mega",
                        "startup_samples_ms": [1900, 2100, 2000],
                        "tools": [
                            {"name": "read", "description": "Read data", "inputSchema": {"type": "object"}},
                            {"name": "export", "description": "Rare critical export", "inputSchema": {"type": "object"}},
                        ],
                    }
                ]
            }
            inventory.write_text(json.dumps(payload), encoding="utf-8")

            result = run_doctor("deep", "--repo", str(repo), "--mcp-inventory", str(inventory))

            server = result["mcp"]["inventories"][0]
            self.assertEqual(server["tool_count"], 2)
            self.assertGreater(server["serialized_tools_bytes"], 0)
            self.assertEqual(server["context_interpretation"], "serialized source-size proxy; prompt injection unknown")
            self.assertNotIn("recommendation", server)
            components = {item["component"]: item for item in result["context"]["components"]}
            self.assertIn("MCP server instructions", components)
            self.assertIn("MCP tool schemas", components)

    def test_normalized_otel_metrics_are_kept_separate_by_signal(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            trace = base / "metrics.jsonl"
            rows = [
                {"name": "codex.hooks.run.duration_ms", "value": 820, "attributes": {"hook_name": "audit", "source": "repo", "status": "ok"}},
                {"name": "codex.hooks.run.duration_ms", "value": 940, "attributes": {"hook_name": "audit", "source": "repo", "status": "ok"}},
                {"name": "codex.mcp.call.duration_ms", "value": 410, "attributes": {"tool": "read", "status": "ok"}},
                {"name": "codex.approval.requested", "value": 1, "attributes": {"tool": "shell", "approved": "denied"}},
            ]
            trace.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")

            result = run_doctor("deep", "--repo", str(repo), "--metric-trace", str(trace))

            metrics = result["runtime"]["metrics"]
            self.assertEqual(metrics["hooks"][0]["p95"], 940.0)
            self.assertEqual(metrics["mcp"][0]["p50"], 410.0)
            self.assertEqual(metrics["approvals"][0]["count"], 1.0)
            self.assertEqual(metrics["source_contract"], "normalized OTel metric observations supplied by the user")

    def test_plugin_inventory_keeps_plugin_hooks_visible(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            inventory = base / "plugins.json"
            inventory.write_text(
                json.dumps(
                    {
                        "plugins": [
                            {
                                "name": "quality-suite",
                                "enabled": True,
                                "skills": ["python-quality"],
                                "mcp_servers": [{"name": "quality-mcp", "tool_count": 9}],
                                "hooks": [{"event": "PostToolUse", "matcher": "Bash"}],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            result = run_doctor("deep", "--repo", str(repo), "--plugin-inventory", str(inventory))

            plugin = result["plugins"]["items"][0]
            self.assertEqual(plugin["hook_count"], 1)
            self.assertEqual(plugin["mcp_server_count"], 1)
            self.assertIn("plugin-bundled", result["plugins"]["source_note"])

    def test_scan_is_read_only_for_repository(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp) / "repo"
            repo.mkdir()
            (repo / "AGENTS.md").write_text("Do not mutate the repository.\n", encoding="utf-8")
            before = tree_digest(repo)
            run_doctor("quick", "--repo", str(repo))
            self.assertEqual(before, tree_digest(repo))

    def test_adversarial_secrets_never_survive_any_output_channel(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            home = base / "home"
            codex_home = home / ".codex"
            repo.mkdir()
            codex_home.mkdir(parents=True)
            canaries = {
                "userinfo": "url-user-canary",
                "query": "query-token-canary",
                "basic": "QmFzaWMtY2FuYXJ5LXNlY3JldA==",
                "camel": "camel-secret-canary",
                "cli": "cli-password-canary",
                "pem": "pem-private-canary",
                "aws": "aws-secret-canary",
                "secret_key": "secret-key-canary",
                "fragment": "fragment-token-canary",
            }
            (codex_home / "config.toml").write_text(
                "[mcp_servers.leaky]\n"
                f'url = "https://{canaries["userinfo"]}:pw@example.test/mcp?access_token={canaries["query"]}#access_token={canaries["fragment"]}"\n'
                '[mcp_servers.malformed]\nurl = "http://example.test:badport/mcp"\n',
                encoding="utf-8",
            )
            permissions = base / "permissions.jsonl"
            permissions.write_text(
                json.dumps(
                    {
                        "tool": "Bash",
                        "command": f"deploy --password {canaries['cli']}",
                        "outcome": "denied",
                        "actor": "policy",
                        "reason": f"Authorization: Basic {canaries['basic']}",
                        "accessToken": canaries["camel"],
                        "payload": f"-----BEGIN PRIVATE KEY-----\n{canaries['pem']}\n-----END PRIVATE KEY-----",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            hooks = base / "hooks.jsonl"
            hooks.write_text(
                json.dumps({"command": f"curl https://u:{canaries['userinfo']}@example.test", "duration_ms": 1}) + "\n",
                encoding="utf-8",
            )
            plugins = base / "plugins.json"
            plugins.write_text(
                json.dumps({"plugins": [{"name": "p", "enabled": True, "skills": [{
                    "AWS_SECRET_ACCESS_KEY": canaries["aws"], "secretKey": canaries["secret_key"]
                }]}]}),
                encoding="utf-8",
            )
            for output_format in ("json", "markdown"):
                rendered = run_doctor_text(
                    "deep", "--repo", str(repo), "--codex-home", str(codex_home), "--user-home", str(home),
                    "--permission-trace", str(permissions), "--hook-trace", str(hooks),
                    "--plugin-inventory", str(plugins), output_format=output_format,
                )
                for canary in canaries.values():
                    self.assertNotIn(canary, rendered)
                self.assertIn("[REDACTED]", rendered)

    def test_untrusted_project_config_is_discovered_but_not_effective(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            home = base / "home"
            codex_home = home / ".codex"
            (repo / ".codex").mkdir(parents=True)
            codex_home.mkdir(parents=True)
            (repo / ".codex" / "config.toml").write_text(
                '[mcp_servers.untrusted]\nurl = "https://example.test/mcp"\n'
                '[hooks]\nPostToolUse = []\n',
                encoding="utf-8",
            )
            result = run_doctor(
                "quick", "--repo", str(repo), "--codex-home", str(codex_home), "--user-home", str(home),
                "--project-trusted", "unknown",
            )
            project = next(item for item in result["config"]["items"] if item["scope"] == "project")
            self.assertFalse(project["used_for_effective_resolution"])
            self.assertEqual(result["mcp"]["configured_servers"], [])
            self.assertEqual(result["hooks"]["handlers"], [])

    def test_agents_context_and_duplicates_respect_combined_byte_cap(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            target = repo / "nested"
            home = base / "home"
            codex_home = home / ".codex"
            target.mkdir(parents=True)
            codex_home.mkdir(parents=True)
            (codex_home / "config.toml").write_text("project_doc_max_bytes = 10\n", encoding="utf-8")
            (repo / "AGENTS.md").write_text("abcdefgh\nDUPLICATE LONG RULE HERE\n", encoding="utf-8")
            (target / "AGENTS.md").write_text("ijklmnop\nDUPLICATE LONG RULE HERE\n", encoding="utf-8")
            result = run_doctor(
                "quick", "--repo", str(repo), "--target", str(target), "--codex-home", str(codex_home), "--user-home", str(home)
            )
            chain = result["agents"]["effective_chain"]
            self.assertEqual([item["included_bytes_under_configured_cap"] for item in chain], [10, 0])
            agents_context = next(item for item in result["context"]["components"] if item["component"] == "AGENTS effective chain")
            self.assertEqual(agents_context["characters"], 10)
            self.assertEqual(result["agents"]["duplicate_candidates"], [])

    def test_hook_failure_rate_scope_grouping_and_interval_union(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            hooks = base / "hooks.jsonl"
            hooks.write_text(
                "".join(
                    json.dumps(row) + "\n"
                    for row in [
                        {"hook_id": "h", "duration_ms": 10, "exit_status": 0, "invocation_id": "a", "started_at_ms": 0, "ended_at_ms": 10},
                        {"hook_id": "h", "exit_status": 1, "invocation_id": "b", "started_at_ms": 5, "ended_at_ms": 20},
                    ]
                ),
                encoding="utf-8",
            )
            permissions = base / "permissions.jsonl"
            permissions.write_text(
                "".join(
                    json.dumps({"tool": "Bash", "command": "write x", "permission": "write", "scope": scope, "outcome": "denied", "actor": "policy", "reason": reason}) + "\n"
                    for scope, reason in [("a", "wording one"), ("a", "wording two"), ("b", "wording one")]
                ),
                encoding="utf-8",
            )
            result = run_doctor("deep", "--repo", str(repo), "--hook-trace", str(hooks), "--permission-trace", str(permissions))
            self.assertEqual(result["runtime"]["hooks"]["by_hook"]["h"]["failure_rate"], 0.5)
            self.assertEqual(result["runtime"]["hooks"]["observed_critical_path_ms"], 20.0)
            groups = result["runtime"]["permissions"]["groups"]
            self.assertEqual(sorted(group["count"] for group in groups), [1, 2])

    def test_quick_accepts_static_inventories_and_preserves_missing_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            mcp = base / "mcp.json"
            plugins = base / "plugins.json"
            mcp.write_text(json.dumps({"servers": [{"name": "docs", "tools": [], "startup_samples_ms": None}]}), encoding="utf-8")
            plugins.write_text(json.dumps({"plugins": [{"name": "p", "enabled": True}]}), encoding="utf-8")
            result = run_doctor("quick", "--repo", str(repo), "--mcp-inventory", str(mcp), "--plugin-inventory", str(plugins))
            self.assertEqual(result["mcp"]["inventories"][0]["startup_status"], "UNAVAILABLE")
            self.assertEqual(result["plugins"]["items"][0]["hook_count"], "UNAVAILABLE")

    def test_markdown_contains_complete_runtime_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            metrics = base / "metrics.jsonl"
            metrics.write_text(json.dumps({"name": "codex.hooks.run.duration_ms", "value": 42, "attributes": {"hook_name": "audit"}}) + "\n", encoding="utf-8")
            rendered = run_doctor_text("deep", "--repo", str(repo), "--metric-trace", str(metrics))
            self.assertIn("Complete machine-readable evidence", rendered)
            self.assertIn('"p95": 42.0', rendered)

    def test_layer_manifest_resolves_precedence_and_mcp_shadowing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            repo.mkdir()
            low = base / "managed.toml"
            high = base / "session.toml"
            low.write_text('approval_policy = "on-request"\n[mcp_servers.docs]\nurl = "https://old.example/mcp"\n', encoding="utf-8")
            high.write_text('approval_policy = "never"\n[mcp_servers.docs]\nurl = "https://new.example/mcp"\n', encoding="utf-8")
            manifest = base / "layers.json"
            manifest.write_text(
                json.dumps({"layers": [
                    {"path": str(low), "scope": "managed", "active": True},
                    {"path": str(high), "scope": "session", "active": True},
                ]}),
                encoding="utf-8",
            )
            result = run_doctor("quick", "--repo", str(repo), "--config-layer-manifest", str(manifest))
            approval = result["config"]["effective_audit_settings"]["approval_policy"]
            self.assertEqual(approval["value"], "never")
            server = result["mcp"]["configured_servers"][0]
            self.assertEqual(server["url"], "https://new.example/mcp")
            self.assertEqual(server["shadowed_sources"], [str(low)])

    def test_empty_manifest_never_falls_back_to_automatic_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            codex_home = base / "home" / ".codex"
            repo.mkdir()
            codex_home.mkdir(parents=True)
            (codex_home / "config.toml").write_text('approval_policy = "never"\n', encoding="utf-8")
            manifest = base / "layers.json"
            manifest.write_text('{"layers":[]}', encoding="utf-8")
            result = run_doctor(
                "quick", "--repo", str(repo), "--codex-home", str(codex_home),
                "--config-layer-manifest", str(manifest),
            )
            self.assertEqual(result["config"]["layer_resolution"], "host_manifest")
            self.assertEqual(result["config"]["items"], [])
            self.assertEqual(result["config"]["effective_audit_settings"], {})

    def test_disabled_skill_and_plugin_roots_do_not_contribute_context(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo = base / "repo"
            home = base / "home"
            codex_home = home / ".codex"
            disabled = home / ".agents" / "skills" / "disabled"
            plugin_root = base / "plugin-skills"
            repo.mkdir()
            codex_home.mkdir(parents=True)
            disabled.mkdir(parents=True)
            (plugin_root / "plugin-skill").mkdir(parents=True)
            skill_text = "---\nname: disabled\ndescription: Disabled test skill.\n---\n"
            (disabled / "SKILL.md").write_text(skill_text, encoding="utf-8")
            (plugin_root / "plugin-skill" / "SKILL.md").write_text(
                "---\nname: plugin-skill\ndescription: Disabled plugin skill.\n---\n", encoding="utf-8"
            )
            (codex_home / "config.toml").write_text(
                '[[skills.config]]\npath = "' + str(disabled / "SKILL.md").replace("\\", "\\\\") + '"\nenabled = false\n',
                encoding="utf-8",
            )
            plugins = base / "plugins.json"
            plugins.write_text(json.dumps({"plugins": [{"name": "off", "enabled": False, "skill_roots": [str(plugin_root)]}]}), encoding="utf-8")
            result = run_doctor(
                "quick", "--repo", str(repo), "--user-home", str(home), "--codex-home", str(codex_home),
                "--plugin-inventory", str(plugins),
            )
            disabled_item = next(item for item in result["skills"]["items"] if item["name"] == "disabled")
            self.assertFalse(disabled_item["enabled"])
            self.assertFalse(any(item["name"] == "plugin-skill" for item in result["skills"]["items"]))
            self.assertEqual(result["skills"]["discovery_metadata_characters_proxy"], 0)
            activated = next(item for item in result["context"]["components"] if item["component"] == "Activated Skill instructions")
            self.assertEqual(activated["characters"], "UNAVAILABLE")
            self.assertEqual(activated["discovered_enabled_source_characters_proxy"], 0)


if __name__ == "__main__":
    unittest.main()
