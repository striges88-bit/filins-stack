import { BaseChatModel, type BaseChatModelCallOptions, type BindToolsInput } from '@langchain/core/language_models/chat_models';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { BaseMessage, AIMessageChunk, type UsageMetadata } from '@langchain/core/messages';
import { type RunnableConfig } from '@langchain/core/runnables';
import type { ChatResult } from '@langchain/core/outputs';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import type { DocumentInterface } from '@langchain/core/documents';
import type { MiddlewareRuntime, RecoveryBinding, Scope, Usage } from '@caveman-ai/sdk/middleware';
import { type Attempt, type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
/** A scope, or a function of the run's RunnableConfig (e.g. `config => scopeFromConfig(config, 'app')`). */
export type LangChainScope = ScopeSource<RunnableConfig>;
export interface LangChainOptions extends GateOptions, BudgetOptions {
    runtime: MiddlewareRuntime;
    scope: LangChainScope;
}
export declare const langChainAdapter: {
    id: string;
    version: string;
    framework_version: string;
    serialization_revision: string;
};
/** LangGraph scope from `configurable.thread_id`. Throws without one; adapters catch that and run the call
 * recovery-free (`recovery_unbound`). Any thread_id text works: it is normalized per spec §9. */
export declare function scopeFromConfig(config: RunnableConfig, namespace: string): Scope;
/** Never throws: null when no scope could be resolved (see resolveScope). */
export declare function resolveLangChainScope(source: LangChainScope, config?: RunnableConfig): Scope | null;
export declare function langChainUsage(value: UsageMetadata | undefined): Usage | null;
/** Clone only native ToolMessage text. Other message classes stay identical. */
export declare function prepareLangChain(messages: BaseMessage[], options: LangChainOptions, config?: RunnableConfig, binding?: RecoveryBinding | null, prefix?: BaseMessage[], blocked?: string | null): Promise<{
    messages: BaseMessage[];
    attempt: Attempt | null;
}>;
/** Public BaseChatModel delegate; provider configuration lives on inner only. It cannot bind the recovery tool, so
 * compress mode reports `recovery_unbound`; withCavemanAgent is the LangChain entry point that compresses. */
export declare class CavemanChatModel<Options extends BaseChatModelCallOptions = BaseChatModelCallOptions> extends BaseChatModel<Options> {
    readonly inner: BaseChatModel<Options>;
    readonly caveman: LangChainOptions;
    withStructuredOutput: BaseChatModel<Options>['withStructuredOutput'];
    private readonly blocked;
    constructor(inner: BaseChatModel<Options>, caveman: LangChainOptions);
    _llmType(): string;
    /** The inner model's capabilities (structured output, context size), which createAgent reads. */
    get profile(): import("@langchain/core/language_models/profile").ModelProfile;
    private project;
    bindTools(tools: BindToolsInput[], kwargs?: Partial<Options>): ReturnType<NonNullable<BaseChatModel<Options>["bindTools"]>>;
    invoke(input: BaseLanguageModelInput, config?: Partial<Options>): Promise<AIMessageChunk>;
    stream(input: BaseLanguageModelInput, config?: Partial<Options>): Promise<IterableReadableStream<AIMessageChunk>>;
    _generate(input: BaseMessage[], options: this['ParsedCallOptions']): Promise<ChatResult>;
}
export declare function withCavemanModel<Options extends BaseChatModelCallOptions>(model: BaseChatModel<Options>, options: LangChainOptions): BaseChatModel<Options>;
export interface LangChainDocumentOptions extends LangChainOptions {
    /** The runtime-owned reader already registered by the application for this scope. */
    sourceExpansion?: RecoveryBinding;
}
/** RAG-only native compressor. Source expansion is required for lossy use. */
export declare class CavemanDocumentCompressor extends BaseDocumentCompressor {
    private readonly options;
    private readonly blocked;
    constructor(options: LangChainDocumentOptions);
    compressDocuments(documents: DocumentInterface[], _query: string): Promise<DocumentInterface[]>;
}
