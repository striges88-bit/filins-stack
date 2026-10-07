import { MiddlewareRuntime, type ManifestItem, type Optimization, type RecoveryBinding, type RetrieveArgs, type Scope, type Usage } from '@caveman-ai/sdk/middleware';
/** This package's version, sent as `adapter.version`; a test pins it to package.json. */
export declare const MIDDLEWARE_VERSION = "1.0.0";
export interface Attempt {
    runtime: MiddlewareRuntime;
    scope: Scope;
    logicalCallId: string;
    attemptId: string;
    optimization: Optimization | null;
    wireSHA256: string | null;
    passive?: boolean;
    reason?: string;
    adapter?: string;
    reportedAttemptId?: string;
}
export declare const currentOwner: () => Attempt | undefined;
export declare function withOwner<T>(attempt: Attempt, fn: () => T): T;
export declare function observe(attempt: Attempt, event: 'dispatch_intent' | 'completed' | 'failed' | 'cancelled', usage?: Usage | null): void;
export declare function plain(value: unknown): value is Record<string, unknown>;
export interface BudgetOptions {
    /** Bound on history hashed into the context manifest (spec §11; default 2 MiB). The head window is sent; an
     * oversized history never skips the call. */
    manifestBytes?: number;
}
/** Spec §11 manifest: history items hashed in order up to `manifestBytes` and 4096 items, a head window that stays
 * prefix-stable as history grows. Parts that are not plain JSON (bytes, URLs, class instances, cycles) enter as
 * `{caveman_opaque: h}`; nothing here skips the call. `sequence` is the untruncated history length. */
export declare function manifest(items: readonly unknown[], manifestBytes?: number): Promise<{
    manifest: ManifestItem[];
    sequence: number;
}>;
/** A static scope, or a function called per request (inside the request's async context) so one shared client or
 * model can serve many users, and `deleteSession` can target one of them. */
export type ScopeSource<C = void> = Scope | ((context: C) => Scope | null | undefined);
/** Spec §9 for framework-provided IDs, never throwing. A valid value comes back normalized (an email or
 * `user 42 / chat #7` becomes an `h-` hash). null means no scope was supplied (missing, or the resolver threw): the
 * call runs recovery-free as `recovery_unbound`. An unnormalizable value is returned as-is so optimize() reports
 * `invalid_scope` (raising only in strict mode). */
export declare function resolveScope<C>(source: ScopeSource<C>, context: C): Scope | null;
/** A recovery binding only for a normalizable scope, so the strict-mode `invalid_scope` throw of recovery() never
 * happens at wrap time; optimize() reports it per call instead. */
export declare function bindRecovery(runtime: MiddlewareRuntime, scope: Scope | null): RecoveryBinding | null;
/** A report-only attempt: the native call gets its original input and the report carries `reason`. */
export declare function passiveAttempt(runtime: MiddlewareRuntime, adapter: string, reason: string, logicalCallId?: string): Attempt;
/** C14: the host already has a tool named caveman_retrieve. Recovery stays off, compress-mode calls pass through
 * reporting `recovery_name_conflict`, and strict mode raises it from ready(). */
export declare function nameConflict(runtime: MiddlewareRuntime, adapter: string): 'recovery_name_conflict';
/** TS-1: a recovery the runtime refuses (unknown or expired handle, runtime down) answers the model `{error: code}`
 * with a warn-once instead of failing the host's native tool loop. Caller aborts and non-SDK errors propagate.
 * `input` is model output: anything but an object with a string handle (`null`, a list, a string) is answered
 * `{error: 'invalid_request'}` before the runtime sees it. */
export declare function recoveryResult<T>(adapter: string, signal: AbortSignal | null | undefined, input: unknown, retrieve: (args: RetrieveArgs) => Promise<T>): Promise<T | {
    error: string;
}>;
/** C7: an entry point that cannot bind the recovery tool leaves compress mode `recovery_unbound` on every call. Say so
 * once, naming the entry point that does compress. */
export declare function hintRecovery(runtime: MiddlewareRuntime, adapter: string, entry: string, use: string): void;
/** Read exactly when the native consumer pulls. Never eagerly drain a stream. */
export declare function observeStream<T>(stream: ReadableStream<T>, attempt: Attempt, getUsage: (event: T) => Usage | null, signal?: AbortSignal): ReadableStream<T>;
