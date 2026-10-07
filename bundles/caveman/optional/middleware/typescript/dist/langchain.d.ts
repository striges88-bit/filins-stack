import { type AgentMiddleware } from 'langchain';
import { type ClientTool, type ServerTool } from '@langchain/core/tools';
import type { JSONSchema } from '@langchain/core/utils/json_schema';
import { type GateReason } from './compatibility.js';
import { type LangChainOptions } from './langchain-model.js';
export * from './langchain-model.js';
/** C11: agent entries use `langchain` + `@langchain/core`; model and document entries use `@langchain/core` only. */
export declare function langChainGate(options: LangChainOptions, entry: 'langchain' | 'langchain-core'): GateReason | null;
/** Low-level native middleware plus a real native recovery tool. */
export declare function createCavemanLangChain(options: LangChainOptions): {
    middleware: AgentMiddleware<undefined, undefined, unknown, readonly (ClientTool | ServerTool)[], readonly []>;
    recoveryTool: import("langchain").DynamicStructuredTool<JSONSchema, unknown, unknown, string, unknown, "caveman_retrieve">;
    blocked: GateReason | null;
};
/** Native createAgent options; the LangChain entry point that compresses. No new loop. */
export declare function withCavemanAgent<T extends {
    tools?: (ClientTool | ServerTool)[];
    middleware?: AgentMiddleware[];
}>(input: T, options: LangChainOptions): T & {
    tools: (ClientTool | ServerTool)[];
    middleware: AgentMiddleware[];
};
