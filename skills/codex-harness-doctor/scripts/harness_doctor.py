#!/usr/bin/env python3
"""Collect read-only evidence for a Codex harness audit.

Python 3.11+ is recommended so configuration files can be parsed with tomllib.
The program never starts MCP servers, executes discovered hooks, or edits the
scanned repository. It prints either JSON or a Markdown brief with the complete
redacted JSON evidence object embedded for parity.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
import math
import os
import re
import statistics
import sys
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - exercised on Python < 3.11
    tomllib = None


SCHEMA_VERSION = "1.1"
DEFAULT_PROJECT_DOC_MAX_BYTES = 32 * 1024
SECRET_WORDS = {
    "authorization", "auth", "bearer", "cookie", "credential", "credentials",
    "password", "passwd", "secret", "token", "access_token", "refresh_token",
    "api_key", "apikey", "private_key", "client_secret", "headers",
}
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----", re.IGNORECASE | re.DOTALL),
    re.compile(r"\bAuthorization\s*:\s*[^\r\n]+", re.IGNORECASE),
    re.compile(r"\b(?:Bearer|Basic|Digest)\s+[A-Za-z0-9._~+\-/=,:]{8,}", re.IGNORECASE),
    re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}"),
    re.compile(r"\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{12,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(
        r"(?i)\b(?:password|passwd|secret|accessToken|refreshToken|apiKey|clientSecret)\s*[=:]\s*([^&\s,;]+)",
    ),
]
CLI_SECRET_PATTERN = re.compile(
    r"(?i)(--?(?:password|passwd|secret|token|access-token|api-key|client-secret)(?:=|\s+))([^\s'\"]+|['\"][^'\"]+['\"])",
)
PUBLIC_TOKEN_KEYS = {
    "token_measurement",
    "token_note",
    "token_type",
    "token_usage",
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "context_window_tokens",
    "estimated_tokens",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def normalized_key(value: str) -> str:
    snake = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", value)
    snake = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", snake).replace("-", "_").casefold()
    return re.sub(r"_+", "_", snake).strip("_")


def is_secret_key(value: str) -> bool:
    normalized = normalized_key(value)
    sensitive_parts = {"authorization", "auth", "bearer", "cookie", "credential", "credentials", "password", "passwd", "secret", "token"}
    return (
        normalized in SECRET_WORDS
        or any(normalized == word or normalized.endswith(f"_{word}") for word in SECRET_WORDS)
        or bool(set(normalized.split("_")) & sensitive_parts)
    )


def redact_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https", "ftp", "postgres", "postgresql", "mysql", "redis"} or not parsed.netloc:
            return value
        hostname = parsed.hostname or ""
        port = parsed.port
        if port:
            hostname = f"{hostname}:{port}"
        netloc = f"redacted-userinfo@{hostname}" if parsed.username is not None or parsed.password is not None else parsed.netloc
        query = urlencode(
            [(key, "[REDACTED]" if is_secret_key(key) else val) for key, val in parse_qsl(parsed.query, keep_blank_values=True)]
        )
        fragment_pairs = parse_qsl(parsed.fragment, keep_blank_values=True)
        if fragment_pairs:
            fragment = urlencode(
                [(key, "[REDACTED]" if is_secret_key(key) else val) for key, val in fragment_pairs]
            )
        else:
            fragment = redact_string_without_urls(parsed.fragment)
        return urlunsplit((parsed.scheme, netloc, parsed.path, query, fragment))
    except ValueError:
        return "[REDACTED_MALFORMED_URL]" if "://" in value else value


def redact_string_without_urls(value: str) -> str:
    redacted = CLI_SECRET_PATTERN.sub(lambda match: f"{match.group(1)}[REDACTED]", value)
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted


def redact_string(value: str) -> str:
    redacted = re.sub(
        r"\b(?:https?|ftp|postgres(?:ql)?|mysql|redis)://[^\s'\"<>]+",
        lambda match: redact_url(match.group(0)),
        value,
        flags=re.IGNORECASE,
    )
    return redact_string_without_urls(redacted)


def redact(value: Any, key: str = "") -> Any:
    if key and normalized_key(key) not in PUBLIC_TOKEN_KEYS and is_secret_key(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for raw_key, raw_value in value.items():
            key_text = str(raw_key)
            safe_key = redact_string(key_text)
            if safe_key != key_text:
                safe_key = f"[REDACTED_KEY:{hashlib.sha256(key_text.encode('utf-8')).hexdigest()[:12]}]"
            safe[safe_key] = redact(raw_value, key_text)
        return safe
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return [redact(item) for item in value]
    if isinstance(value, str):
        return redact_string(value)
    return value


def file_metrics(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="replace")
    return {
        "bytes": len(raw),
        "characters": len(text),
        "lines": len(text.splitlines()),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }


def safe_read_text(path: Path, errors: list[dict[str, str]]) -> str | None:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        errors.append({"path": str(path), "error": str(exc)})
        return None


def parse_toml(path: Path, errors: list[dict[str, str]]) -> dict[str, Any] | None:
    if tomllib is None:
        errors.append({"path": str(path), "error": "Python 3.11+ required for TOML parsing"})
        return None
    try:
        with path.open("rb") as handle:
            return tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        errors.append({"path": str(path), "error": str(exc)})
        return None


def parse_json(path: Path, errors: list[dict[str, str]]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append({"path": str(path), "error": str(exc)})
        return None


def parse_jsonl(path: Path, errors: list[dict[str, str]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    value = json.loads(line)
                except json.JSONDecodeError as exc:
                    errors.append({"path": f"{path}:{number}", "error": str(exc)})
                    continue
                if isinstance(value, dict):
                    rows.append(value)
                else:
                    errors.append({"path": f"{path}:{number}", "error": "JSONL row is not an object"})
    except OSError as exc:
        errors.append({"path": str(path), "error": str(exc)})
    return rows


def parse_jsonl_paths(paths: Iterable[Path], errors: list[dict[str, str]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in paths:
        rows.extend(parse_jsonl(path, errors))
    return rows


def path_chain(root: Path, target: Path) -> list[Path]:
    root = root.resolve()
    target = target.resolve()
    try:
        relative = target.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"target {target} is outside repository {root}") from exc
    chain = [root]
    current = root
    for part in relative.parts:
        current = current / part
        chain.append(current)
    return chain


def config_sources(repo: Path, target: Path, codex_home: Path, profile: str | None) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    user = codex_home / "config.toml"
    if user.is_file():
        sources.append({"path": user, "scope": "user", "project": False, "active": True})
    if profile:
        profile_path = codex_home / f"{profile}.config.toml"
        sources.append({"path": profile_path, "scope": "profile", "project": False, "active": profile_path.is_file()})
    for directory in path_chain(repo, target):
        candidate = directory / ".codex" / "config.toml"
        if candidate.is_file():
            sources.append({"path": candidate, "scope": "project", "project": True, "active": True})
    return sources


def manifest_config_sources(paths: list[Path], errors: list[dict[str, str]]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for manifest_path in paths:
        obj = parse_json(manifest_path, errors)
        layers = obj.get("layers") if isinstance(obj, dict) else None
        if not isinstance(layers, list):
            errors.append({"path": str(manifest_path), "error": "expected object with a layers array"})
            continue
        for index, layer in enumerate(layers):
            if not isinstance(layer, dict) or not isinstance(layer.get("path"), str):
                errors.append({"path": f"{manifest_path}:layers[{index}]", "error": "layer requires a path"})
                continue
            path = Path(layer["path"]).expanduser()
            sources.append(
                {
                    "path": path,
                    "scope": str(layer.get("scope", "host_supplied")),
                    "project": bool(layer.get("project", False)),
                    "active": layer.get("active") is True,
                    "manifest": str(manifest_path),
                }
            )
    return sources


def collect_configs(
    repo: Path,
    target: Path,
    codex_home: Path,
    project_trusted: str,
    profile: str | None,
    layer_manifests: list[Path],
    errors: list[dict[str, str]],
) -> tuple[dict[str, Any], list[tuple[Path, dict[str, Any], str]]]:
    items: list[dict[str, Any]] = []
    parsed: list[tuple[Path, dict[str, Any], str]] = []
    effective_project_doc_max = DEFAULT_PROJECT_DOC_MAX_BYTES
    fallback_names: list[str] = []
    effective_settings: dict[str, dict[str, Any]] = {}

    automatic = config_sources(repo, target, codex_home, profile)
    supplied = manifest_config_sources(layer_manifests, errors)
    sources = supplied if layer_manifests else automatic
    for source in sources:
        path = source["path"]
        if not path.is_file():
            items.append({"path": str(path), "scope": source["scope"], "parsed": False, "active": False})
            errors.append({"path": str(path), "error": "configured layer does not exist"})
            continue
        data = parse_toml(path, errors)
        if data is None:
            items.append({"path": str(path), "scope": source["scope"], "parsed": False})
            continue
        source_active = source.get("active", True) is True
        active_for_resolution = source_active and (not source["project"] or project_trusted == "yes")
        if active_for_resolution:
            if isinstance(data.get("project_doc_max_bytes"), int):
                effective_project_doc_max = data["project_doc_max_bytes"]
            if isinstance(data.get("project_doc_fallback_filenames"), list):
                fallback_names = [str(item) for item in data["project_doc_fallback_filenames"]]
            for key in (
                "approval_policy", "sandbox_mode", "permissions", "default_permissions",
                "sandbox_workspace_write", "tool_output_token_limit", "project_doc_max_bytes",
                "project_doc_fallback_filenames", "otel",
            ):
                if key in data:
                    value: Any = data[key]
                    effective_settings[key] = {"value": redact(value, key), "source": str(path), "scope": source["scope"]}
        mcp = data.get("mcp_servers") if isinstance(data.get("mcp_servers"), dict) else {}
        skills = data.get("skills") if isinstance(data.get("skills"), dict) else {}
        items.append(
            {
                "path": str(path),
                "scope": source["scope"],
                "parsed": True,
                "project_trust": project_trusted if source["project"] else "not_applicable",
                "used_for_effective_resolution": active_for_resolution,
                "has_inline_hooks": isinstance(data.get("hooks"), dict) and bool(data.get("hooks")),
                "mcp_server_names": sorted(str(name) for name in mcp),
                "skill_config_count": len(skills.get("config", [])) if isinstance(skills.get("config"), list) else 0,
                "permission_model_keys": sorted(
                    key for key in ("default_permissions", "permissions", "sandbox_mode", "sandbox_workspace_write", "approval_policy") if key in data
                ),
            }
        )
        if active_for_resolution:
            parsed.append((path, data, source["scope"]))
    return (
        {
            "items": items,
            "effective_project_doc_max_bytes": effective_project_doc_max,
            "effective_fallback_filenames": fallback_names,
            "effective_audit_settings": effective_settings,
            "project_trust": project_trusted,
            "trust_note": "Project config is included in effective resolution only with --project-trusted yes.",
            "layer_resolution": "host_manifest" if layer_manifests else "automatic_user_profile_trusted_project",
            "missing_layer_note": "Managed, system, session, and CLI layers are UNAVAILABLE unless supplied in precedence order with --config-layer-manifest.",
        },
        parsed,
    )


def select_instruction_file(directory: Path, fallback_names: list[str]) -> Path | None:
    for name in ["AGENTS.override.md", "AGENTS.md", *fallback_names]:
        candidate = directory / name
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    return None


def normalize_instruction(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().casefold())


def duplicate_instruction_groups(files: Iterable[tuple[Path, str]]) -> list[dict[str, Any]]:
    occurrences: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    originals: dict[str, str] = {}
    for path, text in files:
        for number, line in enumerate(text.splitlines(), 1):
            normalized = normalize_instruction(line.lstrip("-*0123456789. "))
            if len(normalized) < 18 or normalized.startswith("#"):
                continue
            originals.setdefault(normalized, line.strip())
            occurrences[normalized].append({"path": str(path), "line": number})
    groups = []
    for normalized, locations in sorted(occurrences.items()):
        unique_paths = {item["path"] for item in locations}
        if len(locations) > 1 and len(unique_paths) > 1:
            groups.append(
                {
                    "type": "exact_normalized_line",
                    "text": originals[normalized],
                    "occurrences": locations,
                    "confidence": "high",
                }
            )
    return groups


def collect_agents(
    repo: Path,
    target: Path,
    codex_home: Path,
    fallback_names: list[str],
    max_bytes: int,
    errors: list[dict[str, str]],
) -> dict[str, Any]:
    inventory_paths: set[Path] = set()
    for name in ("AGENTS.md", "AGENTS.override.md", *fallback_names):
        inventory_paths.update(repo.rglob(name))
    for name in ("AGENTS.md", "AGENTS.override.md"):
        candidate = codex_home / name
        if candidate.is_file():
            inventory_paths.add(candidate)

    selected: list[Path] = []
    global_file = select_instruction_file(codex_home, [])
    if global_file:
        selected.append(global_file)
    for directory in path_chain(repo, target):
        chosen = select_instruction_file(directory, fallback_names)
        if chosen:
            selected.append(chosen)

    effective: list[dict[str, Any]] = []
    included_texts: list[tuple[Path, str]] = []
    consumed = 0
    for path in selected:
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="replace")
        metrics = {
            "bytes": len(raw),
            "characters": len(text),
            "lines": len(text.splitlines()),
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
        remaining = max(0, max_bytes - consumed)
        included = min(metrics["bytes"], remaining)
        included_raw = raw[:included]
        included_text = included_raw.decode("utf-8", errors="replace")
        included_texts.append((path, included_text))
        effective.append(
            {
                "path": str(path),
                "scope": "global" if path.parent == codex_home else "project",
                **metrics,
                "included_bytes_under_configured_cap": included,
                "included_characters_under_configured_cap": len(included_text),
                "included_sha256": hashlib.sha256(included_raw).hexdigest(),
                "possibly_truncated": included < metrics["bytes"],
            }
        )
        consumed += included

    inventory = []
    selected_set = {Path(item["path"]) for item in effective}
    for path in sorted(inventory_paths, key=lambda item: str(item)):
        try:
            metrics = file_metrics(path)
        except OSError as exc:
            errors.append({"path": str(path), "error": str(exc)})
            continue
        inventory.append({"path": str(path), "selected_for_target": path in selected_set, **metrics})
    return {
        "effective_chain": effective,
        "inventory": inventory,
        "configured_combined_limit_bytes": max_bytes,
        "included_bytes": consumed,
        "duplicate_candidates": duplicate_instruction_groups(included_texts),
        "duplicate_scope_note": "Duplicate candidates use only byte prefixes included under the configured chain cap.",
    }


def parse_skill_frontmatter(text: str) -> tuple[str | None, str | None, str | None]:
    if not text.startswith("---"):
        return None, None, "missing YAML front matter"
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None, None, "unterminated YAML front matter"
    front = parts[1].splitlines()
    values: dict[str, str] = {}
    index = 0
    while index < len(front):
        match = re.match(r"^(name|description):\s*(.*)$", front[index])
        if not match:
            line = front[index]
            if line.strip() and not line.lstrip().startswith("#") and not line.startswith(" ") and ":" not in line:
                return None, None, f"unsupported front matter line: {front[index].strip()}"
            index += 1
            continue
        key, value = match.groups()
        if value in {">", "|", ">-", "|-"}:
            continuation: list[str] = []
            index += 1
            while index < len(front) and (front[index].startswith(" ") or not front[index].strip()):
                continuation.append(front[index].strip())
                index += 1
            value = " ".join(part for part in continuation if part)
            values[key] = value
            continue
        values[key] = value.strip().strip('"\'')
        index += 1
    if not values.get("name") or not values.get("description"):
        return values.get("name"), values.get("description"), "name and description are required"
    return values.get("name"), values.get("description"), None


def collect_skills(
    repo: Path,
    target: Path,
    user_home: Path,
    codex_home: Path,
    parsed_configs: list[tuple[Path, dict[str, Any], str]],
    extra_roots: list[tuple[Path, str]],
    errors: list[dict[str, str]],
) -> dict[str, Any]:
    roots: list[tuple[Path, str]] = []
    configured_enablement: dict[Path, bool] = {}
    user_root = user_home / ".agents" / "skills"
    roots.append((user_root, "user"))
    roots.append((codex_home / "skills", "codex_home_compatibility"))
    for directory in path_chain(repo, target):
        roots.append((directory / ".agents" / "skills", "repository"))
    roots.extend(extra_roots)
    for config_path, data, _scope in parsed_configs:
        skills = data.get("skills") if isinstance(data.get("skills"), dict) else {}
        config = skills.get("config") if isinstance(skills.get("config"), list) else []
        for item in config:
            if isinstance(item, dict) and isinstance(item.get("path"), str):
                configured_path = Path(item["path"]).expanduser()
                if not configured_path.is_absolute():
                    configured_path = config_path.parent / configured_path
                roots.append((configured_path, "configured"))
                skill_file = configured_path if configured_path.name == "SKILL.md" else configured_path / "SKILL.md"
                configured_enablement[skill_file.resolve()] = item.get("enabled") is not False

    items: list[dict[str, Any]] = []
    seen: set[Path] = set()
    for root, scope in roots:
        if root.is_file() and root.name == "SKILL.md":
            candidates = [root]
        elif root.is_dir():
            candidates = [root / "SKILL.md"] if (root / "SKILL.md").is_file() else list(root.glob("**/SKILL.md"))
        else:
            continue
        for path in sorted(candidates, key=lambda item: str(item)):
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            text = safe_read_text(path, errors)
            if text is None:
                continue
            name, description, parse_error = parse_skill_frontmatter(text)
            if parse_error:
                errors.append({"path": str(path), "error": parse_error})
            openai_yaml = path.parent / "agents" / "openai.yaml"
            implicit = True
            if openai_yaml.is_file():
                yaml_text = safe_read_text(openai_yaml, errors) or ""
                if re.search(r"allow_implicit_invocation:\s*false\b", yaml_text, re.IGNORECASE):
                    implicit = False
            raw = text.encode("utf-8")
            description = description or ""
            name = name or "UNAVAILABLE"
            discovery_proxy = len(name) + len(description) + len(str(path))
            enabled = configured_enablement.get(resolved, True)
            items.append(
                {
                    "path": str(path),
                    "root": str(root),
                    "scope": scope,
                    "name": name,
                    "description": description,
                    "description_characters": len(description),
                    "skill_body_bytes": len(raw),
                    "skill_body_characters": len(text),
                    "discovery_metadata_characters_proxy": discovery_proxy,
                    "activation": "on-demand_or_explicit" if implicit else "explicit_only",
                    "body_loading": "activation_only",
                    "frontmatter_status": "invalid" if parse_error else "valid",
                    "enabled": enabled,
                }
            )

    by_name: dict[str, list[str]] = collections.defaultdict(list)
    for item in items:
        if item["enabled"] is False:
            continue
        by_name[item["name"]].append(item["path"])
    duplicate_names = [
        {"name": name, "paths": paths, "type": "same_frontmatter_name", "confidence": "high"}
        for name, paths in sorted(by_name.items())
        if len(paths) > 1
    ]
    return {
        "items": items,
        "duplicate_name_groups": duplicate_names,
        "discovery_metadata_characters_proxy": sum(
            item["discovery_metadata_characters_proxy"] for item in items if item["enabled"] is not False
        ),
        "discovery_note": "Enabled Skill metadata only; source-size proxy, not the exact injected prompt.",
    }


def hook_handlers_from_object(source: Path, obj: Any, representation: str) -> list[dict[str, Any]]:
    hooks = obj.get("hooks") if isinstance(obj, dict) and isinstance(obj.get("hooks"), dict) else obj
    if not isinstance(hooks, dict):
        return []
    handlers: list[dict[str, Any]] = []
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            continue
        for group_index, group in enumerate(groups):
            if not isinstance(group, dict):
                continue
            matcher = group.get("matcher")
            nested = group.get("hooks") if isinstance(group.get("hooks"), list) else []
            for handler_index, handler in enumerate(nested):
                if not isinstance(handler, dict):
                    continue
                handlers.append(
                    redact(
                        {
                            "source": str(source),
                            "representation": representation,
                            "event": str(event),
                            "matcher": matcher,
                            "handler_index": f"{group_index}:{handler_index}",
                            "type": handler.get("type"),
                            "command": handler.get("command"),
                            "command_windows": handler.get("commandWindows", handler.get("command_windows")),
                            "timeout_seconds": handler.get("timeout"),
                            "async": bool(handler.get("async", False)),
                            "additional_context_limit": handler.get("additionalContextLimit", handler.get("additional_context_limit")),
                        }
                    )
                )
    return handlers


def collect_hooks(
    repo: Path,
    target: Path,
    codex_home: Path,
    parsed_configs: list[tuple[Path, dict[str, Any], str]],
    plugins: dict[str, Any],
    project_trusted: str,
    errors: list[dict[str, str]],
) -> dict[str, Any]:
    handlers: list[dict[str, Any]] = []
    inactive_sources: list[dict[str, str]] = []
    source_forms: dict[str, set[str]] = collections.defaultdict(set)
    json_candidates = [(codex_home / "hooks.json", False)] + [
        (directory / ".codex" / "hooks.json", True) for directory in path_chain(repo, target)
    ]
    for path, project_source in json_candidates:
        if not path.is_file():
            continue
        if project_source and project_trusted != "yes":
            inactive_sources.append({"path": str(path), "reason": "project trust is not yes"})
            continue
        obj = parse_json(path, errors)
        if obj is not None:
            handlers.extend(hook_handlers_from_object(path, obj, "hooks.json"))
            source_forms[str(path.parent)].add("hooks.json")
    for path, data, _scope in parsed_configs:
        if isinstance(data.get("hooks"), dict) and data["hooks"]:
            handlers.extend(hook_handlers_from_object(path, data["hooks"], "inline_toml"))
            source_forms[str(path.parent)].add("inline_toml")
    for plugin in plugins["items"]:
        if plugin.get("enabled") is not True or not isinstance(plugin.get("hooks"), list):
            continue
        for index, hook in enumerate(plugin["hooks"]):
            if not isinstance(hook, dict):
                continue
            nested = hook_handlers_from_object(Path(f"plugin:{plugin['name']}"), {"hooks": hook}, "plugin_inventory")
            if nested:
                handlers.extend(nested)
            elif hook.get("event") is not None:
                handlers.append(
                    redact(
                        {
                            "source": f"plugin:{plugin['name']}",
                            "representation": "plugin_inventory",
                            "event": hook.get("event"),
                            "matcher": hook.get("matcher"),
                            "handler_index": str(index),
                            "type": hook.get("type"),
                            "command": hook.get("command"),
                            "command_windows": hook.get("commandWindows", hook.get("command_windows")),
                            "timeout_seconds": hook.get("timeout"),
                            "async": bool(hook.get("async", False)),
                            "additional_context_limit": hook.get("additionalContextLimit", hook.get("additional_context_limit")),
                        }
                    )
                )
    coexisting_config_forms = [
        {"layer": layer, "representations": sorted(forms)}
        for layer, forms in sorted(source_forms.items())
        if len(forms) > 1
    ]
    exact: dict[tuple[Any, ...], list[str]] = collections.defaultdict(list)
    for handler in handlers:
        key = (
            handler.get("event"), handler.get("matcher"), handler.get("type"),
            handler.get("command"), handler.get("command_windows"), handler.get("timeout_seconds"),
            handler.get("async"), handler.get("additional_context_limit"),
        )
        exact[key].append(handler["source"])
    duplicate_handlers = [
        {
            "event": key[0],
            "matcher": key[1],
            "handler_type": key[2],
            "command": key[3],
            "command_windows": key[4],
            "timeout_seconds": key[5],
            "async": key[6],
            "additional_context_limit": key[7],
            "sources": sources,
            "type": "exact_handler_duplicate",
            "confidence": "high",
        }
        for key, sources in exact.items()
        if len(sources) > 1
    ]
    return {
        "handlers": handlers,
        "coexisting_config_forms": coexisting_config_forms,
        "duplicate_handlers": duplicate_handlers,
        "discovered_inactive_sources": inactive_sources,
        "execution_note": "Matching command hooks for one event are launched concurrently; do not sum durations as critical-path latency without timestamps.",
    }


def collect_mcp_config(parsed_configs: list[tuple[Path, dict[str, Any], str]]) -> list[dict[str, Any]]:
    servers: dict[str, dict[str, Any]] = {}
    for path, data, scope in parsed_configs:
        mcp = data.get("mcp_servers") if isinstance(data.get("mcp_servers"), dict) else {}
        for name, config in mcp.items():
            if not isinstance(config, dict):
                continue
            transport = "streamable_http" if "url" in config else "stdio" if "command" in config else "unknown"
            previous = servers.get(str(name))
            item = redact(
                    {
                        "source": str(path),
                        "scope": scope,
                        "name": str(name),
                        "transport": transport,
                        "enabled": config.get("enabled", True),
                        "required": config.get("required", False),
                        "command": config.get("command"),
                        "args": config.get("args"),
                        "url": config.get("url"),
                        "enabled_tools": config.get("enabled_tools"),
                        "disabled_tools": config.get("disabled_tools"),
                        "startup_timeout_sec": config.get("startup_timeout_sec"),
                        "startup_timeout_ms": config.get("startup_timeout_ms"),
                        "tool_timeout_sec": config.get("tool_timeout_sec"),
                        "shadowed_sources": ([previous["source"], *previous.get("shadowed_sources", [])] if previous else []),
                    }
                )
            servers[str(name)] = item
    return [servers[name] for name in sorted(servers)]


def nearest_rank(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return float(ordered[rank - 1])


def describe_numbers(values: list[float]) -> dict[str, float | int | None]:
    return {
        "samples": len(values),
        "mean": round(statistics.fmean(values), 3) if values else None,
        "p50": nearest_rank(values, 0.50),
        "p95": nearest_rank(values, 0.95),
        "max": max(values) if values else None,
    }


def collect_mcp_inventory(paths: list[Path], errors: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inventories: list[dict[str, Any]] = []
    names_to_servers: dict[str, list[str]] = collections.defaultdict(list)
    for path in paths:
        obj = parse_json(path, errors)
        if obj is None:
            continue
        raw_servers = obj.get("servers") if isinstance(obj, dict) else None
        if not isinstance(raw_servers, list):
            errors.append({"path": str(path), "error": "expected object with a servers array"})
            continue
        for server in raw_servers:
            if not isinstance(server, dict):
                errors.append({"path": str(path), "error": "server entry is not an object"})
                continue
            name = str(server.get("name", "unnamed"))
            if "tools" not in server:
                tools: list[Any] = []
                tools_status = "UNAVAILABLE"
            elif isinstance(server.get("tools"), list):
                tools = server["tools"]
                tools_status = "CAPTURED"
            else:
                errors.append({"path": f"{path}:{name}.tools", "error": "expected array"})
                tools = []
                tools_status = "INVALID"
            serialized = canonical_json(tools).encode("utf-8")
            descriptions = [str(tool.get("description", "")) for tool in tools if isinstance(tool, dict)]
            raw_startup = server.get("startup_samples_ms")
            if raw_startup is None:
                startup: list[float] = []
                startup_status = "UNAVAILABLE"
            elif isinstance(raw_startup, list):
                startup = [float(value) for value in raw_startup if isinstance(value, (int, float))]
                startup_status = "CAPTURED"
                if len(startup) != len(raw_startup):
                    errors.append({"path": f"{path}:{name}.startup_samples_ms", "error": "non-numeric sample ignored"})
            else:
                startup = []
                startup_status = "INVALID"
                errors.append({"path": f"{path}:{name}.startup_samples_ms", "error": "expected array or null"})
            for tool in tools:
                if isinstance(tool, dict) and isinstance(tool.get("name"), str):
                    names_to_servers[tool["name"]].append(name)
            inventories.append(
                {
                    "source": str(path),
                    "name": name,
                    "tool_count": len(tools) if tools_status == "CAPTURED" else "UNAVAILABLE",
                    "tools_status": tools_status,
                    "serialized_tools_bytes": len(serialized) if tools_status == "CAPTURED" else "UNAVAILABLE",
                    "serialized_tools_characters": len(serialized.decode("utf-8")) if tools_status == "CAPTURED" else "UNAVAILABLE",
                    "description_characters": sum(len(item) for item in descriptions),
                    "descriptions_over_2000_characters": sum(len(item) > 2000 for item in descriptions),
                    "server_instructions_characters": len(str(server.get("instructions", ""))),
                    "startup_ms": describe_numbers(startup),
                    "startup_status": startup_status,
                    "context_interpretation": "serialized source-size proxy; prompt injection unknown",
                }
            )
    overlaps = [
        {"tool_name": tool, "servers": sorted(set(servers)), "type": "exact_tool_name_overlap"}
        for tool, servers in sorted(names_to_servers.items())
        if len(set(servers)) > 1
    ]
    return inventories, overlaps


def collect_plugin_inventory(paths: list[Path], errors: list[dict[str, str]]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for path in paths:
        obj = parse_json(path, errors)
        plugins = obj.get("plugins") if isinstance(obj, dict) else None
        if not isinstance(plugins, list):
            errors.append({"path": str(path), "error": "expected object with a plugins array"})
            continue
        for plugin in plugins:
            if not isinstance(plugin, dict):
                continue
            safe = redact(plugin)
            def optional_list(field: str) -> list[Any] | None:
                if field not in safe:
                    return None
                if not isinstance(safe[field], list):
                    errors.append({"path": f"{path}:{safe.get('name', 'unnamed')}.{field}", "error": "expected array"})
                    return None
                return safe[field]

            skills = optional_list("skills")
            mcp_servers = optional_list("mcp_servers")
            hooks = optional_list("hooks")
            resources = optional_list("resources")
            skill_roots = optional_list("skill_roots")
            items.append(
                {
                    "source": str(path),
                    "name": str(safe.get("name", "unnamed")),
                    "enabled": safe.get("enabled"),
                    "description": safe.get("description"),
                    "skill_count": len(skills) if skills is not None else "UNAVAILABLE",
                    "mcp_server_count": len(mcp_servers) if mcp_servers is not None else "UNAVAILABLE",
                    "hook_count": len(hooks) if hooks is not None else "UNAVAILABLE",
                    "resource_count": len(resources) if resources is not None else "UNAVAILABLE",
                    "skills": skills if skills is not None else "UNAVAILABLE",
                    "mcp_servers": mcp_servers if mcp_servers is not None else "UNAVAILABLE",
                    "hooks": hooks if hooks is not None else "UNAVAILABLE",
                    "resources": resources if resources is not None else "UNAVAILABLE",
                    "skill_roots": skill_roots if skill_roots is not None else "UNAVAILABLE",
                    "metadata_characters_proxy": len(canonical_json(safe)),
                }
            )
    return {
        "items": items,
        "metadata_characters_proxy": sum(
            item["metadata_characters_proxy"] for item in items if item.get("enabled") is True
        ),
        "source_note": "Normalized inventory must include plugin-bundled skills, MCP servers, hooks, and resources when the host exposes them.",
    }


def plugin_skill_roots(plugins: dict[str, Any]) -> list[tuple[Path, str]]:
    roots: list[tuple[Path, str]] = []
    for plugin in plugins["items"]:
        if plugin.get("enabled") is not True:
            continue
        values = plugin.get("skill_roots")
        if isinstance(values, list):
            for value in values:
                if isinstance(value, str):
                    roots.append((Path(value).expanduser(), f"plugin:{plugin['name']}"))
        skills = plugin.get("skills")
        if isinstance(skills, list):
            for skill in skills:
                if isinstance(skill, dict) and isinstance(skill.get("path"), str):
                    path = Path(skill["path"]).expanduser()
                    roots.append((path if path.is_dir() else path.parent, f"plugin:{plugin['name']}"))
    return roots


def collect_hook_trace(paths: list[Path], errors: list[dict[str, str]]) -> dict[str, Any]:
    rows = parse_jsonl_paths(paths, errors)
    by_hook_values: dict[str, list[float]] = collections.defaultdict(list)
    by_hook_failures: dict[str, int] = collections.defaultdict(int)
    by_hook_runs: dict[str, int] = collections.defaultdict(int)
    total = 0.0
    for row in rows:
        if row.get("hook_id") is not None:
            hook_id = redact_string(str(row["hook_id"]))
        elif row.get("command") is not None:
            digest = hashlib.sha256(str(row["command"]).encode("utf-8")).hexdigest()[:16]
            hook_id = f"command_sha256:{digest}"
        else:
            hook_id = "unknown"
        by_hook_runs[hook_id] += 1
        duration = row.get("duration_ms")
        if isinstance(duration, (int, float)):
            by_hook_values[hook_id].append(float(duration))
            total += float(duration)
        if row.get("timed_out") is True or row.get("exit_status") not in (None, 0):
            by_hook_failures[hook_id] += 1
    by_hook: dict[str, Any] = {}
    for hook_id in sorted(by_hook_runs):
        values = by_hook_values.get(hook_id, [])
        stats = describe_numbers(values)
        samples = by_hook_runs[hook_id]
        by_hook[hook_id] = {
            "runs": samples,
            "duration_samples": len(values),
            "mean_ms": stats["mean"],
            "p50_ms": stats["p50"],
            "p95_ms": stats["p95"],
            "max_ms": stats["max"],
            "failures": by_hook_failures.get(hook_id, 0),
            "failure_rate": round(by_hook_failures.get(hook_id, 0) / samples, 4) if samples else None,
        }

    critical_path: float | None = None
    invocation_stats: dict[str, Any] = {"samples": 0, "mean": None, "p50": None, "p95": None, "max": None}
    critical_note = "Critical-path wall time cannot be derived without invocation grouping and start/end timestamps."
    timestamped = [
        row
        for row in rows
        if row.get("invocation_id") is not None
        and isinstance(row.get("started_at_ms"), (int, float))
        and isinstance(row.get("ended_at_ms"), (int, float))
    ]
    timestamps_valid = all(float(row["ended_at_ms"]) >= float(row["started_at_ms"]) for row in timestamped)
    if timestamped and len(timestamped) == len(rows) and timestamps_valid:
        groups: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
        for row in timestamped:
            groups[str(row["invocation_id"])].append(row)
        spans = [
            (min(float(row["started_at_ms"]) for row in group), max(float(row["ended_at_ms"]) for row in group))
            for group in groups.values()
        ]
        invocation_stats = describe_numbers([end - start for start, end in spans])
        merged: list[list[float]] = []
        for start, end in sorted(spans):
            if not merged or start > merged[-1][1]:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        critical_path = round(sum(end - start for start, end in merged), 3)
        critical_note = "Union of invocation wall-clock intervals; per-invocation statistics are reported separately."
    elif timestamped and not timestamps_valid:
        errors.append({"path": "hook-trace", "error": "ended_at_ms precedes started_at_ms"})
    return {
        "samples": len(rows),
        "by_hook": by_hook,
        "observed_work_sum_ms": round(total, 3),
        "observed_critical_path_ms": critical_path,
        "per_invocation_critical_path_ms": invocation_stats,
        "critical_path_note": critical_note,
    }


def permission_classification(row: dict[str, Any]) -> str:
    outcome = str(row.get("outcome", "")).casefold()
    actor = str(row.get("actor", "")).casefold()
    if outcome not in {"denied", "rejected", "blocked"}:
        return "not a denial"
    if actor == "user":
        return "user refusal"
    if actor == "policy":
        return "policy-enforced denial"
    if actor == "sandbox":
        return "sandbox-enforced denial"
    if actor == "config":
        return "configuration-enforced denial"
    return "insufficient data"


def collect_permission_trace(paths: list[Path], errors: list[dict[str, str]]) -> dict[str, Any]:
    rows = parse_jsonl_paths(paths, errors)
    safe_rows = [redact(row) for row in rows]
    grouped: dict[str, dict[str, Any]] = {}
    for row in safe_rows:
        command = row.get("command")
        normalized_command = re.sub(r"\s+", " ", command.strip()) if isinstance(command, str) else command
        signature_payload = {
            "tool": str(row.get("tool", "UNAVAILABLE")).casefold(),
            "command": normalized_command,
            "permission": str(row.get("permission", "UNAVAILABLE")).casefold(),
            "scope": str(row.get("scope", "UNAVAILABLE")),
            "outcome": str(row.get("outcome", "UNAVAILABLE")).casefold(),
        }
        signature = hashlib.sha256(canonical_json(signature_payload).encode("utf-8")).hexdigest()[:16]
        if signature not in grouped:
            grouped[signature] = {
                "signature": signature,
                **signature_payload,
                "classification": permission_classification(row),
                "count": 0,
                "actors": {},
                "actor": str(row.get("actor", "UNAVAILABLE")),
                "reasons": [],
                "necessity": "INSUFFICIENT_EVIDENCE",
            }
        grouped[signature]["count"] += 1
        actor = str(row.get("actor", "UNAVAILABLE"))
        grouped[signature]["actors"][actor] = grouped[signature]["actors"].get(actor, 0) + 1
        if actor != grouped[signature]["actor"]:
            grouped[signature]["actor"] = "MIXED"
            grouped[signature]["classification"] = "insufficient data"
        reason = row.get("reason")
        if isinstance(reason, str) and reason not in grouped[signature]["reasons"] and len(grouped[signature]["reasons"]) < 5:
            grouped[signature]["reasons"].append(reason)
    return {
        "samples": len(rows),
        "groups": sorted(grouped.values(), key=lambda item: (-item["count"], item["signature"])),
        "classification_note": "Classification uses the actor/outcome reported by the supplied trace; necessity and remediation require task context.",
    }


def parse_timestamp(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return dt.datetime.fromisoformat(normalized).timestamp() * 1000
    except ValueError:
        return None


def collect_codex_trace(paths: list[Path], errors: list[dict[str, str]]) -> dict[str, Any]:
    rows = parse_jsonl_paths(paths, errors)
    event_counts = collections.Counter(str(row.get("type", "unknown")) for row in rows)
    item_counts: collections.Counter[str] = collections.Counter()
    tool_counts: collections.Counter[str] = collections.Counter()
    usage = collections.Counter()
    failures = 0
    turn_start: float | None = None
    first_action: float | None = None
    for row in rows:
        row_type = str(row.get("type", ""))
        if row_type in {"turn.failed", "error"}:
            failures += 1
        if row_type == "turn.started" and turn_start is None:
            turn_start = parse_timestamp(row.get("timestamp", row.get("time", row.get("ts"))))
        item = row.get("item") if isinstance(row.get("item"), dict) else None
        if item:
            item_type = str(item.get("type", "unknown"))
            item_counts[item_type] += 1
            if item.get("status") in {"failed", "error"}:
                failures += 1
            name = item.get("name", item.get("tool_name", item.get("tool")))
            if name and ("tool" in item_type or "mcp" in item_type):
                tool_counts[str(name)] += 1
            if first_action is None and item_type in {"command_execution", "file_change", "mcp_tool_call", "web_search"}:
                first_action = parse_timestamp(row.get("timestamp", row.get("time", row.get("ts"))))
        row_usage = row.get("usage") if isinstance(row.get("usage"), dict) else {}
        for key, value in row_usage.items():
            if isinstance(value, (int, float)):
                usage[str(key)] += value
    ttfa = None
    if turn_start is not None and first_action is not None:
        ttfa = round(first_action - turn_start, 3)
    return {
        "events": len(rows),
        "event_types": dict(sorted(event_counts.items())),
        "item_types": dict(sorted(item_counts.items())),
        "tool_calls_by_name": dict(sorted(tool_counts.items())),
        "reported_usage": dict(sorted(usage.items())),
        "failure_events": failures,
        "time_to_first_useful_action_ms": ttfa,
        "ttfa_note": "Requires timestamps in supplied JSONL; standard examples do not guarantee them." if ttfa is None else "Derived from supplied timestamps.",
    }


def collect_metric_trace(paths: list[Path], errors: list[dict[str, str]]) -> dict[str, Any]:
    """Summarize a normalized export of documented Codex OTel metrics.

    Each JSONL row must contain `name`, numeric `value`, and optional
    `attributes`. Raw OTLP envelopes vary by collector/backend and must be
    normalized by a local query/export step before ingestion.
    """
    rows = parse_jsonl_paths(paths, errors)
    groups: dict[tuple[str, str], list[float]] = collections.defaultdict(list)
    attributes_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    accepted = 0
    for row in rows:
        name = row.get("name")
        value = row.get("value")
        attributes = row.get("attributes", {})
        if not isinstance(name, str) or not isinstance(value, (int, float)) or not isinstance(attributes, dict):
            errors.append({"path": "metric-trace", "error": "metric row requires name, numeric value, and object attributes"})
            continue
        safe_attributes = redact(attributes)
        key = (name.removeprefix("codex."), canonical_json(safe_attributes))
        groups[key].append(float(value))
        attributes_by_key[key] = safe_attributes
        accepted += 1

    summarized: list[dict[str, Any]] = []
    for (name, _attribute_key), values in sorted(groups.items()):
        stats = describe_numbers(values)
        summarized.append(
            {
                "name": name,
                "attributes": attributes_by_key[(name, _attribute_key)],
                "count": round(sum(values), 3) if not name.endswith("duration_ms") and name not in {"turn.token_usage"} else len(values),
                "samples": len(values),
                "sum": round(sum(values), 3),
                "mean": stats["mean"],
                "p50": stats["p50"],
                "p95": stats["p95"],
                "max": stats["max"],
            }
        )
    return {
        "source_contract": "normalized OTel metric observations supplied by the user",
        "rows": accepted,
        "hooks": [item for item in summarized if item["name"].startswith("hooks.")],
        "mcp": [item for item in summarized if item["name"].startswith("mcp.")],
        "approvals": [item for item in summarized if item["name"] == "approval.requested"],
        "skills": [item for item in summarized if item["name"] in {"skill.injected", "thread.skills.enabled_total", "thread.skills.kept_total", "thread.skills.truncated"}],
        "turns_and_tools": [item for item in summarized if item["name"].startswith("turn.") or item["name"].startswith("tool.")],
        "normalization_note": "Raw OTLP wire envelopes are intentionally not assumed; export observations or backend query rows into the documented companion shape.",
    }


def estimate_token_range(characters: int) -> dict[str, Any]:
    # Wide range by design: mixed prose, code, identifiers, and non-Latin text vary greatly.
    return {
        "lower": math.ceil(characters / 5.0),
        "upper": math.ceil(characters / 1.8),
        "method": "generic character-ratio range (1.8-5.0 chars/token), not model-specific",
        "confidence": "low",
    }


def build_context(
    agents: dict[str, Any],
    skills: dict[str, Any],
    plugins: dict[str, Any],
    inventories: list[dict[str, Any]],
    estimate_tokens: bool,
    context_window: int | None,
) -> dict[str, Any]:
    agents_chars = sum(item["included_characters_under_configured_cap"] for item in agents["effective_chain"])
    skill_metadata = skills["discovery_metadata_characters_proxy"]
    enabled_skill_source_chars = sum(
        item["skill_body_characters"] for item in skills["items"] if item.get("enabled") is not False
    )
    tool_schema_chars = sum(
        item["serialized_tools_characters"] for item in inventories if isinstance(item.get("serialized_tools_characters"), int)
    )
    mcp_instruction_chars = sum(item["server_instructions_characters"] for item in inventories)
    plugin_metadata_chars = plugins["metadata_characters_proxy"]
    components = [
        {"component": "AGENTS effective chain", "characters": agents_chars, "timing": "session/startup instruction chain", "measurement": "source characters"},
        {"component": "Skill discovery metadata", "characters": skill_metadata, "timing": "discovery", "measurement": "source-size proxy"},
        {
            "component": "Activated Skill instructions",
            "characters": "UNAVAILABLE",
            "discovered_enabled_source_characters_proxy": enabled_skill_source_chars,
            "timing": "activation only",
            "measurement": "requires activation evidence; discovered bodies are not summed as runtime context",
        },
        {"component": "Plugin inventory metadata", "characters": plugin_metadata_chars, "timing": "host/plugin discovery", "measurement": "normalized inventory source-size proxy"},
        {"component": "MCP server instructions", "characters": mcp_instruction_chars, "timing": "server initialization/discovery", "measurement": "source characters; host injection policy may vary"},
        {"component": "MCP tool schemas", "characters": tool_schema_chars, "timing": "host-dependent discovery", "measurement": "serialized source-size proxy"},
    ]
    for component in components:
        if estimate_tokens and isinstance(component["characters"], int):
            component["estimated_tokens"] = estimate_token_range(component["characters"])
            if context_window:
                estimate = component["estimated_tokens"]
                component["estimated_context_window_percent_range"] = [
                    round(100 * estimate["lower"] / context_window, 4),
                    round(100 * estimate["upper"] / context_window, 4),
                ]
    return {
        "components": components,
        "token_measurement": "estimated_range" if estimate_tokens else "unavailable",
        "token_note": "Use emitted Codex usage or a compatible tokenizer for measured counts. Static component sizes are not additive proof of the actual prompt.",
        "context_window_tokens": context_window,
    }


def render_markdown(result: dict[str, Any]) -> str:
    inventory_tool_count = sum(
        item["tool_count"] for item in result["mcp"]["inventories"] if isinstance(item.get("tool_count"), int)
    )
    lines = [
        "# Codex harness evidence brief",
        "",
        f"Mode: `{result['mode']}`",
        f"Repository: `{result['scan']['repo']}`",
        "",
        "## Static inventory",
        "",
        f"- Applicable AGENTS files: {len(result['agents']['effective_chain'])}",
        f"- Discovered Skills: {len(result['skills']['items'])}",
        f"- Configured hook handlers: {len(result['hooks']['handlers'])}",
        f"- Configured MCP entries: {len(result['mcp']['configured_servers'])}",
        f"- MCP inventory tools with captured lists: {inventory_tool_count}",
        "",
        "## Context evidence",
        "",
        "| Component | Characters | Timing | Measurement |",
        "| --- | ---: | --- | --- |",
    ]
    for component in result["context"]["components"]:
        lines.append(
            f"| {component['component']} | {component['characters']} | {component['timing']} | {component['measurement']} |"
        )
    lines.extend(["", "## Missing evidence / cautions", ""])
    for limitation in result["limitations"]:
        lines.append(f"- {limitation}")
    if result["errors"]:
        lines.extend(["", "## Collection errors", ""])
        for error in result["errors"]:
            lines.append(f"- `{error['path']}`: {error['error']}")
    lines.extend(
        [
            "",
            "## Complete machine-readable evidence",
            "",
            "The JSON below is the same redacted evidence object emitted by `--format json`.",
            "",
            "```json",
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True),
            "```",
        ]
    )
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("quick", "deep"))
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Repository/project root to inspect")
    parser.add_argument("--target", type=Path, help="Working directory whose applicable instruction/config chain is audited")
    parser.add_argument("--user-home", type=Path, default=Path.home(), help="User home used for ~/.agents skill discovery")
    parser.add_argument("--codex-home", type=Path, help="Codex home; defaults to CODEX_HOME or ~/.codex")
    parser.add_argument("--project-trusted", choices=("yes", "no", "unknown"), default="unknown")
    parser.add_argument("--profile", help="Selected Codex profile name; loads <CODEX_HOME>/<name>.config.toml")
    parser.add_argument(
        "--config-layer-manifest", action="append", type=Path, default=[],
        help="Normalized JSON layer manifest in low-to-high precedence order; replaces automatic config discovery",
    )
    parser.add_argument(
        "--skill-root", action="append", default=[], metavar="SCOPE=PATH",
        help="Host-supplied additional Skill root, repeatable",
    )
    parser.add_argument("--codex-trace", action="append", type=Path, default=[], help="Codex exec --json JSONL trace")
    parser.add_argument("--hook-trace", action="append", type=Path, default=[], help="Hook timing JSONL using the documented companion schema")
    parser.add_argument("--permission-trace", action="append", type=Path, default=[], help="Permission decision JSONL using the companion schema")
    parser.add_argument("--metric-trace", action="append", type=Path, default=[], help="Normalized Codex OTel metric observations as JSONL")
    parser.add_argument("--mcp-inventory", action="append", type=Path, default=[], help="MCP inventory JSON using the companion schema")
    parser.add_argument("--plugin-inventory", action="append", type=Path, default=[], help="Normalized plugin inventory JSON using the companion schema")
    parser.add_argument("--estimate-tokens", action="store_true", help="Add a deliberately wide, non-model-specific token range")
    parser.add_argument("--context-window", type=int, help="Optional context-window size used only for estimate percentages")
    parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    return parser


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(errors="backslashreplace")

    args = build_parser().parse_args(argv)
    repo = args.repo.resolve()
    target = (args.target or repo).resolve()
    user_home = args.user_home.expanduser().resolve()
    codex_home = (args.codex_home or Path(os.environ.get("CODEX_HOME", user_home / ".codex"))).expanduser().resolve()
    if not repo.is_dir():
        print(f"error: repository is not a directory: {repo}", file=sys.stderr)
        return 2
    try:
        path_chain(repo, target)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.mode == "quick" and any((args.codex_trace, args.hook_trace, args.permission_trace, args.metric_trace)):
        print("error: runtime traces require deep mode; static MCP/plugin inventories are allowed", file=sys.stderr)
        return 2

    extra_skill_roots: list[tuple[Path, str]] = []
    for value in args.skill_root:
        if "=" not in value:
            print(f"error: --skill-root must be SCOPE=PATH: {value}", file=sys.stderr)
            return 2
        scope, raw_path = value.split("=", 1)
        if not scope or not raw_path:
            print(f"error: --skill-root must be SCOPE=PATH: {value}", file=sys.stderr)
            return 2
        extra_skill_roots.append((Path(raw_path).expanduser(), scope))

    errors: list[dict[str, str]] = []
    configs, parsed_configs = collect_configs(
        repo, target, codex_home, args.project_trusted, args.profile, args.config_layer_manifest, errors
    )
    agents = collect_agents(
        repo,
        target,
        codex_home,
        configs["effective_fallback_filenames"],
        configs["effective_project_doc_max_bytes"],
        errors,
    )
    mcp_inventories, mcp_overlaps = collect_mcp_inventory(args.mcp_inventory, errors)
    plugins = collect_plugin_inventory(args.plugin_inventory, errors)
    extra_skill_roots.extend(plugin_skill_roots(plugins))
    skills = collect_skills(repo, target, user_home, codex_home, parsed_configs, extra_skill_roots, errors)
    hooks = collect_hooks(repo, target, codex_home, parsed_configs, plugins, args.project_trusted, errors)
    runtime_hooks = collect_hook_trace(args.hook_trace, errors)
    runtime_permissions = collect_permission_trace(args.permission_trace, errors)
    runtime_codex = collect_codex_trace(args.codex_trace, errors)
    runtime_metrics = collect_metric_trace(args.metric_trace, errors)
    result = {
        "schema_version": SCHEMA_VERSION,
        "mode": args.mode,
        "scan": {
            "repo": str(repo),
            "target": str(target),
            "user_home": str(user_home),
            "codex_home": str(codex_home),
            "mutation_policy": "read-only; stdout only",
        },
        "config": configs,
        "agents": agents,
        "skills": skills,
        "plugins": plugins,
        "hooks": hooks,
        "mcp": {
            "configured_servers": collect_mcp_config(parsed_configs),
            "inventories": mcp_inventories,
            "exact_tool_name_overlaps": mcp_overlaps,
        },
        "runtime": {
            "codex": runtime_codex,
            "hooks": runtime_hooks,
            "permissions": runtime_permissions,
            "metrics": runtime_metrics,
        },
        "context": build_context(agents, skills, plugins, mcp_inventories, args.estimate_tokens, args.context_window),
        "limitations": [
            "No exact full prompt or context composition is assumed from static file sizes.",
            "Skill/plugin usage history is unavailable unless supplied through representative traces or an explicit inventory.",
            "MCP servers are not started; live capabilities, connection errors, and schemas require supplied inventory or traces.",
            "Hook critical-path latency requires invocation grouping plus start/end timestamps because matching handlers may run concurrently.",
            "Permission necessity cannot be inferred from denial records without the task goal and attempted workflow.",
            "Semantic duplicates are review candidates; this collector only emits deterministic exact-name/line overlaps.",
            "Managed/system/session configuration and CLI overrides are unavailable unless the host supplies a normalized active-layer manifest.",
        ],
        "errors": errors,
    }
    safe_result = redact(result)
    if args.format == "json":
        print(json.dumps(safe_result, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(render_markdown(safe_result), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
