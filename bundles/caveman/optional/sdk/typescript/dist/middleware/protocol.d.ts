import type { BreakerParams, BreakerState, BudgetItem, BudgetResult, FailureInput, FailureOutcome, OpaqueManifestValue, ReasonPolicy, Scope } from './types.js';
export declare const reasonPolicy: (code: string) => ReasonPolicy | undefined;
/** Spec §9: a valid scope token passes unchanged; any other well-formed string becomes `h-` + 32 hex of its SHA-256; else null. */
export declare function normalizeScopeToken(value: unknown): string | null;
/** Spec §9: namespace and session_id are required; branch_id / cache_epoch default when absent or null. */
export declare function normalizeScope(input: unknown): Scope | null;
/** Spec §6 step 6 for an error code already extracted from a response (status 0: raised by a transport). */
export declare function codeOutcome(code: string, status?: number, retryAfterMs?: number | null): FailureOutcome;
/** Spec §6 client classification. Outcomes derive from `error.code`, not the status, so mixed 1.0/1.1 fleets agree. */
export declare function classifyFailure(input: FailureInput): FailureOutcome;
/** Spec §10 breaker: opens on 5 consecutive failures or 10 of the last 20 outcomes, stays open 30 s, then admits one probe. */
export declare class CircuitBreaker {
    #private;
    readonly params: Readonly<BreakerParams>;
    constructor(params?: Readonly<BreakerParams>);
    get state(): BreakerState;
    /** Call immediately before a call's first network request. False means bypass with `circuit_open`. */
    allow(nowMs: number): boolean;
    /** Exactly one outcome per admitted call: `failure` iff its reason counts toward the breaker. */
    record(result: 'success' | 'failure', nowMs: number): void;
    /** An admitted call that ended with no outcome of its own (caller abort, or it only waited on another call's
     * capabilities fetch): records nothing, but frees the half-open probe slot so the next call can probe. */
    release(): void;
}
/** Spec §10: optimize = override, else capabilities `deadline_ms` (capped at 5000), else 500; retrieve/delete =
 * override, else `retrieve_deadline_ms` (capped at 30000), else 5000. Every result is capped at 2**31 - 1 ms, the
 * largest delay setTimeout honors. */
export declare function resolveDeadlines(options: {
    readonly deadlineMs?: number | null | undefined;
    readonly retrieveDeadlineMs?: number | null | undefined;
}, limits?: {
    readonly deadline_ms?: unknown;
    readonly retrieve_deadline_ms?: unknown;
} | null): {
    optimizeMs: number;
    retrieveMs: number;
};
/** Spec §11: previously replaced keys first (input order), then newest first; first-fit; results in input order. */
export declare function planBudget(items: readonly BudgetItem[], limits: {
    readonly maxSegments: number;
    readonly maxBytes: number;
}, replaced?: Iterable<string>): BudgetResult;
/** Spec §11: the largest head length k with k <= maxItems and sum(sizes[0..k)) <= maxBytes. */
export declare function manifestWindow(sizes: readonly number[], maxItems: number, maxBytes: number): number;
/** Spec §11: manifest stand-in for an image/bytes part. Never a reason to bypass. */
export declare function opaqueManifestValue(value: unknown): Promise<OpaqueManifestValue>;
/** Spec §15: the base URL (prefix preserved, trailing `/`) that routes are appended to. Throws MiddlewareError with
 * `invalid_endpoint`, `remote_content_not_enabled` or `insecure_transport_not_enabled`. Strict: whitespace or control
 * characters anywhere, percent-encoding, userinfo, query, fragment, an empty or leading-zero port and numeric host
 * shorthands are all `invalid_endpoint`. Scheme and host are lowercased; nothing else is rewritten. */
export declare function resolveEndpoint(endpoint: unknown, options?: {
    readonly allowRemoteContent?: boolean | undefined;
    readonly allowInsecureTransport?: boolean | undefined;
}): string;
/** Spec §15: the proxy for `url` from http(s)_proxy / no_proxy (lowercase wins, empty = unset), else null. */
export declare function resolveProxy(url: string, env: Readonly<Record<string, string | undefined>>): string | null;
/** One `console.warn` per (adapter, reason) per process, bounded at 1024 pairs; returns whether it logged. The line
 * carries only `adapter=<id or ->` and `reason=<code>`: never content, scope values, handles or credentials.
 * `message` replaces the lead-in for a caller whose failure is not a pass-through (a refused recovery read) and is
 * deduplicated apart from the same reason's pass-through line. */
export declare function warnOnce(adapter: unknown, reason: unknown, message?: string): boolean;
