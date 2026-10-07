import type { ProcessLLMRequestArgs, Processor } from '@mastra/core/processors';
import type { Agent } from '@mastra/core/agent';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
export interface CavemanMastraOptions extends GateOptions, BudgetOptions {
    runtime: MiddlewareRuntime;
    /** Resolve from the application's authenticated RequestContext, never model input. */
    scope: ScopeSource<Pick<ProcessLLMRequestArgs, 'requestContext'>>;
    /** Model-only callers can opt out of adding a recovery executor. */
    recovery?: boolean;
    /** Supply a distinct ID when an application installs multiple processors. */
    id?: string;
}
/** Observe native calls without installing a lossy recovery grant, so compress mode reports `recovery_unbound`. For
 * native executable-tool attestation use withCavemanMastra, which owns the final hook and compresses. */
export declare function createCavemanMastraProcessor(options: CavemanMastraOptions): Processor;
/** Wrap an existing Agent's public entry points. Each call keeps its native
 * processors and prepareStep callback, then attests the executable tool table
 * at Mastra's enforced final prepareStep boundary. No Agent config is mutated. */
export declare function withCavemanMastra<T extends Agent>(agent: T, options: CavemanMastraOptions): T;
