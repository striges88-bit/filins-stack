import { MiddlewareRuntime, type RecoveryBinding, type Scope } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
/** `owner` is the Caveman fetch of the one client whose calls this context covers: a nested call made on another
 * client (a tool calling a second client on the same runtime) resolves its own scope instead of inheriting it. */
export interface RecoveryContext {
    runtime: MiddlewareRuntime;
    scope: Scope;
    binding: RecoveryBinding;
    overhead: string;
    logicalCallId: string;
    isRegistered?: () => boolean;
    owner?: unknown;
}
/** An invocation whose recovery tool could not be registered: its calls pass through reporting `reason`. */
export interface UnboundContext {
    runtime: MiddlewareRuntime;
    reason: string;
    logicalCallId: string;
    owner?: unknown;
}
export declare function withNativeRecovery<T>(context: RecoveryContext | UnboundContext, run: () => T): T;
export interface FetchOptions extends BudgetOptions {
    runtime: MiddlewareRuntime;
    /** A scope, or a function called per request so one shared client can serve many users. */
    scope: ScopeSource;
    /** Preserve the exact fetch implementation already selected by the host. Default: the global fetch at call time. */
    fetch?: typeof globalThis.fetch;
    providerBaseURL: string;
    provider: 'openai' | 'anthropic' | 'google';
    frameworkVersion: string;
    /** Explicit middleware ownership on a discovered Caveman inference route. */
    cavemanProxy?: boolean;
    /** Untested SDKs retain only a native transport delegate and local reports. */
    passiveReason?: string;
    /** Request bodies larger than this (UTF-16 units, default 16 MiB) pass through with `payload_budget`. */
    wireBytes?: number;
    /** Compress OpenAI Responses turns that OpenAI stores (`store` not false). Off by default: the compressed turn would
     * persist provider-side (`provider_state_retained`). */
    allowStoredResponses?: boolean;
    /** Called on a compress-mode call that no recovery context covers, the path that cannot compress. */
    onUnbound?: () => void;
}
/** The fetch a client was built with (a private SDK field, so read defensively), else the global one: omitting the
 * `fetch` option keeps the client's own transport. */
export declare function clientFetch(client: unknown): typeof globalThis.fetch;
/** Fetch injection retains SDK-native promises, parsers, streams and retries. */
export declare function createCavemanFetch(options: FetchOptions): typeof globalThis.fetch;
