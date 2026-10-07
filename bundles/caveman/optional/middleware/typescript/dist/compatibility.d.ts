import { type MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
declare const frameworks: {
    readonly ai: {
        readonly floor: "7.0.94";
        readonly high: "8";
        readonly tested: readonly ["7.0.94", "7.0.114"];
        readonly entry: "ai";
    };
    readonly openai: {
        readonly floor: "7.12.1";
        readonly high: "8";
        readonly tested: readonly ["7.12.1", "7.23.0"];
        readonly entry: "openai";
    };
    readonly '@anthropic-ai/sdk': {
        readonly floor: "0.124.0";
        readonly high: "0.129";
        readonly tested: readonly ["0.124.0", "0.125.0", "0.126.0", "0.127.0", "0.128.0"];
        readonly entry: "@anthropic-ai/sdk";
    };
    readonly '@google/genai': {
        readonly floor: "2.21.0";
        readonly high: "3";
        readonly tested: readonly ["2.21.0", "2.24.0"];
        readonly entry: "@google/genai";
    };
    readonly langchain: {
        readonly floor: "1.5.10";
        readonly high: "2";
        readonly tested: readonly ["1.5.10", "1.5.12"];
        readonly entry: "langchain";
    };
    readonly '@langchain/core': {
        readonly floor: "1.2.9";
        readonly high: "2";
        readonly tested: readonly ["1.2.9", "1.2.12"];
        readonly entry: "@langchain/core/messages";
    };
    readonly '@strands-agents/sdk': {
        readonly floor: "1.17.0";
        readonly high: "2";
        readonly tested: readonly ["1.17.0", "1.19.0"];
        readonly entry: "@strands-agents/sdk";
    };
    readonly '@mastra/core': {
        readonly floor: "1.65.0";
        readonly high: "2";
        readonly tested: readonly ["1.65.0", "1.70.0"];
        readonly entry: "@mastra/core/agent";
    };
    readonly '@modelcontextprotocol/sdk': {
        readonly floor: "1.30.0";
        readonly high: "2";
        readonly tested: readonly ["1.30.0", "1.30.1"];
        readonly entry: "@modelcontextprotocol/sdk/client/index.js";
    };
};
type Framework = keyof typeof frameworks;
declare const adapters: {
    readonly 'ai-sdk': {
        readonly id: "ai-sdk";
        readonly tier: "certified";
        readonly frameworks: readonly ["ai"];
    };
    readonly openai: {
        readonly id: "openai-sdk";
        readonly tier: "certified";
        readonly frameworks: readonly ["openai"];
    };
    readonly anthropic: {
        readonly id: "anthropic-sdk";
        readonly tier: "certified";
        readonly frameworks: readonly ["@anthropic-ai/sdk"];
    };
    readonly langchain: {
        readonly id: "langchain";
        readonly tier: "certified";
        readonly frameworks: readonly ["langchain", "@langchain/core"];
    };
    /** withCavemanModel, CavemanChatModel and CavemanDocumentCompressor. */
    readonly 'langchain-core': {
        readonly id: "langchain";
        readonly tier: "certified";
        readonly frameworks: readonly ["@langchain/core"];
    };
    readonly google: {
        readonly id: "google-sdk";
        readonly tier: "experimental";
        readonly frameworks: readonly ["@google/genai"];
    };
    readonly strands: {
        readonly id: "strands";
        readonly tier: "experimental";
        readonly frameworks: readonly ["@strands-agents/sdk"];
    };
    readonly mastra: {
        readonly id: "mastra";
        readonly tier: "experimental";
        readonly frameworks: readonly ["@mastra/core"];
    };
    readonly mcp: {
        readonly id: "mcp";
        readonly tier: "experimental";
        readonly frameworks: readonly ["@modelcontextprotocol/sdk"];
    };
};
export type AdapterName = keyof typeof adapters;
export interface FrameworkCompatibility {
    package: string;
    installed_version: string | null;
    supported_range: string;
    /** The range floor: the pinned merge-gate version. */
    tested_version: string;
    /** Every release this package's suite has passed. */
    tested_versions: readonly string[];
    /** One of `tested_versions`; not proof of every framework feature or production quality. */
    tested: boolean;
    compatible: boolean;
    reason: 'compatible' | 'unsupported_version' | 'version_unavailable';
    action: string;
}
export declare function frameworkVersion(name: Framework): string | null;
export declare function frameworkCompatible(name: Framework, version?: string | null): boolean;
export interface GateOptions {
    runtime: MiddlewareRuntime;
    /** Run against a known framework version outside the supported range (Decision 3). Test it first. */
    acceptFrameworkVersion?: boolean;
}
export type GateReason = 'unsupported_version' | 'version_unavailable';
/** Decision 3, at wrap time and never throwing. A known version outside the range declines unless accepted. An
 * unreadable version (bundled deploys) runs with a one-time `version_unverified` when `detect` finds the hooks the
 * adapter needs, else declines with `version_unavailable`. Strict mode surfaces a decline from ready()/preflight().
 * Returns the pass-through reason, or null to run. */
export declare function frameworkGate(adapter: AdapterName, options: GateOptions, detect?: () => boolean, versions?: Partial<Record<Framework, string | null>>): GateReason | null;
/** Read-only, content-free local check. Does not import optional frameworks or contact the compression runtime. An
 * unreadable version is reported here as `version_unavailable`; the adapter itself feature-detects at wrap time. */
export declare function inspectFrameworkCompatibility(adapter: AdapterName): {
    schema_version: 1;
    adapter: AdapterName;
    tier: 'certified' | 'experimental';
    compatible: boolean;
    frameworks: FrameworkCompatibility[];
};
export {};
