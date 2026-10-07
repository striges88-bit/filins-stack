import { type MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
/** Decision 4, the one fail-open boundary for adapter code (including hooks on framework internals). An exception
 * becomes `fallback()`, the caller's own input, with a one-time `adapter_error` warning; the native call still runs.
 * Caller cancellation and SDK errors propagate; strict mode raises any other exception as `adapter_error` (spec §8). */
export declare function guard<T>(runtime: MiddlewareRuntime, adapter: string, signal: AbortSignal | null | undefined, work: () => T | Promise<T>, fallback: () => T): Promise<T>;
/** Synchronous twin of guard() for wrap-time hooks and native method replacement. On the request path strict mode
 * raises `adapter_error` like guard(); at wrap time (`wrapping`) nothing raises (spec §8), so the adapter declines
 * instead and strict ready() raises it. An SDK error always propagates. */
export declare function guardSync<T>(runtime: MiddlewareRuntime, adapter: string, work: () => T, fallback: () => T, wrapping?: boolean): T;
