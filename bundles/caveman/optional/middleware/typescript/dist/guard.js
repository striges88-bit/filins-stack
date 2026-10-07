import { MiddlewareError, warnOnce } from '@caveman-ai/sdk/middleware';
/** Decision 4, the one fail-open boundary for adapter code (including hooks on framework internals). An exception
 * becomes `fallback()`, the caller's own input, with a one-time `adapter_error` warning; the native call still runs.
 * Caller cancellation and SDK errors propagate; strict mode raises any other exception as `adapter_error` (spec §8). */
export async function guard(runtime, adapter, signal, work, fallback) {
    try {
        return await work();
    }
    catch (error) {
        if (signal?.aborted || error instanceof MiddlewareError)
            throw error;
        if (runtime.strict)
            throw Object.assign(new MiddlewareError('adapter_error'), { cause: error });
        warnOnce(adapter, 'adapter_error');
        return fallback();
    }
}
/** Synchronous twin of guard() for wrap-time hooks and native method replacement. On the request path strict mode
 * raises `adapter_error` like guard(); at wrap time (`wrapping`) nothing raises (spec §8), so the adapter declines
 * instead and strict ready() raises it. An SDK error always propagates. */
export function guardSync(runtime, adapter, work, fallback, wrapping = false) {
    try {
        return work();
    }
    catch (error) {
        if (error instanceof MiddlewareError)
            throw error;
        if (runtime.strict && !wrapping)
            throw Object.assign(new MiddlewareError('adapter_error'), { cause: error });
        if (wrapping)
            runtime.decline('adapter_error', adapter);
        else
            warnOnce(adapter, 'adapter_error');
        return fallback();
    }
}
