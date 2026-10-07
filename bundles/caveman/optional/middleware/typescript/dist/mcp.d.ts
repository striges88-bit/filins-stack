import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { MiddlewareRuntime, type ManifestItem } from '@caveman-ai/sdk/middleware';
import { type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
/** A native MCP definition and the callable actually registered in the host. */
export interface MCPToolBinding {
    tool: Tool;
    execute: (arguments_: Record<string, unknown>, options?: Parameters<Client['callTool']>[2]) => Promise<CallToolResult>;
}
/** Preserve the existing client's transport, IDs, auth and result validation. */
export declare function bindMCPTool(client: Client, tool: Tool): MCPToolBinding;
export interface MCPHostOptions extends GateOptions {
    runtime: MiddlewareRuntime;
    /** A scope, or a function called per result so one host can serve many users. */
    scope: ScopeSource;
    serverId: string;
    protocolVersion: string;
}
/** **Experimental tier.** Native host views only. No MCP framing, server or inference loop is added. */
export declare class CavemanMCPHost {
    private readonly options;
    readonly recovery: MCPToolBinding;
    private readonly adapter;
    private readonly recoveryExecutor;
    private readonly recoveryDefinition;
    /** Why every result passes through unchanged, or null. */
    private readonly blocked;
    constructor(options: MCPHostOptions);
    register(tools: readonly MCPToolBinding[]): MCPToolBinding[];
    /** Persist the original result; pass only this copied view to the model.
     * The host supplies its original append-only context manifest across resumes.
     * Final provider serialization and dispatch are outside this result boundary. */
    projectResult(result: CallToolResult, options: {
        tool: Tool;
        callId: string;
        contextManifest: readonly ManifestItem[];
        registeredTools?: readonly MCPToolBinding[];
        sequence?: number;
        signal?: AbortSignal;
    }): Promise<CallToolResult>;
    private project;
}
