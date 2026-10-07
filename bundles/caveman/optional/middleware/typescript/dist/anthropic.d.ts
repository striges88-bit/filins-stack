import type Anthropic from '@anthropic-ai/sdk';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
import { type FetchOptions } from './transport.js';
export interface AnthropicOptions extends GateOptions, BudgetOptions, Pick<FetchOptions, 'wireBytes'> {
    runtime: MiddlewareRuntime;
    /** A scope, or a function called per request so one shared client can serve many users. */
    scope: ScopeSource;
    /** The same fetch implementation selected for the existing client. Default: the client's own. */
    fetch?: typeof globalThis.fetch;
    cavemanProxy?: boolean;
}
/** Messages and stream helpers remain native. `beta.messages.toolRunner` owns execution and is the entry point that
 * compresses; `messages.create`/`stream` cannot bind the recovery tool and report `recovery_unbound` (hinted once, on use). */
export declare function withCavemanAnthropic<T extends Anthropic>(client: T, options: AnthropicOptions): T;
