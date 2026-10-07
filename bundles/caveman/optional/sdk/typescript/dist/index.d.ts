/** `user` is an opaque end-user identifier sent as x-cave-user-hash (never a
 *  Caveman member id). The SDK forwards it verbatim — hash it yourself before
 *  passing if the raw value is PII. Mirrors the Python `Cave.user`. */
export type CaveOptions = {
    apiKey: string;
    baseURL: string;
    agent: string;
    defaultWorkflow?: string;
    retention?: "metadata" | "zdr" | "configured";
    verifyOnInit?: boolean;
    controlURL?: string;
    user?: string; /** Finite deadline for every SDK HTTP request; defaults to 30 seconds. */
    timeoutMs?: number; /** Caller cancellation applied to every SDK HTTP request. */
    signal?: AbortSignal;
};
/** `traceId`/`spanId` continue an inbound trace instead of minting fresh ids; a
 *  value that is not the exact hex shape is replaced rather than put on the wire. */
export type TraceOptions = {
    workflow?: string;
    tags?: Record<string, string>;
    traceId?: string;
    spanId?: string;
};
export type ToolOptions = {
    readOnly?: boolean;
    idempotent?: boolean;
    artifactEligible?: boolean;
};
/** A tool descriptor for inclusion in the tool catalog sent to the gateway. */
export type CaveTool = {
    name: string;
    description: string;
    inputSchema: unknown;
    handler: (...args: unknown[]) => unknown;
    tags?: string[];
    readOnly: boolean;
    idempotent: boolean;
    alwaysLoad?: boolean;
};
/** Response from a server-side tool-search call. */
export type ToolSearchResult = {
    /** Server-side tool-session id for later provider-request reinjection. */
    sessionId?: string;
    /** Reduced tool list returned by the gateway for this query. */
    tools: CaveTool[];
    /** Estimated tokens for the schemas the gateway actually sent (reduced set). */
    sentSchemaTokens: number;
    /** Estimated tokens if ALL tool schemas had been sent (full catalog). */
    fullSchemaTokens: number;
    /** Number of tools whose schemas were deferred (not sent). */
    deferredCount: number;
    /** Search method used by the gateway ("bm25" by default, "embeddings" if wired). */
    method: string;
    /** Counting method for both schema-token estimates. */
    tokenBasis: string;
    /** Always inferred: the full-catalog counterfactual is not provider-observed. */
    basis: "inferred";
    /** Estimated tokens avoided vs. sending the full catalog. */
    readonly savedTokens: number;
    /** Estimated percentage avoided (0–100). */
    readonly reductionPct: number;
};
/** Options for {@link Cave.compress}. */
export type CompressOptions = {
    /** Optional content-type hint for the engine's detector, including forced "toon". */
    contentType?: "json" | "toon" | "log" | "code" | "diff" | "search-result" | "text" | "toolschema" | string;
};
/**
 * Result of a {@link Cave.compress} call — the Engine's compression report.
 *
 * `basis` is always `"inferred"`: the SDK never emits `verified` (that is earned
 * only by the Cloud `active` path). On any transport/parse problem the call is a
 * fail-closed pass-through (`output` is the original input, `ratio` is `0`, and
 * `recoveryHandle` is absent).
 */
export type CompressResult = {
    /** The compressed payload, or the original input verbatim on pass-through. */
    output: string;
    /** The detected/declared content type ("json" | "log" | "code" | "text" | "unknown"). */
    contentType: string;
    /** Estimated tokens for the original input (0 when not computed / pass-through). */
    tokensBefore: number;
    /** Estimated tokens for the compressed output (0 when not computed / pass-through). */
    tokensAfter: number;
    /** Fraction of tokens removed (`(tokensBefore - tokensAfter) / tokensBefore`); `0` = unchanged. */
    ratio: number;
    /** Always `"inferred"` — the SDK never reports `verified`. */
    basis: "inferred";
    /** Token counter used by the Engine (e.g. `o200k_base` or `approx_chars_div_4`). */
    tokenCountBasis: string;
    /** Handle to recover the byte-exact original; absent when nothing was stored. */
    recoveryHandle?: string;
    /** Concrete compression method chosen by the engine, e.g. "toon" or "elision". */
    method?: string;
    /** True when model-visible output kept the full value with no data dropped. */
    losslessToModel?: boolean;
};
/** One caller-owned context fragment considered by {@link Cave.context}. */
export type ContextPackItem = {
    /** Stable caller-owned ID, used to report omitted items exactly. */
    id: string;
    /** Model-visible fragment bytes. */
    text: string;
    /** Optional pre-counted token total; gateway counts when omitted or zero. */
    tokens?: number;
    /** Optional RFC 3339 timestamp used by the recency signal. */
    timestamp?: string;
    /** Caller-supplied relevance boost. */
    priority?: number;
    /** Required context. If a pinned item cannot fit, the call returns honest zero. */
    pin?: boolean;
};
/** Budget and scoring options for {@link Cave.context}. */
export type ContextPackOptions = {
    /** Total model-window budget. Must be greater than zero. */
    maxTokens: number;
    /** Tokens reserved for the next response or tool call. */
    reserveTokens?: number;
    /** Optional RFC 3339 scoring clock for deterministic recency tests. */
    now?: string;
    /** Recency half-life in milliseconds. */
    recencyHalfLifeMs?: number;
    /** Optional override for recency score weight. */
    recencyWeight?: number;
    /** Optional override for error-signal score boost. */
    errorBoost?: number;
};
/** Result from connected-only context packing through the gateway. */
export type ContextPackResult = {
    /** Selected caller-owned items, preserved in original chronological order. */
    items: ContextPackItem[];
    tokensUsed: number;
    tokensBefore: number;
    /** Always inferred; this selector never enters the verified-savings ledger. */
    tokensSaved: number;
    deferredCount: number;
    /** Exact request-ID minus selected-ID set, in request order. */
    deferredIds: string[];
    basis: "inferred";
};
export type AssemblyStability = "stable" | "session" | "volatile";
export type EmitCacheHints = "gateway" | "self" | "none";
/** One author-declared request fragment for {@link Cave.assemble}. */
export type AssemblySlot = {
    id: string;
    stability: AssemblyStability;
    content: unknown;
};
/** Input contract for the client-pure cache-optimal request assembler. */
export type AssembleOptions = {
    provider: "anthropic" | "openai" | string;
    model: string;
    sessionId: string;
    slots: AssemblySlot[];
    /** Defaults to "gateway". "self" places hints but mints nothing. */
    emitCacheHints?: EmitCacheHints;
};
/** Result from {@link Cave.assemble}; every token figure is inferred. */
export type AssemblyResult = {
    request: Record<string, unknown>;
    /** Header to send with request; Cave provider clients attach it automatically. */
    headers: {
        "x-cave-assembly": string;
    };
    prefixHash: string;
    breakpoints: string[];
    stableTokens: number;
    tokenBasis: "estimated_bytes_div_4";
    basis: "inferred";
    volatileBelowBreakpoint: true;
};
/** Stable/session content changed inside its declared lifetime. */
export declare class AssemblyStabilityError extends Error {
    readonly slotId: string;
    constructor(slotId: string);
}
/** One safety-class band of the plan's headroom (inferred, per-day USD). */
export interface CavePlanHeadroomClass {
    safety_class: string;
    low: number;
    base: number;
    high: number;
    move_count: number;
}
/** The plan headline: summed inferred per-day headroom across all moves. */
export interface CavePlanHeadline {
    low: number;
    base: number;
    high: number;
    /** Always `"inferred"` — the plan headline is never a verified figure. */
    basis: string;
    move_count: number;
}
/** One (agent/workflow/provider/model) scope's share of a move's base headroom. */
export interface CavePlanScopeShare {
    agent_id?: string;
    workflow_id?: string;
    agent_name?: string;
    workflow_name?: string;
    provider?: string;
    model?: string;
    savings_usd_base: number;
    /** Share of the move's base headroom, 0–100. */
    share_pct: number;
}
/** One recommended optimizer move. Dollar figures are inferred, per-day. */
export interface CavePlanMove {
    optimizer_id: string;
    title: string;
    family: string;
    safety_class: string;
    basis: string;
    confidence: string;
    quality_risk: string;
    implementation_effort: string;
    requires_eval_gate: boolean;
    scope_count: number;
    sample_size: number;
    savings_usd_low: number;
    savings_usd_base: number;
    savings_usd_high: number;
    share_of_headline_pct: number;
    next_action: string;
    summary: string;
    /** Present when the move's gateway optimizer is already active (residual signal). */
    already_active_note?: string;
    /** Up to 3 driving scopes, by `savings_usd_base` desc. */
    top_scopes?: CavePlanScopeShare[];
}
/** An optimizer with no current signal, plus the plain-language reason why. */
export interface CavePlanNoSignal {
    optimizer_id: string;
    title: string;
    reason_code: string;
    reason: string;
}
/**
 * The project-scope Cave Plan, read machine-readably via `GET /sdk/v1/cave-plan`
 * (see {@link Cave.cavePlan}). Passed through verbatim from control-api: field
 * names are the snake_case wire names, identical to the Python `cave_plan()`.
 * Every dollar figure is `inferred` and a PER-DAY rate — never `verified`,
 * never re-projected to a month.
 */
export interface CavePlan {
    headline: CavePlanHeadline;
    headroom_by_class: CavePlanHeadroomClass[];
    moves: CavePlanMove[];
    no_signal: CavePlanNoSignal[];
    methodology: string;
    as_of?: string;
    detectors_last_ran?: string;
    diagnostics?: string[];
    mode_note?: string;
    /** Always `"project"` on this surface (the SDK reads one project's plan). */
    scope: string;
    project_id: string;
}
/**
 * The single human-editable object controlling cave-auto routing for a workflow
 * (spec R14). Field names are the snake_case wire names — identical to the Go
 * `policy.TaskProfile` JSON tags and the sdk-python `TaskProfile` dataclass.
 * Editing one is a policy publish; there is no ML in the loop.
 *
 * `alpha` is the 0–10 cost/quality dial (0 = most capable in the passing set,
 * 10 = cheapest). Every field is optional; an absent profile means baseline
 * pass-through.
 */
export interface TaskProfile {
    /** Minimum grader pass rate (LCB) a candidate must hold to be eligible. */
    quality_floor?: number;
    /** Cost/quality dial, 0 (most capable) – 10 (cheapest). */
    alpha?: number;
    /** Allowlist patterns ("provider/*", "*:model", "provider:model", "model"). */
    candidate_allowlist?: string[];
    /** Denylist patterns (same grammar as the allowlist). */
    candidate_denylist?: string[];
    /** Max tolerated p95 latency increase vs baseline, in milliseconds. */
    max_p95_latency_delta_ms?: number;
    /** Max tolerated error-rate increase vs baseline. */
    max_error_delta?: number;
    /** Max tolerated cost ratio (routed / baseline). */
    max_cost_ratio?: number;
    /** Enable FrugalGPT-style cascade escalation. */
    cascade_enabled?: boolean;
    /** Confidence threshold below which the cascade escalates a rung. */
    cascade_tau?: number;
    /** Max tolerated cascade escalation rate. */
    max_escalation_rate?: number;
    /** Session stickiness mode ("conversation" | "none" | "key"). */
    stickiness?: string;
    /** Allow routing across providers (not just within the request's provider). */
    cross_provider?: boolean;
    /** Data-residency region tags a candidate must satisfy. */
    data_residency?: string[];
    /** Trusted request hint sources permitted to influence the route. */
    trusted_route_hints?: string[];
}
/** Fields for a span recorded via the SDK-bundled OTel exporter. */
export type SpanOptions = {
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    kind?: number;
    provider?: string;
    model?: string;
    operation?: string;
    toolName?: string;
    /** Provider-reported total input tokens, inclusive of cached input. */
    inputTokens?: number;
    /** Provider-reported total output tokens, inclusive of reasoning output. */
    outputTokens?: number;
    /** Provider-reported cached-input subset; never added to inputTokens. */
    cachedTokens?: number;
    /** Provider-reported cache-write input tokens (`gen_ai.usage.cache_creation.input_tokens`). Never clamped to
     * inputTokens: Anthropic reports cache writes outside input_tokens. When absent, a caller-supplied attribute of the
     * same name passes through. */
    cacheCreationTokens?: number;
    /** Provider-reported/request-attributed cost in USD, exported as `caveman.usage.cost_usd` plus the deprecated
     * non-semconv `gen_ai.usage.cost_usd` (kept through 1.x). */
    costUsd?: number;
    workflow?: string;
    status?: "unset" | "ok" | "error";
    startTimeNs?: number;
    endTimeNs?: number;
    attributes?: Record<string, string | number | boolean>;
};
/** A span buffered by the OTel exporter (mirrors the OTLP/JSON span shape). */
export type OTelSpan = {
    name: string;
    traceId: string;
    spanId: string;
    parentSpanId: string;
    kind: number;
    startTimeNs: number;
    endTimeNs: number;
    statusCode: number;
    attributes: Record<string, string | number | boolean>;
};
export declare class Cave {
    readonly options: CaveOptions;
    constructor(options: CaveOptions);
    /**
     * Run `fn` inside a trace.
     *
     * The trace allocates a `traceId` (32 lowercase hex) and a root `spanId`
     * (16 lowercase hex) with the same RNG the OTel exporter uses. Every provider
     * call made through the trace carries them as `x-cave-trace-id` +
     * `x-cave-parent-span-id`, and `trace.exporter()` reuses the same trace id —
     * so the gateway's request rows and the SDK's own spans join into one trace.
     *
     * `options.traceId` / `options.spanId` continue an inbound trace; a value that
     * is not the exact hex shape is replaced by a fresh one rather than put on the
     * wire. Mirrors the Python `Cave.trace`.
     */
    trace<T>(options: TraceOptions, fn: (trace: CaveTrace) => Promise<T>): Promise<T>;
    openai(config?: {
        upstreamKey?: string;
    }): {
        provider: string;
        responses: {
            create: (body: unknown, init?: {
                cave?: {
                    latencyClass?: string;
                    toolSessionId?: string;
                };
            }) => Promise<any>;
        };
        chat: {
            completions: {
                create: (body: unknown, init?: {
                    cave?: {
                        toolSessionId?: string;
                    };
                }) => Promise<any>;
            };
        };
        raw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };
    anthropic(config?: {
        upstreamKey?: string;
    }): {
        provider: string;
        responses: {
            create: (body: unknown, init?: {
                cave?: {
                    latencyClass?: string;
                    toolSessionId?: string;
                };
            }) => Promise<any>;
        };
        chat: {
            completions: {
                create: (body: unknown, init?: {
                    cave?: {
                        toolSessionId?: string;
                    };
                }) => Promise<any>;
            };
        };
        raw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };
    gemini(config?: {
        upstreamKey?: string;
    }): {
        provider: string;
        responses: {
            create: (body: unknown, init?: {
                cave?: {
                    latencyClass?: string;
                    toolSessionId?: string;
                };
            }) => Promise<any>;
        };
        chat: {
            completions: {
                create: (body: unknown, init?: {
                    cave?: {
                        toolSessionId?: string;
                    };
                }) => Promise<any>;
            };
        };
        raw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };
    /**
     * Describe the first-party Bedrock gateway surface for an AWS SDK or agent
     * wrapper. Runtime is the default; Mantle remains an explicit opt-in lane.
     *
     * This descriptor performs no network request and carries no AWS secret.
     */
    bedrock(config: {
        region: string;
        endpoint?: "runtime" | "mantle";
    }): {
        region: string;
        endpoint: "runtime" | "mantle";
        gatewayPrefix: string;
        instrumented: boolean;
        sdkOnly: boolean;
    };
    /**
     * Vertex AI client proxied through the gateway (`/vertex` prefix). Routes
     * Google Gemini and Anthropic Claude calls through Caveman for metering.
     *
     * `upstreamKey` is a Google OAuth2 access token (e.g. from
     * `gcloud auth print-access-token` or Application Default Credentials); the
     * gateway forwards it as `Authorization: Bearer …`. Use the returned client's
     * `raw` fetch for native Vertex paths
     * (`/vertex/v1/projects/.../models/{model}:generateContent`). Raw requests
     * remain constrained to this gateway provider prefix.
     */
    vertex(config?: {
        upstreamKey?: string;
    }): {
        provider: string;
        responses: {
            create: (body: unknown, init?: {
                cave?: {
                    latencyClass?: string;
                    toolSessionId?: string;
                };
            }) => Promise<any>;
        };
        chat: {
            completions: {
                create: (body: unknown, init?: {
                    cave?: {
                        toolSessionId?: string;
                    };
                }) => Promise<any>;
            };
        };
        raw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };
    /**
     * Create a one-call OTel exporter bound to this Cave's gateway config.
     *
     * The exporter ships spans to the gateway's OTLP endpoint
     * (`POST {baseURL}/v1/traces`) with Caveman headers
     * (`x-cave-api-key` / `x-cave-agent` / `x-cave-workflow`) so that
     * `recordSpan()` + `export()` land rows in `caveman.spans` without any
     * external OpenTelemetry wiring.
     *
     * @param config.serviceName `service.name` resource attribute; defaults to
     *        the Cave agent slug (the gateway falls back to it for the agent label).
     */
    exporter(config?: {
        serviceName?: string;
    }): OTelExporter;
    /**
     * Build a tool-catalog handle with server-side search via /sdk/v1/tool-search.
     *
     * strategy "all"      → initial = whole catalog; search() still calls the server.
     * strategy "deferred" → initial = alwaysLoad tools (subset sent on first turn);
     *                       search() calls the server to load relevant tools on demand.
     *
     * Breaking change from 1.0: search() is now async and returns ToolSearchResult
     * (previously sync, returning CaveTool[]). Callers must await search().
     */
    tools(config: {
        catalog: CaveTool[];
        strategy?: "all" | "deferred";
        initialToolCount?: number;
        maxLoadedTools?: number;
    }): {
        strategy: "all" | "deferred";
        initial: CaveTool[];
        /**
         * Search the full catalog via the gateway's /sdk/v1/tool-search endpoint.
         * Returns a ToolSearchResult with the reduced tool list and token counts.
         *
         * @param query   The user's current intent / task description.
         * @param options.maxTools Optional cap on returned tools.
         * @param options.context  Optional extra context for the gateway ranker.
         * @param options.workflow Override workflow label.
         * @param options.ranker   Optional ranking algorithm passed through to the
         *        gateway ("bm25" default, or "embeddings" when the gateway has an
         *        embedding provider wired). The SDK passes it through; it never
         *        computes similarity itself.
         */
        search: (query: string, options?: {
            maxTools?: number;
            context?: string;
            workflow?: string;
            ranker?: "bm25" | "embeddings";
            toolSessionId?: string;
        }) => Promise<ToolSearchResult>;
    };
    /**
     * Directly call the gateway's /sdk/v1/tool-search endpoint with the given catalog.
     * Use this when you manage the catalog outside of a tools() handle.
     */
    toolSearch(catalog: CaveTool[], query: string, options?: {
        maxTools?: number;
        context?: string;
        workflow?: string;
        ranker?: "bm25" | "embeddings";
        toolSessionId?: string;
    }): Promise<ToolSearchResult>;
    /**
     * Compress a payload through the Engine (`POST /sdk/v1/compress`), returning
     * the Engine's report. The SDK is **not** the compressor — it delegates and
     * maps the result; it never reimplements a compressor (that would fork
     * behavior across surfaces).
     *
     * **Byte-safe.** On any transport or parse problem the call passes through:
     * `output` is the original `payload` unchanged, `ratio` is `0`, and there is
     * no `recoveryHandle`. The SDK never rewrites bytes itself and never claims a
     * saving it did not get back from the Engine. `basis` is always `"inferred"`.
     *
     * Mirrors the Python `Cave.compress`.
     */
    compress(payload: string, options?: CompressOptions): Promise<CompressResult>;
    /**
     * Connected-only context selector. `pack()` POSTs caller-owned fragments to
     * `/sdk/v1/context/pack`; it never writes CCR and never runs in local wrap.
     * Omitted fragments are named by `deferredIds` so callers can re-supply them.
     *
     * This decides **what** enters the model window. Cache-optimal assembly
     * decides **where** selected content sits relative to a cache breakpoint;
     * they are complementary, not alternatives.
     */
    context: {
        pack: (query: string, items: ContextPackItem[], options: ContextPackOptions) => Promise<ContextPackResult>;
    };
    /**
     * Build a provider request with stable/session slots above every volatile
     * slot. Pure client-side: no account and no network call.
     *
     * Stability ledger is in-process. Cross-process determinism remains caller's
     * obligation. `emitCacheHints:"gateway"` (default) emits no provider cache
     * hint so gateway optimizer retains causal attribution. `"self"` is for
     * direct provider calls; it places hints but mints nothing.
     */
    assemble(options: AssembleOptions): AssemblyResult;
    /**
     * Read this project's Cave Plan machine-readably (`GET /sdk/v1/cave-plan`),
     * authed by the project key's `plan:read` scope. Returns the project-scope
     * plan verbatim — snake_case wire fields identical to control-api and the
     * Python `cave_plan()`. Every dollar figure is `inferred` and a PER-DAY rate;
     * the SDK never re-derives or re-projects them (no monthly, no `verified`).
     *
     * This is a gateway-owned project-key read, so it targets `baseURL` and
     * carries the `x-cave-api-key` project key. `controlURL` is reserved for
     * control-api `/api/v1/*` surfaces. On a non-200
     * it throws (mirrors {@link Cave.toolSearch}); there is no byte-safe
     * pass-through here (this reads state, it never touches request bytes).
     *
     * Mirrors the Python `Cave.cave_plan`.
     */
    cavePlan(): Promise<CavePlan>;
    prompts: {
        internalBrevity: ({ style, preserveErrorsVerbatim, preserveCodeVerbatim }: {
            style: "technical-concise" | "caveman" | "none";
            preserveErrorsVerbatim?: boolean;
            preserveCodeVerbatim?: boolean;
        }) => string;
    };
    /**
     * Session-keyed multi-agent shared context. One agent `put`s the full handoff
     * context under a session key (`POST /sdk/v1/shared-context`); a peer agent in the
     * same project `get`s it back byte-exact (`GET /sdk/v1/shared-context/{key}`). The
     * gateway is tenant-scoped — the project namespaces the key, so a peer in another
     * project cannot read it. Mirrors the Python `cave.shared_context`.
     */
    sharedContext: {
        put: (sessionKey: string, content: string) => Promise<Record<string, unknown>>;
        get: (sessionKey: string) => Promise<Record<string, unknown>>;
    };
    /**
     * A runtime-policy client for this project.
     *
     * Policies come from the project's published policy (delivered overlay), read
     * once per `refresh()` from `GET /sdk/v1/runtime-policy`. `decide()` is
     * synchronous and local-only — it never blocks a caller on the network, and a
     * missing/rejected bundle simply means the caller's own baseline path.
     *
     * This surface measures nothing and claims nothing: it routes work and emits
     * an optional observability span. Mirrors the Python `cave.runtime_policy()`.
     */
    runtimePolicy(options?: RuntimePolicyOptions): RuntimePolicyClient;
    /** Reserved async-job surface; methods fail locally without network I/O. */
    jobs: JobsClient;
    /**
     * A fresh retry-loop breaker that interrupts a repeated identical tool-call
     * loop after `threshold` consecutive repeats. Mirrors the Python
     * `Cave.retry_loop_breaker`.
     */
    retryLoopBreaker(threshold?: number): RetryLoopBreaker;
}
/** Thrown by {@link RetryLoopBreaker} when an identical tool call repeats past the threshold. */
export declare class RetryLoopError extends Error {
    readonly signature: string;
    readonly repeats: number;
    readonly threshold: number;
    constructor(signature: string, repeats: number, threshold: number);
}
/**
 * Detects and interrupts a repeated identical tool-call loop.
 *
 * Call `record()` (or `guard()`) before each tool invocation with the tool name
 * and arguments. When the SAME (name, arguments) signature repeats consecutively
 * more than `threshold` times, `record()` throws {@link RetryLoopError}. Any
 * different call resets the streak. Mirrors the Python `RetryLoopBreaker`
 * (same field names + threshold semantics: fires on the `threshold + 1`-th
 * consecutive identical call).
 */
export declare class RetryLoopBreaker {
    readonly threshold: number;
    private lastSignature;
    private repeats;
    constructor(threshold?: number);
    /** Canonical signature for a tool call (name + sorted-key JSON args). */
    signature(name: string, args: unknown): string;
    /**
     * Record a tool call. Throws {@link RetryLoopError} once an identical call has
     * repeated past the threshold. A different call resets the streak.
     */
    record(name: string, args: unknown): void;
    /** Record the call (may throw) then invoke `fn`. */
    guard<T>(name: string, args: unknown, fn: () => Promise<T> | T): Promise<T>;
    /** Clear the streak (e.g. when starting a new task). */
    reset(): void;
}
/** Scheduling hint for an async job. */
export type LatencyClass = "interactive" | "background" | "offline";
/** Reserved async-job result shape for future durable execution support. */
export type Job = {
    id: string;
    state: string;
    raw: Record<string, unknown>;
};
export declare class AsyncJobsUnavailableError extends Error {
    readonly code = "cave_async_jobs_unavailable";
    constructor();
}
/**
 * Reserved async-job surface. Every method fails locally before network I/O
 * until delayed requests have durable payload, credential, and worker support.
 * Mirrors Python `JobsClient` and prevents fake queued/completed work.
 */
export declare class JobsClient {
    constructor(_cave: Cave);
    submit(_body: Record<string, unknown>, _options?: {
        latencyClass?: LatencyClass;
    }): Promise<Job>;
    status(_id: string): Promise<Job>;
    cancel(_id: string): Promise<Record<string, unknown>>;
    wait(_id: string, _options?: {
        intervalMs?: number;
        timeoutMs?: number;
    }): Promise<Job>;
    submitAndWait(_body: Record<string, unknown>, _options?: {
        latencyClass?: LatencyClass;
        intervalMs?: number;
        timeoutMs?: number;
    }): Promise<Job>;
}
export declare class CaveTrace {
    private cave;
    private workflow;
    private tags;
    /** Trace id shared by every provider call and exported span in this trace (32 lowercase hex). */
    readonly traceId: string;
    /** Root span id of this trace; sent as `x-cave-parent-span-id` (16 lowercase hex). */
    readonly spanId: string;
    /** Publicly reachable exporter buffers, one per service name. */
    private readonly exporters;
    /** Per-trace tool start order. Completion order can differ under concurrency. */
    private toolSequence;
    constructor(cave: Cave, workflow: string, tags: Record<string, string>, traceId?: string, spanId?: string);
    /**
     * An OTel exporter bound to this trace: spans recorded without an explicit
     * `traceId` inherit this trace's, so SDK spans and the gateway's request rows
     * land in the same trace. Repeated calls for one service return the same
     * buffer, including runtime-policy decision spans, so callers can flush them.
     * Mirrors the Python `Trace.exporter`.
     */
    exporter(config?: {
        serviceName?: string;
    }): OTelExporter;
    tool<T>(name: string, options: ToolOptions, fn: () => Promise<T> | T): Promise<T>;
    /** Best-effort metadata only: telemetry must never replace a tool result/error. */
    private emitToolEvent;
    /** The continuity ids every provider call in this trace puts on the wire. */
    private traceContext;
    model: {
        openai: {
            responses: {
                create: (body: unknown, init?: {
                    cave?: {
                        latencyClass?: string;
                    };
                }) => Promise<any>;
            };
            chat: {
                completions: {
                    create: (body: unknown) => Promise<any>;
                };
            };
        };
    };
    artifacts: {
        page: (value: unknown, options: {
            source: string;
            contentType?: string;
            strategy: "verbatim" | "json-index" | "text-chunks" | "table-index" | "llm-summary";
            maxInlineTokens?: number;
        }) => Promise<unknown>;
        get: (artifactId: string) => Promise<unknown>;
    };
    context: {
        checkpoint: (messages: unknown[], options: Record<string, unknown>) => Promise<Record<string, unknown>>;
        /**
         * Reverse a checkpoint `source_ref` back into the original context.
         *
         * GETs `/sdk/v1/checkpoints/{sourceRef}/expand`; the gateway returns the
         * stored `{ source_ref, version, messages, checkpoint }`. This is the other
         * half of `checkpoint()` — reversibility is mandatory: a checkpoint that
         * cannot be expanded is a bug.
         */
        expand: (sourceRef: string) => Promise<Record<string, unknown>>;
    };
}
/** One AND-ed guard on a runtime policy (wire shape, verbatim snake_case). */
export type RuntimePolicyGuard = {
    field: string;
    op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | string;
    value?: unknown;
};
/** One experiment arm. `holdout` is a reserved name and never a declared arm. */
export type RuntimePolicyArm = {
    name: string;
    fraction: number;
};
/** Experiment attached to a runtime policy; absent means the policy applies to 100% post-guards. */
export type RuntimePolicyExperiment = {
    id: string;
    holdout_frac?: number;
    arms: RuntimePolicyArm[];
};
/**
 * A published runtime policy, verbatim from the project's delivered policy
 * (snake_case wire fields, like {@link CavePlan}). `verify`, `budget`, and
 * `escalation` are opaque to the SDK and passed straight back to the caller.
 */
export type RuntimePolicyDoc = {
    id: string;
    task_family: string;
    disabled?: boolean;
    applies_when?: RuntimePolicyGuard[];
    execute: {
        workflow: string;
    };
    fallback?: {
        workflow?: string | null;
    };
    verify?: string[];
    budget?: Record<string, unknown>;
    escalation?: Array<Record<string, unknown>>;
    experiment?: RuntimePolicyExperiment;
};
/** Why {@link RuntimePolicyClient.decide} landed where it did. Every non-`applied` reason is a fail-closed path. */
export type PolicyDecisionReason = "applied" | "holdout" | "guards_failed" | "disabled" | "kill" | "local_kill" | "policy_unavailable" | "no_policy" | "no_unit_key" | "invalid_policy" | "invalid_experiment" | "ambiguous_policy";
/**
 * The local routing decision for one task.
 *
 * `baseline` means the caller's own path (`workflow` is null); `fallback` means
 * the policy's declared fallback workflow. Nothing here is a savings claim.
 */
export type PolicyDecision = {
    decision: "execute" | "fallback" | "baseline";
    reason: PolicyDecisionReason;
    policyId: string | null;
    workflow: string | null;
    experimentId?: string;
    arm?: string;
    /** Probability this unit had of receiving the assigned arm (holdout included). */
    propensity?: number;
    budget?: Record<string, unknown>;
    verify?: string[];
    escalation?: Array<Record<string, unknown>>;
    policyVersion?: number;
    sequence?: number;
    /** True when the bundle in force was Ed25519-verified. */
    signed: boolean;
};
/** Options for {@link Cave.runtimePolicy}. */
export type RuntimePolicyOptions = {
    /** Base64 raw 32-byte Ed25519 key to pin. When set, an unsigned or mis-signed bundle is rejected. */
    publicKey?: string;
    /** Background refresh interval in seconds. Default off. */
    autoRefreshSeconds?: number;
    /** Environment variable checked at decide() time as a local kill switch. Default `CAVEMAN_POLICY_KILL`. */
    killEnv?: string;
};
/** Result of {@link RuntimePolicyClient.refresh}; never a thrown error. */
export type RuntimePolicyRefresh = {
    ok: boolean;
    signed: boolean;
    error?: string;
};
/** Snapshot of what the client currently holds. */
export type RuntimePolicyState = {
    hasBundle: boolean;
    signed: boolean;
    policyVersion?: number;
    sequence?: number;
    /** The bundle's own kill flag (true for pass-through `record` projects). */
    kill: boolean;
    /** True once `kill()` was called locally. */
    killedLocally: boolean;
};
/**
 * Anything that can buffer the decision span — i.e. `cave.exporter()` or
 * `trace.exporter()`. The span rides the exporter's existing batch; `decide()`
 * opens no new network path.
 */
export type PolicySpanRecorder = {
    recordSpan(name: string, options: SpanOptions): unknown;
};
/** What `decide()` accepts as a decision-span sink. */
export type PolicySpanSink = PolicySpanRecorder | CaveTrace;
/** Per-call inputs for {@link RuntimePolicyClient.decide}. */
export type DecideOptions = {
    /** Stable assignment unit (task id, case id, user id…). Required once a policy carries an experiment. */
    unitKey?: string | null;
    /** Values the policy's guards read. Missing field or type mismatch ⇒ that guard is false. */
    context?: Record<string, unknown> | null;
    /**
     * Optional span sink for the decision event (observability only). Prefer an
     * exporter you flush yourself (`cave.exporter()` / `trace.exporter()`); a
     * CaveTrace's default exporter is memoized and caller-reachable.
     */
    trace?: PolicySpanSink | null;
};
/**
 * Client for the project's published runtime policies.
 *
 * `refresh()` is the only network call; it verifies the bundle signature over
 * the exact bytes the server signed and keeps the last-known-good bundle on any
 * failure. `decide()` is synchronous, local-only, and never throws — with no
 * bundle it returns the caller's baseline. Mirrors the Python
 * `RuntimePolicyClient`.
 */
export declare class RuntimePolicyClient {
    private cave;
    private bundle;
    private signedBundle;
    private pinnedKey;
    private killedLocally;
    private timer;
    /** True while a `refresh()` is in flight; the background timer skips rather than pile on. */
    private refreshing;
    private readonly killEnv;
    constructor(cave: Cave, options?: RuntimePolicyOptions);
    /**
     * Fetch and verify the current bundle (`GET /sdk/v1/runtime-policy`).
     *
     * Never throws: a transport error, a bad signature, an unknown schema
     * version, or a regressed sequence returns `{ok:false, error}` and leaves the
     * previous bundle in force. The request is capped at 30s (matching the Python
     * `urlopen(..., timeout=30)`) so a hung endpoint cannot pin the caller open.
     */
    refresh(): Promise<RuntimePolicyRefresh>;
    /**
     * Route one task, locally and synchronously. No network, no throw — a garbage
     * context, a malformed policy, or a missing bundle all resolve to a
     * fail-closed decision.
     */
    decide(taskFamily: string, options?: DecideOptions): PolicyDecision;
    /** Latch this client off. Every later `decide()` returns the caller's baseline. */
    kill(): void;
    /** What the client currently holds. */
    state(): RuntimePolicyState;
    /** Release the optional background refresh timer. Mirrors the Python `close()`. */
    close(): void;
    private refreshFailed;
    /**
     * Verify the signature over the bundle string's exact UTF-8 bytes, before any
     * parsing. A pinned key (explicit or TOFU) makes a signature mandatory.
     *
     * The TOFU pin is stored the moment a signature cryptographically verifies —
     * BEFORE schema and sequence checks — so a bundle this client rejects for
     * being the wrong shape still establishes which key the project signs with.
     * Pinning after those checks would leave a downgrade window: reject the first
     * signed bundle on schema, then accept a later unsigned one.
     */
    private verifyBundle;
    private evaluate;
    private baseline;
    private forDoc;
    private bundleMeta;
    /** Observability only — one buffered span, no network, never fatal. */
    private emitDecisionSpan;
}
/**
 * The deterministic unit fraction in [0,1) used for experiment assignment,
 * byte-for-byte the Go Caveman-Cloud `shared/platform/sampling.Fraction`: SHA-256 over each
 * key prefixed by its 8-byte big-endian UTF-8 byte length, first 8 digest bytes
 * as a big-endian uint64, shifted right 11 and divided by 2^53.
 *
 * Exported so a caller can reproduce an assignment (and so the cross-language
 * fixtures can pin this port bit-for-bit). Mirrors the Python
 * `policy_unit_fraction`.
 */
export declare function policyUnitFraction(...keys: string[]): number;
export declare class CaveRequestError extends Error {
    readonly status: number;
    readonly path: string;
    constructor(status: number, path: string, message: string);
}
/**
 * One-call OTel exporter that ships spans to standard gateway OTLP/HTTP endpoint.
 *
 * Build with `cave.exporter()`. Record spans with `recordSpan()` (GenAI fields
 * are mapped to `gen_ai.*` semantic-convention attributes), then `export()`
 * POSTs the buffered batch to `{baseURL}/v1/traces` and clears the buffer.
 * No runtime deps: the OTLP/JSON payload is built by hand and sent with `fetch`.
 */
export declare class OTelExporter {
    private cave;
    readonly serviceName: string;
    private spans;
    private inflightSpans;
    private exportTail;
    /** Trace id inherited by spans recorded without an explicit `traceId`; set by `trace.exporter()`. */
    readonly defaultTraceId: string | undefined;
    constructor(cave: Cave, serviceName: string, defaultTraceId?: string);
    /** Number of spans buffered and not yet exported. */
    get pending(): number;
    /** A fresh 16-byte (32-hex) trace id. */
    newTraceId(): string;
    /** A fresh 8-byte (16-hex) span id. */
    newSpanId(): string;
    /**
     * Buffer a span, mapping GenAI fields to `gen_ai.*` attributes.
     * Returns the OTelSpan (with generated ids) so callers can chain child spans
     * via `parentSpanId: span.spanId`.
     */
    recordSpan(name: string, options?: SpanOptions): OTelSpan;
    /** Build the OTLP/JSON payload for the buffered spans (no network). */
    buildPayload(): Record<string, unknown>;
    private buildPayloadFor;
    /**
     * POST buffered spans to standard OTLP/HTTP `{baseURL}/v1/traces`.
     * Returns ExportTraceServiceResponse JSON. No-op when nothing is buffered.
     */
    export(): Promise<Record<string, unknown>>;
    private exportCurrentBatch;
    /** Alias for `export()`, matching common OTel exporter naming. */
    flush(): Promise<Record<string, unknown>>;
}
