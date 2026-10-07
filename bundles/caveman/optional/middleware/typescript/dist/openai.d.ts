import type OpenAI from 'openai';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
import { type FetchOptions } from './transport.js';
export interface OpenAIOptions extends GateOptions, BudgetOptions, Pick<FetchOptions, 'wireBytes' | 'allowStoredResponses'> {
    runtime: MiddlewareRuntime;
    /** A scope, or a function called per request so one shared client can serve many users. */
    scope: ScopeSource;
    /** The fetch function used to construct the original client. Default: the client's own. */
    fetch?: typeof globalThis.fetch;
    cavemanProxy?: boolean;
}
type Functions = Readonly<Record<string, (input: unknown) => unknown | Promise<unknown>>>;
export interface OpenAIToolLoop<T extends OpenAI, Tool> {
    readonly client: T;
    /** A fresh native definition list; changing it cannot change registration. */
    readonly tools: Tool[];
    /** Use this immutable table for every application-owned function dispatch. */
    readonly functions: Functions;
}
type ChatFunction = OpenAI.Chat.Completions.ChatCompletionFunctionTool;
type ResponseFunction = OpenAI.Responses.FunctionTool;
export declare function withCavemanOpenAITools<T extends OpenAI>(client: T, options: OpenAIOptions & {
    protocol: 'openai-chat';
    tools: ChatFunction[];
    functions: Functions;
}): OpenAIToolLoop<T, ChatFunction>;
export declare function withCavemanOpenAITools<T extends OpenAI>(client: T, options: OpenAIOptions & {
    protocol: 'openai-responses';
    tools: ResponseFunction[];
    functions: Functions;
}): OpenAIToolLoop<T, ResponseFunction>;
/** A native withOptions clone; APIPromise, parsers, streams and runners survive. `chat.completions.runTools`
 * compresses; plain `create` calls cannot bind the recovery tool and report `recovery_unbound` (hinted once, on use). */
export declare function withCavemanOpenAI<T extends OpenAI>(client: T, options: OpenAIOptions): T;
export { createCavemanFetch } from './transport.js';
