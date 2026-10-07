import { Model, Message, FunctionTool, type AgentConfig, type BaseModelConfig, type StreamOptions, type CountTokensOptions, type ModelStreamEvent, type LocalAgent, type Plugin } from '@strands-agents/sdk';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions, type GateReason } from './compatibility.js';
export type StrandsScope = ScopeSource<LocalAgent>;
export interface StrandsOptions extends GateOptions, BudgetOptions {
    runtime: MiddlewareRuntime;
    scope: StrandsScope;
}
/** Native streamAggregated and agent orchestration remain in Strands. */
export declare class CavemanStrandsModel<T extends BaseModelConfig = BaseModelConfig> extends Model<T> {
    readonly inner: Model<T>;
    readonly options: StrandsOptions;
    registration: StrandsRegistration | null;
    readonly blocked: GateReason | null;
    constructor(inner: Model<T>, options: StrandsOptions);
    get stateful(): boolean;
    updateConfig(config: T): void;
    getConfig(): T;
    countTokens(messages: Message[], options?: CountTokensOptions): Promise<number>;
    /** A dynamic scope needs the agent from withCavemanStrands; without it the call is recovery_unbound. */
    private scope;
    private prepare;
    private project;
    stream(messages: Message[], options?: StreamOptions): AsyncGenerator<ModelStreamEvent>;
}
declare class StrandsRegistration implements Plugin {
    readonly options: StrandsOptions;
    readonly name = "caveman:middleware";
    agent: WeakRef<LocalAgent> | null;
    readonly recoveryTool: FunctionTool;
    constructor(options: StrandsOptions);
    initAgent(agent: LocalAgent): void;
    bound(options: StreamOptions): boolean;
}
/** Model-only wrapper. It cannot register the recovery tool, so compress mode reports `recovery_unbound`;
 * withCavemanStrands is the Strands entry point that compresses. */
export declare function withCavemanStrandsModel<T extends BaseModelConfig>(model: Model<T>, options: StrandsOptions): Model<T>;
export declare function withCavemanStrands(input: AgentConfig & {
    model: Model;
}, options: StrandsOptions): AgentConfig;
export {};
