import { type ToolSet } from 'ai';
import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
export interface CavemanOptions extends GateOptions, BudgetOptions {
    runtime: MiddlewareRuntime;
    scope: ScopeSource;
    logicalCallId?: string;
}
/** Public native middleware. It cannot attest an executable recovery registry, so compress mode reports
 * `recovery_unbound`; withCaveman is the entry point that compresses. */
export declare function createCavemanMiddleware(options: CavemanOptions): LanguageModelV4Middleware;
/** Complete native model/tool/callback bundle, and the ai-sdk entry point that compresses. Pass it to the native
 * generation or ToolLoopAgent API. The bundle and its tools table stay mutable in every mode; only the recovery tool is
 * frozen. Replacing it or its tools table, or removing the callbacks, leaves model calls recovery-free;
 * application-owned source tools stay native. Wrapping a bundle twice returns it unchanged. */
export declare function withCaveman<T extends {
    model: LanguageModelV4;
    tools?: ToolSet;
}>(input: T, options: CavemanOptions): T;
