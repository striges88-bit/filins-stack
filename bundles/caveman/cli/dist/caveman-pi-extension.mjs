// src/provider-routing.ts
var COMPAT_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
function endpoint(raw) {
  if (!raw || /[\s?#]/.test(raw)) return void 0;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname.includes("//")) return void 0;
    if (/%|\\/.test(raw) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)) return void 0;
    return url;
  } catch {
    return void 0;
  }
}
function publishedUpstreamsOf(raw) {
  const out = /* @__PURE__ */ Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, value] of Object.entries(raw)) {
    if (!COMPAT_NAME_RE.test(name)) continue;
    out[name] = typeof value === "string" && endpoint(value) ? value : "";
  }
  return out;
}
function trimTrailingSlashes(s) {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47) end--;
  return s.slice(0, end);
}
function append(base, path) {
  return base.origin + base.pathname.replace(/\/+$/, "") + path;
}
function compatTarget(base, path) {
  const leftPath = base.pathname.replace(/^\/+|\/+$/g, "");
  const rightPath = path.replace(/^\/+|\/+$/g, "");
  const left = leftPath ? leftPath.split("/") : [];
  const right = rightPath ? rightPath.split("/") : [];
  let overlap = Math.min(left.length, right.length);
  while (overlap > 0 && left.slice(-overlap).join("/") !== right.slice(0, overlap).join("/")) overlap--;
  return base.origin + "/" + [...left, ...right.slice(overlap)].join("/");
}
function verifiedProviderRoute(gateway, api, provider, originalBaseUrl, published) {
  const original = endpoint(originalBaseUrl);
  if (!original || !endpoint(gateway)) return void 0;
  const family = api === "anthropic-messages" ? "anthropic" : api === "openai-completions" || api === "openai-responses" ? "openai" : api === "google-generative-ai" ? "gemini" : void 0;
  if (!family) return void 0;
  const operation = api === "anthropic-messages" ? "/v1/messages" : api === "openai-completions" ? "/chat/completions" : api === "openai-responses" ? "/responses" : "/models/caveman-route-proof:streamGenerateContent";
  const expected = append(original, operation);
  const mount = COMPAT_NAME_RE.test(provider) && published?.compat_upstreams && Object.hasOwn(published.compat_upstreams, provider) ? published.compat_upstreams[provider] : void 0;
  if (mount !== void 0) {
    const upstream2 = endpoint(mount);
    if (!upstream2 || family === "gemini") return void 0;
    const suffix = family === "openai" ? "/v1" : "";
    if (compatTarget(upstream2, suffix + operation) !== expected) return void 0;
    return trimTrailingSlashes(gateway) + `/compat/${provider}${suffix}`;
  }
  const upstream = endpoint(published?.provider_upstreams?.[family]);
  if (!upstream) return void 0;
  const versions = family === "gemini" ? ["/v1beta", "/v1"] : [family === "openai" ? "/v1" : ""];
  for (const version of versions) {
    if (append(upstream, version + operation) === expected) {
      return trimTrailingSlashes(gateway) + `/${family}${version}`;
    }
  }
  return void 0;
}
var COPIED_HEADERS = ["content-type", "content-encoding", "accept", "accept-encoding", "idempotency-key", "openai-organization", "openai-project", "session_id", "x-session-id", "x-client-request-id", "x-session-affinity", "anthropic-version", "anthropic-beta", "api-version", "user-agent"];
var COMPAT_HEADERS = {
  openrouter: ["http-referer", "x-openrouter-title", "x-openrouter-categories"],
  nvidia: ["x-billing-invoke-origin"],
  opencode: ["x-opencode-session", "x-opencode-client", "x-opencode-project", "x-opencode-request"],
  "opencode-go": ["x-opencode-session", "x-opencode-client", "x-opencode-project", "x-opencode-request"]
};
function publishedForwardHeadersOf(raw) {
  const out = /* @__PURE__ */ Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, values] of Object.entries(raw)) {
    if (COMPAT_NAME_RE.test(name) && Array.isArray(values)) out[name] = values.filter((v) => typeof v === "string").map((v) => v.toLowerCase());
  }
  return out;
}
function unforwardedProviderHeaders(api, provider, headers, published) {
  if (headers == null) return [];
  if (typeof headers !== "object" || Array.isArray(headers)) return ["invalid header configuration"];
  const allowed = new Set(COPIED_HEADERS);
  if (api === "openai-completions" || api === "openai-responses") allowed.add("authorization");
  if (api === "anthropic-messages") {
    allowed.add("authorization");
    allowed.add("x-api-key");
  }
  if (api === "google-generative-ai") {
    allowed.add("authorization");
    allowed.add("x-goog-api-key");
    allowed.add("x-goog-user-project");
  }
  if (published?.compat_upstreams && Object.hasOwn(published.compat_upstreams, provider)) {
    for (const name of published.compat_forward_headers?.[provider] ?? []) allowed.add(name.toLowerCase());
    if (Object.hasOwn(COMPAT_HEADERS, provider)) for (const name of COMPAT_HEADERS[provider]) allowed.add(name);
  }
  return Object.entries(headers).filter(([name, value]) => {
    if (value === void 0) return false;
    const lower = name.toLowerCase();
    if (lower === "authorization") return typeof value !== "string" || !/^Bearer +\S+$/i.test(value.trim());
    if (["x-api-key", "x-goog-api-key"].includes(lower) && (typeof value !== "string" || !value.trim())) return true;
    return value !== null && !allowed.has(lower);
  }).map(([name]) => name).sort();
}

// ../pi-extension/src/index.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join4 } from "node:path";
import { Type } from "typebox";

// ../pi-extension/src/lifecycle.ts
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join as join2 } from "node:path";

// ../pi-extension/src/portable-command.ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
function parseWindowsNodeShim(source) {
  for (const line of source.split(/\r?\n/)) {
    if (!/(?:\bnode(?:\.exe)?\b|_prog)/i.test(line) || !/%\*/.test(line)) continue;
    const match = line.match(/"%(?:dp0%|~dp0)\\([^"\r\n]+\.(?:cjs|mjs|js))"\s+%\*/i) ?? line.match(/"([A-Za-z]:[\\/][^"\r\n]+\.(?:cjs|mjs|js))"\s+%\*/i);
    if (match) return match[1];
  }
  return null;
}
function envValue(env, name) {
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === void 0 ? void 0 : env[key];
}
function resolveWindowsCommand(command, env) {
  const pathExt = envValue(env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
  const names = extname(command) ? [command] : pathExt.split(";").map((extension) => `${command}${extension.startsWith(".") ? extension : `.${extension}`}`);
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    for (const name of names) if (existsSync(name)) return name;
    return existsSync(command) ? command : void 0;
  }
  for (const directory of (envValue(env, "PATH") ?? "").split(";")) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return void 0;
}
function portableInvocation(command, args, platform = process.platform, env = process.env) {
  if (platform !== "win32") return { command, args: [...args] };
  const executable = resolveWindowsCommand(command, env) ?? command;
  if (!/\.(?:cmd|bat)$/i.test(executable)) return { command: executable, args: [...args] };
  const stat = statSync(executable);
  if (!stat.isFile() || stat.size > 256 * 1024) {
    throw new Error(`cannot safely launch Windows command shim: ${executable}`);
  }
  const shimScript = parseWindowsNodeShim(readFileSync(executable, "utf8"));
  if (!shimScript) {
    throw new Error(`cannot safely launch non-Node Windows command shim: ${executable}; install a native .exe`);
  }
  const script = /^[A-Za-z]:[\\/]/.test(shimScript) ? shimScript : resolve(dirname(executable), ...shimScript.split(/[\\/]+/));
  if (!statSync(script).isFile()) {
    throw new Error(`Windows command shim target is missing: ${script}`);
  }
  return { command: process.execPath, args: [script, ...args] };
}

// ../pi-extension/src/protocol.ts
var MAX_CONTEXT_BYTES = 64 * 1024;
var MAX_MESSAGE_BYTES = 4 * 1024;
var MAX_OUTPUT_REPLACEMENT_BYTES = 2 * 1024 * 1024;
var MAX_RECOVERY_REF_BYTES = 1024;
var MAX_DECISION_ID_BYTES = 256;
var MAX_TOOL_OUTPUT_BYTES = 2 * 1024 * 1024;
function fits(value, max) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= max;
}
function sanitizeHookResponse(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw;
  const out = {};
  if (fits(value.context, MAX_CONTEXT_BYTES)) out.context = value.context;
  if (fits(value.message, MAX_MESSAGE_BYTES)) out.message = value.message;
  if (fits(value.output_replacement, MAX_OUTPUT_REPLACEMENT_BYTES)) out.output_replacement = value.output_replacement;
  if (fits(value.recovery_ref, MAX_RECOVERY_REF_BYTES)) out.recovery_ref = value.recovery_ref;
  if (fits(value.decision_id, MAX_DECISION_ID_BYTES)) out.decision_id = value.decision_id;
  if (typeof value.action === "string") out.action = value.action;
  const hso = value.hookSpecificOutput;
  if (hso && typeof hso === "object" && !Array.isArray(hso)) {
    const nested = hso;
    const cleaned = {};
    if (typeof nested.hookEventName === "string") cleaned.hookEventName = nested.hookEventName;
    if (fits(nested.additionalContext, MAX_CONTEXT_BYTES)) cleaned.additionalContext = nested.additionalContext;
    if (fits(nested.updatedToolOutput, MAX_OUTPUT_REPLACEMENT_BYTES)) cleaned.updatedToolOutput = nested.updatedToolOutput;
    out.hookSpecificOutput = cleaned;
  }
  return out;
}
function additionalContextOf(response) {
  const context = response?.hookSpecificOutput?.additionalContext ?? response?.context;
  return context ? context : void 0;
}
function outputReplacementOf(response) {
  const replacement = response?.hookSpecificOutput?.updatedToolOutput ?? response?.output_replacement;
  return replacement ? replacement : void 0;
}
function normalizeRecoveryHandle(value) {
  if (!fits(value, MAX_RECOVERY_REF_BYTES)) return void 0;
  let handle = value.trim();
  if (handle.startsWith("<<") && handle.endsWith(">>")) handle = handle.slice(2, -2).trim();
  if (handle.startsWith("ccr://")) handle = handle.slice(6).trim().replace(/^\/+|\/+$/g, "");
  else if (handle.startsWith("ccr:")) handle = handle.slice(4).trim();
  return /^ccr_[A-Za-z0-9_-]+$/.test(handle) ? handle : void 0;
}
var ROUTES_BY_API = {
  "anthropic-messages": "/w/pi",
  "openai-completions": "/w/pi/openai/v1",
  "openai-responses": "/w/pi/openai/v1",
  "google-generative-ai": "/w/pi/v1beta"
};
var ROUTES_BY_PROVIDER_API = {
  "opencode-go": {
    "anthropic-messages": "/w/pi/compat/opencode-go",
    "openai-completions": "/w/pi/compat/opencode-go/v1",
    "openai-responses": "/w/pi/compat/opencode-go/v1"
  }
};
var UPSTREAM_HOSTS_BY_PROVIDER = {
  anthropic: "api.anthropic.com",
  openai: "api.openai.com",
  google: "generativelanguage.googleapis.com",
  "opencode-go": "opencode.ai"
};
function upstreamHostFor(provider) {
  return provider ? UPSTREAM_HOSTS_BY_PROVIDER[provider] : void 0;
}
function hostOf(url) {
  if (!url) return void 0;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return void 0;
  }
}
var COMPAT_NAME_RE2 = /^[a-z0-9][a-z0-9._-]{0,63}$/;
function compatUpstreamFor(provider, compatUpstreams) {
  if (!compatUpstreams || !COMPAT_NAME_RE2.test(provider)) return void 0;
  const url = compatUpstreams[provider];
  return typeof url === "string" ? url : void 0;
}
function routeForApi(gateway, api, provider, originalBaseUrl, compatUpstreams, providerUpstreams) {
  if (originalBaseUrl !== void 0) {
    return verifiedProviderRoute(
      joinUrl(gateway, "/w/pi"),
      api,
      provider ?? "",
      originalBaseUrl,
      { compat_upstreams: compatUpstreams, provider_upstreams: providerUpstreams }
    );
  }
  const table = (provider ? ROUTES_BY_PROVIDER_API[provider] : void 0) ?? ROUTES_BY_API;
  if (provider && !UPSTREAM_HOSTS_BY_PROVIDER[provider]) return void 0;
  const path = api ? table[api] : void 0;
  return path ? joinUrl(gateway, path) : void 0;
}
function joinUrl(base, path) {
  return `${base.replace(/\/+$/, "")}${path}`;
}
function isLoopbackUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "::1" || host === "[::1]" || host === "localhost";
  } catch {
    return false;
  }
}
function boundedString(value, max) {
  if (Buffer.byteLength(value, "utf8") <= max) return value;
  return Buffer.from(value, "utf8").subarray(0, max).toString("utf8").replace(/�+$/, "");
}

// ../pi-extension/src/lifecycle.ts
var HOOK_TIMEOUT_MS = 2e3;
var SESSION_START_TIMEOUT_MS = 6e3;
var HOOK_MAX_BUFFER = 2 * 1024 * 1024;
function resolveHookInvocations(env = process.env) {
  const localBin = join2(env.CAVEMAN_HOME || join2(homedir(), ".caveman"), "bin", "caveman");
  const candidates = [
    { command: "caveman", args: [] },
    { command: "cave", args: [] },
    { command: localBin, args: [] }
  ];
  const stamped = env.CAVEMAN_PI_HOOK_CMD;
  if (stamped) {
    try {
      const parsed = JSON.parse(stamped);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((part) => typeof part === "string" && part.length > 0)) {
        candidates.unshift({ command: parsed[0], args: parsed.slice(1) });
      }
    } catch {
    }
  }
  return candidates;
}
var TRY_NEXT = "__caveman_try_next__";
var HookBridge = class {
  invocations;
  constructor(invocations = resolveHookInvocations()) {
    this.invocations = invocations;
  }
  // call runs one native-hook event. Fail-open by contract: any spawn error,
  // timeout, or unparseable output resolves to undefined.
  async call(event, payload) {
    const input = JSON.stringify({ event_name: event, surface: "cli", ...payload });
    for (const invocation of this.invocations) {
      const raw = await this.invoke(invocation, event, input);
      if (raw === TRY_NEXT) continue;
      if (raw === void 0 || !raw.trim()) return void 0;
      try {
        return sanitizeHookResponse(JSON.parse(raw));
      } catch {
        return void 0;
      }
    }
    return void 0;
  }
  invoke(invocation, event, input) {
    return new Promise((resolve2) => {
      let portable;
      try {
        portable = portableInvocation(invocation.command, [...invocation.args, "native-hook", "pi", event]);
      } catch {
        resolve2(TRY_NEXT);
        return;
      }
      const child = execFile(
        portable.command,
        portable.args,
        { timeout: event === "SessionStart" ? SESSION_START_TIMEOUT_MS : HOOK_TIMEOUT_MS, maxBuffer: HOOK_MAX_BUFFER, encoding: "utf8" },
        (error, stdout) => {
          const timedOut = !!error && error.killed === true;
          if (error && stdout === "") return resolve2(timedOut ? void 0 : TRY_NEXT);
          resolve2(stdout);
        }
      );
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(input);
    });
  }
};
function promptDigest(prompt) {
  return {
    bytes: Buffer.byteLength(prompt, "utf8"),
    sha256: `sha256:${createHash("sha256").update(prompt, "utf8").digest("hex")}`
  };
}
function taskType(text) {
  const lower = text.toLowerCase();
  const has = (...terms) => terms.some((term) => lower.includes(term));
  if (has("migration", "migrate", "schema change", "backfill", "rollback")) return "migration";
  if (has("bug", "fix", "broken", "regression", "crash", "error", "incorrect")) return "bugfix";
  if (has("investigate", "diagnose", "root cause", "why does", "trace")) return "investigation";
  if (has("refactor", "restructure", "reorganize", "cleanup")) return "refactor";
  if (has("review", "audit", "critique", "assess")) return "review";
  if (has("verify", "verification", "prove", "validate", "check that")) return "verification";
  if (has("build", "implement", "add", "create", "ship", "feature")) return "feature";
  return "general";
}
var TASK_STOPWORDS = /* @__PURE__ */ new Set(["about", "after", "agent", "before", "build", "change", "code", "create", "from", "have", "help", "implement", "into", "make", "please", "project", "repository", "should", "spec", "task", "that", "then", "there", "these", "they", "this", "through", "user", "want", "what", "when", "where", "which", "with", "would", "your"]);
function taskTerms(text) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of text.match(/[A-Za-z][A-Za-z0-9_./-]{2,63}/g) ?? []) {
    const term = raw.toLowerCase().replace(/^[-./]+|[-./]+$/g, "");
    if (!term || term.includes("..") || TASK_STOPWORDS.has(term) || seen.has(term)) continue;
    if (/^(?:sk|pk|rk|ghp|github_pat|xox[baprs]|akia)[-_]/i.test(term) || /^[a-z0-9_-]{40,}$/i.test(term)) continue;
    seen.add(term);
    out.push(term);
    if (out.length === 12) break;
  }
  return out;
}
function taskContinuation(text) {
  const prompt = text.trim().toLowerCase();
  if (!prompt || prompt.length > 160 || prompt.split(/\s+/).length > 14) return false;
  return /^(?:please\s+)?(?:continue|go ahead|keep going|proceed|do (?:it|that)|fix (?:it|that)|retry|try again|explain (?:it|that)|what do you mean|yes|yep|yeah|why\??|how\??)[.!?\s]*$/.test(prompt);
}

// ../pi-extension/src/provider-compat.ts
function unpreservedAttributionHeaders(model, resolvedHeaders, sessionId, telemetryEnv = process.env.PI_TELEMETRY) {
  let host;
  try {
    host = new URL(model.baseUrl).hostname;
  } catch {
  }
  const expected = {};
  const telemetryDisabled = telemetryEnv !== void 0 && !["1", "true", "yes"].includes(telemetryEnv.toLowerCase());
  if (!telemetryDisabled) {
    if (model.provider !== "openrouter" && model.baseUrl.includes("openrouter.ai")) {
      Object.assign(expected, { "HTTP-Referer": "https://pi.dev", "X-OpenRouter-Title": "pi", "X-OpenRouter-Categories": "cli-agent" });
    }
    if (model.provider !== "nvidia" && host === "integrate.api.nvidia.com") expected["X-BILLING-INVOKE-ORIGIN"] = "Pi";
    if (!["cloudflare-workers-ai", "cloudflare-ai-gateway"].includes(model.provider) && ["api.cloudflare.com", "gateway.ai.cloudflare.com"].includes(host ?? "")) expected["User-Agent"] = "pi-coding-agent";
  }
  if (!["opencode", "opencode-go"].includes(model.provider) && host === "opencode.ai") {
    expected["x-opencode-session"] = sessionId;
    expected["x-opencode-client"] = "pi";
  }
  return Object.entries(expected).filter(([name, value]) => {
    if (resolvedHeaders && Object.hasOwn(resolvedHeaders, name)) return false;
    return value === void 0 || model.headers?.[name] !== value;
  }).map(([name]) => name).sort();
}
function compatForRoutedModel(model) {
  const provider = model.provider;
  const url = model.baseUrl;
  const openRouter = provider === "openrouter" || url.includes("openrouter.ai");
  if (model.api === "openai-responses") {
    const explicit2 = model.compat;
    return { ...explicit2, sessionAffinityFormat: explicit2?.sessionAffinityFormat ?? (openRouter ? "openrouter" : "openai") };
  }
  if (model.api === "anthropic-messages") {
    if (!openRouter) return model.compat;
    const explicit2 = model.compat;
    return {
      ...explicit2,
      sendSessionAffinityHeaders: explicit2?.sendSessionAffinityHeaders ?? true,
      sessionAffinityFormat: explicit2?.sessionAffinityFormat ?? "openrouter"
    };
  }
  if (model.api !== "openai-completions") return model.compat;
  const explicit = model.compat;
  const zai = provider === "zai" || provider === "zai-coding-cn" || url.includes("api.z.ai") || url.includes("open.bigmodel.cn");
  const together = provider === "together" || url.includes("api.together.ai") || url.includes("api.together.xyz");
  const moonshot = provider === "moonshotai" || provider === "moonshotai-cn" || url.includes("api.moonshot.");
  const cloudflareWorkers = provider === "cloudflare-workers-ai" || url.includes("api.cloudflare.com");
  const cloudflareGateway = provider === "cloudflare-ai-gateway" || url.includes("gateway.ai.cloudflare.com");
  const nvidia = provider === "nvidia" || url.includes("integrate.api.nvidia.com");
  const antLing = provider === "ant-ling" || url.includes("api.ant-ling.com");
  const grok = provider === "xai" || url.includes("api.x.ai");
  const deepseek = provider === "deepseek" || url.toLowerCase().includes("deepseek.com");
  const nonStandard = nvidia || provider === "cerebras" || url.includes("cerebras.ai") || grok || together || url.includes("chutes.ai") || deepseek || zai || moonshot || provider === "opencode" || url.includes("opencode.ai") || cloudflareWorkers || cloudflareGateway || antLing;
  const maxTokens = url.includes("chutes.ai") || deepseek || moonshot || cloudflareGateway || together || nvidia || antLing || zai;
  const openRouterDeveloper = openRouter && (model.id.startsWith("anthropic/") || model.id.startsWith("openai/"));
  return {
    ...explicit,
    supportsStore: explicit?.supportsStore ?? !nonStandard,
    supportsDeveloperRole: explicit?.supportsDeveloperRole ?? (openRouterDeveloper || !nonStandard && !openRouter),
    supportsReasoningEffort: explicit?.supportsReasoningEffort ?? !(grok || zai || moonshot || together || cloudflareGateway || nvidia || antLing),
    maxTokensField: explicit?.maxTokensField ?? (maxTokens ? "max_tokens" : "max_completion_tokens"),
    requiresReasoningContentOnAssistantMessages: explicit?.requiresReasoningContentOnAssistantMessages ?? deepseek,
    thinkingFormat: explicit?.thinkingFormat ?? (deepseek ? "deepseek" : zai ? "zai" : together ? "together" : antLing ? "ant-ling" : openRouter ? "openrouter" : "openai"),
    sendSessionAffinityHeaders: explicit?.sendSessionAffinityHeaders ?? openRouter,
    sessionAffinityFormat: explicit?.sessionAffinityFormat ?? (openRouter ? "openrouter" : "openai"),
    supportsLongCacheRetention: explicit?.supportsLongCacheRetention ?? !(together || cloudflareWorkers || cloudflareGateway || nvidia || antLing)
  };
}

// ../pi-extension/src/provider.ts
var ProviderRouter = class {
  pi;
  notify;
  gateway;
  gateOpen = false;
  routed;
  // Named compat mounts the running proxy published in its run-state file.
  compatUpstreams;
  providerUpstreams;
  compatForwardHeaders;
  applying = false;
  gateGeneration = 0;
  warnedModels = /* @__PURE__ */ new Set();
  constructor(pi, notify) {
    this.pi = pi;
    this.notify = notify;
  }
  // openGate is called once per session after the recovery gate held. Refuses
  // non-loopback gateways: managed routing needs auth proof v1 does not carry.
  async openGate(gateway, ctx, compatUpstreams, providerUpstreams, compatForwardHeaders) {
    if (!await this.closeGate(ctx)) return;
    if (!isLoopbackUrl(gateway)) {
      this.notify("Caveman: direct mode, no compression this session (gateway is not loopback)", "warning");
      return;
    }
    this.compatUpstreams = compatUpstreams;
    this.providerUpstreams = providerUpstreams;
    this.compatForwardHeaders = compatForwardHeaders;
    this.gateway = gateway;
    this.gateOpen = true;
    await this.apply(ctx.model, ctx);
  }
  async closeGate(ctx) {
    this.gateOpen = false;
    this.gateGeneration++;
    return this.restoreCurrentModel(ctx);
  }
  routing() {
    return this.routed !== void 0;
  }
  // apply routes one model object, or restores direct mode when the model
  // has no verified route. Called from the gate and from model_select; the
  // applying flag swallows the model_select echo of our own setModel call.
  async apply(model, ctx) {
    if (!this.gateOpen || this.applying || !this.gateway) return;
    if (!model) return;
    const gateGeneration = this.gateGeneration;
    const key = `${model.provider}/${model.id}`;
    const original = this.isOwnedRoute(model) ? this.routed.originalBaseUrl : model.baseUrl;
    const route = routeForApi(this.gateway, model.api, model.provider, original, this.compatUpstreams, this.providerUpstreams);
    const compatibilityIssue = model.api === "openai-completions" && original.includes("api.openai.com") ? "Pi cannot preserve this OpenAI Chat endpoint's prompt cache keys through routing" : void 0;
    let headerIssue;
    let oauth = true;
    try {
      oauth = ctx.modelRegistry.isUsingOAuth(model);
    } catch {
    }
    if (!oauth && route && !compatibilityIssue) {
      try {
        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (!auth.ok) throw new Error("request auth unavailable");
        const { headers } = auth;
        const published = {
          ...this.compatUpstreams ? { compat_upstreams: this.compatUpstreams } : {},
          ...this.compatForwardHeaders ? { compat_forward_headers: this.compatForwardHeaders } : {}
        };
        const missingHeaders = [.../* @__PURE__ */ new Set([
          ...unforwardedProviderHeaders(model.api, model.provider, model.headers, published),
          ...unforwardedProviderHeaders(model.api, model.provider, headers, published)
        ])].sort();
        if (missingHeaders.length) {
          const remedy = missingHeaders.some((name) => ["authorization", "x-api-key", "x-goog-api-key"].includes(name.toLowerCase())) ? "the proxy cannot preserve this authentication override; keep the provider direct" : `configure compat.${model.provider}.forward_headers`;
          headerIssue = `provider headers ${missingHeaders.join(", ")} are not forwarded; ${remedy}`;
        }
        if (!headerIssue) {
          let sessionId;
          try {
            sessionId = ctx.sessionManager.getSessionId();
          } catch {
          }
          const attribution = unpreservedAttributionHeaders({ ...model, baseUrl: original }, headers, sessionId);
          if (attribution.length) headerIssue = `Pi cannot preserve URL-derived headers ${attribution.join(", ")} for this provider alias; use its canonical provider ID or explicit headers`;
        }
      } catch {
        headerIssue = "provider request headers could not be resolved";
      }
      if (!this.gateOpen || this.gateGeneration !== gateGeneration || ctx.model !== model) return;
    }
    if (!route || oauth || compatibilityIssue || headerIssue) {
      if (!await this.restoreCurrentModel(ctx)) return;
      if (!this.warnedModels.has(key)) {
        this.warnedModels.add(key);
        const mount = compatUpstreamFor(model.provider, this.compatUpstreams);
        const expected = mount !== void 0 ? hostOf(mount) : upstreamHostFor(model.provider);
        const reason = oauth ? "OAuth/subscription credentials are not routed" : compatibilityIssue ?? headerIssue ?? (expected === void 0 ? `no compat mount named "${model.provider}" in the local proxy; add compat.${model.provider}.base_url to caveman.yaml to route it` : hostOf(original) !== expected ? `provider endpoint ${hostOf(original) ?? original} is not ${expected}` : `provider endpoint path or API "${model.provider}/${model.api}" is not verified by the running proxy`);
        this.notify(boundedString(`Caveman: pass-through for ${key} (${reason}); no compression`, MAX_MESSAGE_BYTES), "warning");
      }
      return;
    }
    if (this.isOwnedRoute(model) && model.baseUrl === route) return;
    this.applying = true;
    try {
      this.routed = {
        provider: model.provider,
        id: model.id,
        originalBaseUrl: original,
        route,
        originalCompat: model.compat,
        hadCompat: Object.hasOwn(model, "compat")
      };
      const compat = compatForRoutedModel(model);
      if (!await this.pi.setModel({ ...model, baseUrl: route, ...compat === void 0 ? {} : { compat } })) {
        if (await this.restoreCurrentModel(ctx)) {
          this.notify("Caveman: direct mode, no compression this session (model selection failed)", "warning");
        }
        return;
      }
    } catch {
      if (await this.restoreCurrentModel(ctx)) {
        this.notify("Caveman: direct mode, no compression this session (model selection failed)", "warning");
      }
    } finally {
      this.applying = false;
    }
  }
  isOwnedRoute(model) {
    return !!model && !!this.routed && model.provider === this.routed.provider && model.id === this.routed.id && model.baseUrl === this.routed.route;
  }
  async restoreCurrentModel(ctx) {
    const current = ctx.model;
    if (!this.isOwnedRoute(current)) {
      this.routed = void 0;
      return true;
    }
    const { originalBaseUrl, originalCompat, hadCompat } = this.routed;
    const direct = { ...current, baseUrl: originalBaseUrl };
    if (hadCompat) direct.compat = originalCompat;
    else delete direct.compat;
    const wasApplying = this.applying;
    this.applying = true;
    try {
      if (await this.pi.setModel(direct)) {
        this.routed = void 0;
        return true;
      }
    } catch {
    } finally {
      this.applying = wasApplying;
    }
    this.notify("Caveman: could not restore the model's direct endpoint; select the model again before continuing", "warning");
    return false;
  }
};

// ../pi-extension/src/recovery.ts
import { execFile as execFile2, spawn } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { delimiter, join as join3 } from "node:path";
var PROBE_TIMEOUT_MS = 2e3;
var CALL_TIMEOUT_MS = 3e4;
var INIT_TIMEOUT_MS = 2e3;
var VERIFY_TIMEOUT_MS = 2e3;
function resolveMcpBinary(env = process.env) {
  const explicit = env.CAVEMAN_MCP_BIN?.trim();
  if (explicit) return explicit;
  const name = process.platform === "win32" ? "caveman-mcp.exe" : "caveman-mcp";
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync2(join3(dir, name))) return join3(dir, name);
  }
  const local = join3(env.CAVEMAN_HOME || join3(homedir2(), ".caveman"), "bin", name);
  return existsSync2(local) ? local : void 0;
}
var RecoveryClient = class {
  binary;
  child;
  initialized = false;
  probed;
  verificationSupported = false;
  ensuring;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  buffer = "";
  disposed = false;
  constructor(binary = resolveMcpBinary()) {
    this.binary = binary;
  }
  // ensure probes the binary once and brings up an initialized child. Returns
  // false (never throws) when recovery cannot hold — the caller passes through.
  async ensure() {
    if (this.disposed || !this.binary) return false;
    if (this.child && this.initialized) return true;
    this.ensuring ??= this.bringUp().finally(() => {
      this.ensuring = void 0;
    });
    return this.ensuring;
  }
  async bringUp() {
    if (this.probed === void 0) this.probed = await this.probe();
    if (!this.probed || this.disposed) return false;
    if (this.child && this.initialized) return true;
    return this.start();
  }
  ready() {
    return Boolean(this.child && this.initialized && !this.disposed);
  }
  async retrieve(handle, query, signal) {
    if (!await this.ensure()) {
      return { text: JSON.stringify({ error: "cave_recovery_unavailable", message: "caveman-mcp is not available this session" }), isError: true };
    }
    try {
      const result = await this.call("tools/call", {
        name: "caveman_retrieve",
        arguments: { recovery_handle: handle, ...query ? { query } : {} }
      }, signal);
      const value = result;
      const text = (value.content ?? []).map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join("");
      return { text, isError: Boolean(value.isError) };
    } catch (error) {
      return { text: JSON.stringify({ error: "cave_recovery_transport", message: error.message }), isError: true };
    }
  }
  // A silent pre-publication proof must not count as delivery to the model.
  // Old companions ignore unknown arguments, so capability proof is mandatory
  // before sending verify_only through the same long-lived recovery child.
  async verify(handle, originalText) {
    const normalized = normalizeRecoveryHandle(handle);
    const bytes = Buffer.byteLength(originalText, "utf8");
    if (!normalized || bytes > MAX_TOOL_OUTPUT_BYTES) return false;
    try {
      if (!await this.ensure() || !this.verificationSupported) return false;
      const result = await this.call("tools/call", {
        name: "caveman_retrieve",
        arguments: { recovery_handle: normalized, verify_only: true }
      }, void 0, VERIFY_TIMEOUT_MS);
      if (result.isError || !Array.isArray(result.content) || result.content.length !== 1) return false;
      const block = result.content[0];
      if (block?.type !== "text" || typeof block.text !== "string" || Buffer.byteLength(block.text, "utf8") > MAX_MESSAGE_BYTES) return false;
      const proof = JSON.parse(block.text);
      return proof?.recovery_handle === normalized && proof.byte_length === bytes && proof.sha256 === createHash2("sha256").update(originalText, "utf8").digest("hex");
    } catch {
      return false;
    }
  }
  dispose() {
    this.disposed = true;
    const child = this.child;
    this.child = void 0;
    this.initialized = false;
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("recovery client disposed"));
    }
    this.pending.clear();
    this.stop(child);
    void this.ensuring?.then(() => {
      const late = this.child;
      this.child = void 0;
      this.stop(late);
    });
  }
  // resolveMcpBinary appends .exe on win32, but CAVEMAN_MCP_BIN is an operator
  // override that can name anything — including a .cmd shim, which execFile
  // and spawn both refuse with EFTYPE. Route through the same resolver the hook
  // bridge uses so the override is as spawnable as the default. Fail-closed:
  // callers treat a throw as "recovery cannot hold" and pass through.
  invocation(args) {
    try {
      return portableInvocation(this.binary, args);
    } catch {
      return void 0;
    }
  }
  probe() {
    return new Promise((resolve2) => {
      const portable = this.invocation(["version", "--json"]);
      if (!portable) return resolve2(false);
      execFile2(portable.command, portable.args, { timeout: PROBE_TIMEOUT_MS, encoding: "utf8" }, (error, stdout) => {
        if (error) return resolve2(false);
        try {
          const parsed = JSON.parse(stdout);
          this.verificationSupported = Array.isArray(parsed?.capabilities) && parsed.capabilities.includes("recovery_verification");
          resolve2(Array.isArray(parsed?.capabilities) && parsed.capabilities.includes("mcp_recovery"));
        } catch {
          resolve2(false);
        }
      });
    });
  }
  async start() {
    let child;
    try {
      const portable = this.invocation([]);
      if (!portable) return false;
      child = spawn(portable.command, portable.args, { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      return false;
    }
    this.child = child;
    this.initialized = false;
    this.buffer = "";
    child.on("error", () => this.onChildGone(child));
    child.on("exit", () => this.onChildGone(child));
    child.stdin?.on("error", () => this.onChildGone(child));
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => this.onData(chunk));
    try {
      await this.call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "caveman-pi-extension", version: "0.2.0" }
      }, void 0, INIT_TIMEOUT_MS);
      this.notify("notifications/initialized");
      if (this.disposed) {
        this.onChildGone(child);
        this.stop(child);
        return false;
      }
      this.initialized = true;
      return true;
    } catch {
      this.onChildGone(child);
      this.stop(child);
      return false;
    }
  }
  stop(child) {
    if (!child) return;
    try {
      child.stdin?.end();
    } catch {
    }
    const term = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
      }
    }, 500);
    const kill = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
    }, 2e3);
    child.once("exit", () => {
      clearTimeout(term);
      clearTimeout(kill);
    });
  }
  onChildGone(child) {
    if (this.child !== child) return;
    this.child = void 0;
    this.initialized = false;
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("caveman-mcp exited"));
    }
    this.pending.clear();
  }
  onData(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof message.id !== "number") continue;
      const entry = this.pending.get(message.id);
      if (!entry) continue;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(message.error.message || "caveman-mcp error"));
      else entry.resolve(message.result);
    }
  }
  call(method, params, signal, timeoutMs = CALL_TIMEOUT_MS) {
    const child = this.child;
    if (!child?.stdin?.writable) return Promise.reject(new Error("caveman-mcp not running"));
    if (signal?.aborted) return Promise.reject(new Error("retrieve cancelled"));
    const id = this.nextId++;
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`caveman-mcp ${method} timed out`));
      }, timeoutMs);
      timer.unref?.();
      const onAbort = () => {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error("retrieve cancelled"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, {
        resolve: (value) => {
          signal?.removeEventListener("abort", onAbort);
          resolve2(value);
        },
        reject: (error) => {
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
        timer
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n", (error) => {
        if (error) {
          this.pending.delete(id);
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        }
      });
    });
  }
  notify(method) {
    try {
      this.child?.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
    } catch {
    }
  }
};

// ../pi-extension/src/tool-output.ts
async function shrinkToolResult(bridge, sessionId, event, recovery) {
  const text = event.content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join("");
  if (!text) return void 0;
  if (Buffer.byteLength(text, "utf8") > MAX_TOOL_OUTPUT_BYTES) return void 0;
  let replacement;
  try {
    const response = await bridge.call(event.isError ? "PostToolUseFailure" : "PostToolUse", {
      session_id: sessionId,
      tool_name: event.toolName,
      tool_input: event.input,
      tool_output: text
    });
    const proposed = outputReplacementOf(response);
    if (!proposed || Buffer.byteLength(proposed, "utf8") > MAX_OUTPUT_REPLACEMENT_BYTES) return void 0;
    let handle = normalizeRecoveryHandle(response?.recovery_ref);
    if (response?.recovery_ref !== void 0 && !handle) return void 0;
    let advertised = false;
    for (const match of proposed.matchAll(/(?:<<)?ccr(?::|_)[^\s"'`]*/g)) {
      if (match.index > 0 && /[A-Za-z0-9_<:/]/.test(proposed[match.index - 1])) return void 0;
      const candidate = normalizeRecoveryHandle(match[0]);
      if (!candidate || handle && candidate !== handle) return void 0;
      handle = candidate;
      advertised = true;
    }
    if (!advertised || !handle || !await recovery.verify(handle, text)) return void 0;
    replacement = proposed;
  } catch {
    return void 0;
  }
  return { content: [{ type: "text", text: replacement }, ...event.content.filter((block) => block.type !== "text")] };
}

// ../pi-extension/src/index.ts
var HEALTH_TIMEOUT_MS = 750;
var RECOVERY_TOOL = "caveman_retrieve";
function cavemanHome() {
  return process.env.CAVEMAN_HOME || join4(homedir3(), ".caveman");
}
function gatewayUrl() {
  const env = process.env.CAVE_GATEWAY_URL?.trim();
  if (env) return env;
  try {
    const config = JSON.parse(readFileSync2(join4(homedir3(), ".caveman-cloud", "config.json"), "utf8"));
    if (typeof config.gatewayUrl === "string" && config.gatewayUrl) return config.gatewayUrl;
  } catch {
  }
  return "http://127.0.0.1:8787";
}
function readRunState(gateway) {
  let port;
  try {
    const url = new URL(gateway);
    if (!isLoopbackUrl(gateway) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return void 0;
    port = url.port || (url.protocol === "https:" ? "443" : "80");
  } catch {
    return void 0;
  }
  try {
    const state = JSON.parse(readFileSync2(join4(cavemanHome(), "run", `${port}.json`), "utf8"));
    if (state?.schema !== "caveman.proxy.run.v1") return void 0;
    if (!Number.isSafeInteger(state.pid) || state.pid < 1 || state.port !== Number(port) || typeof state.instance_token !== "string" || !state.instance_token) return void 0;
    if (state.owner !== "wrap" && state.owner !== "start") return void 0;
    try {
      process.kill(state.pid, 0);
    } catch {
      return void 0;
    }
    return { instanceToken: state.instance_token, recoveryViaMcp: state.recovery_via_mcp === true, compatUpstreams: publishedUpstreamsOf(state.compat_upstreams), providerUpstreams: publishedUpstreamsOf(state.provider_upstreams), compatForwardHeaders: publishedForwardHeadersOf(state.compat_forward_headers) };
  } catch {
    return void 0;
  }
}
async function proxyAliveOnce(gateway, instanceToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${gateway.replace(/\/+$/, "")}/health/live`, { signal: controller.signal, redirect: "error" });
    await response.body?.cancel();
    return response.ok && response.headers.get("x-caveman-instance") === instanceToken;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function readLiveRunState(gateway) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = readRunState(gateway);
    if (state && await proxyAliveOnce(gateway, state.instanceToken)) return state;
    await new Promise((resolve2) => setTimeout(resolve2, 300));
  }
  return void 0;
}
function index_default(pi) {
  const bridge = new HookBridge();
  const recovery = new RecoveryClient();
  let router;
  let sessionId = "default";
  let coreContext;
  let pendingContext = [];
  let pendingBytes = 0;
  let gateDone = false;
  const notify = (ctx, message, kind) => {
    if (ctx?.hasUI) ctx.ui.notify(message, kind);
    else process.stderr.write(`${message}
`);
  };
  const debug = (message) => {
    if (process.env.CAVEMAN_PI_DEBUG === "1") process.stderr.write(`[caveman-pi] ${message}
`);
  };
  const guardedBase = (fn, label = fn.name || "handler") => (async (...args) => {
    try {
      debug(`enter ${label}`);
      const result = await fn(...args);
      debug(`exit ${label}`);
      return result;
    } catch (error) {
      process.stderr.write(`caveman pi extension: ${error.message}
`);
      return void 0;
    }
  });
  const GUARD = (label) => (fn) => guardedBase(fn, label);
  const GUARD_session_start = GUARD("session_start");
  const GUARD_model_select = GUARD("model_select");
  const GUARD_before_agent_start = GUARD("before_agent_start");
  const GUARD_turn_start = GUARD("turn_start");
  const GUARD_turn_end = GUARD("turn_end");
  const GUARD_tool_call = GUARD("tool_call");
  const GUARD_tool_result = GUARD("tool_result");
  const GUARD_session_before_compact = GUARD("session_before_compact");
  const GUARD_session_compact = GUARD("session_compact");
  const GUARD_session_shutdown = GUARD("session_shutdown");
  pi.registerTool({
    name: RECOVERY_TOOL,
    label: "Retrieve compressed context",
    description: "Recover exact original content from a Caveman recovery handle.",
    parameters: Type.Object({
      recovery_handle: Type.String({ description: "Exact ccr_ handle returned by Caveman or copied from a <<ccr:HANDLE>> marker." }),
      query: Type.Optional(Type.String({ description: "One broad description covering every detail needed from this handle." }))
    }),
    async execute(_toolCallId, params, signal) {
      const result = await recovery.retrieve(params.recovery_handle, params.query, signal);
      if (result.isError) throw new Error(result.text || "caveman_retrieve failed");
      return { content: [{ type: "text", text: result.text }], details: { recovery_handle: params.recovery_handle } };
    }
  });
  pi.on("session_start", GUARD_session_start(async (_event, ctx) => {
    router ??= new ProviderRouter(pi, (message, kind) => notify(ctx, message, kind));
    gateDone = false;
    coreContext = void 0;
    pendingContext = [];
    pendingBytes = 0;
    if (!await router.closeGate(ctx)) {
      gateDone = true;
      return;
    }
    try {
      sessionId = ctx.sessionManager.getSessionId() || "default";
    } catch {
      sessionId = "default";
    }
    const start = await bridge.call("SessionStart", { session_id: sessionId });
    coreContext = additionalContextOf(start);
    if (!start) {
      gateDone = true;
      notify(ctx, "Caveman: direct mode, no compression this session (caveman native runtime unreachable)", "warning");
      return;
    }
    const gateway = gatewayUrl();
    const published = await readLiveRunState(gateway);
    const recoveryReady = published ? await recovery.ensure() : false;
    gateDone = true;
    if (!published) {
      notify(ctx, "Caveman: direct mode, no compression this session (local proxy not running)", "warning");
      return;
    }
    if (!published.recoveryViaMcp || !recoveryReady) {
      notify(ctx, "Caveman: direct mode, no compression this session (recovery not available \u2014 run `caveman doctor pi`)", "warning");
      return;
    }
    await router.openGate(gateway, ctx, published.compatUpstreams, published.providerUpstreams, published.compatForwardHeaders);
  }));
  pi.on("model_select", GUARD_model_select(async (event, ctx) => {
    if (gateDone) await router?.apply(event.model, ctx);
  }));
  pi.on("before_agent_start", GUARD_before_agent_start(async (event, ctx) => {
    if (gateDone) await router?.apply(ctx.model, ctx);
    const response = await bridge.call("UserPromptSubmit", {
      session_id: sessionId,
      model: ctx.model?.id,
      provider: ctx.model?.provider,
      prompt: promptDigest(event.prompt),
      task_type: taskType(event.prompt),
      task_terms: taskTerms(event.prompt),
      task_continuation: taskContinuation(event.prompt)
    });
    const dynamic = [additionalContextOf(response), ...pendingContext].filter(Boolean);
    pendingContext = [];
    pendingBytes = 0;
    if (!coreContext && dynamic.length === 0) return void 0;
    const parts = [event.systemPrompt, coreContext, ...dynamic].filter(Boolean);
    return { systemPrompt: parts.join("\n\n") };
  }));
  pi.on("turn_start", GUARD_turn_start(() => {
    void bridge.call("ModelBefore", { session_id: sessionId });
  }));
  pi.on("turn_end", GUARD_turn_end(async () => {
    await bridge.call("ModelAfter", { session_id: sessionId });
    void bridge.call("Stop", { session_id: sessionId });
  }));
  pi.on("tool_call", GUARD_tool_call(async (event) => {
    const response = await bridge.call("PreToolUse", {
      session_id: sessionId,
      tool_name: event.toolName,
      tool_input: event.input
    });
    const context = additionalContextOf(response);
    const bytes = context ? Buffer.byteLength(context, "utf8") : 0;
    if (context && pendingBytes + bytes <= MAX_CONTEXT_BYTES) {
      pendingContext.push(context);
      pendingBytes += bytes;
    }
  }));
  pi.on("tool_result", GUARD_tool_result((event) => event.toolName === RECOVERY_TOOL ? void 0 : shrinkToolResult(bridge, sessionId, event, recovery)));
  pi.on("session_before_compact", GUARD_session_before_compact(() => {
    void bridge.call("PreCompact", { session_id: sessionId });
  }));
  pi.on("session_compact", GUARD_session_compact(async () => {
    const response = await bridge.call("PostCompact", { session_id: sessionId });
    const context = additionalContextOf(response);
    if (context) coreContext = context;
  }));
  pi.on("session_shutdown", GUARD_session_shutdown(async (_event, ctx) => {
    await bridge.call("SessionEnd", { session_id: sessionId });
    await router?.closeGate(ctx);
    recovery.dispose();
  }));
}
export {
  index_default as default
};
