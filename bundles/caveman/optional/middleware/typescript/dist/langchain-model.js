import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, ToolMessage, coerceMessageLikeToMessage, isAIMessage, isAIMessageChunk } from '@langchain/core/messages';
import { RunnableLambda, ensureConfig } from '@langchain/core/runnables';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import { MIDDLEWARE_VERSION, currentOwner, hintRecovery, manifest, observe, passiveAttempt, plain, resolveScope, withOwner } from './common.js';
import { frameworkGate, frameworkVersion } from './compatibility.js';
import { guard } from './guard.js';
// The serialized messages are @langchain/core's, and this module never loads `langchain`.
export const langChainAdapter = { id: 'langchain', version: MIDDLEWARE_VERSION, framework_version: frameworkVersion('@langchain/core') ?? 'unknown', serialization_revision: 'langchain-message-v1' };
/** LangGraph scope from `configurable.thread_id`. Throws without one; adapters catch that and run the call
 * recovery-free (`recovery_unbound`). Any thread_id text works: it is normalized per spec §9. */
export function scopeFromConfig(config, namespace) {
    const c = config.configurable ?? {};
    if (typeof c.thread_id !== 'string' || !c.thread_id)
        throw new Error('LangGraph middleware requires configurable.thread_id');
    if (c.caveman_branch_id !== undefined && typeof c.caveman_branch_id !== 'string')
        throw new Error('Invalid caveman_branch_id');
    if (c.caveman_cache_epoch !== undefined && typeof c.caveman_cache_epoch !== 'string')
        throw new Error('Invalid caveman_cache_epoch');
    return { namespace, session_id: c.thread_id, branch_id: c.caveman_branch_id ?? 'main', cache_epoch: c.caveman_cache_epoch ?? '0' };
}
/** Never throws: null when no scope could be resolved (see resolveScope). */
export function resolveLangChainScope(source, config) {
    return resolveScope(source, ensureConfig(config));
}
const number = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function langChainUsage(value) {
    if (!value)
        return null;
    const input = number(value.input_tokens), output = number(value.output_tokens);
    return { provenance: 'client_observed_sdk', complete: input !== null && output !== null, input_tokens: input, output_tokens: output,
        cache_read_tokens: number(value.input_token_details?.cache_read), cache_write_tokens: number(value.input_token_details?.cache_creation), reasoning_tokens: number(value.output_token_details?.reasoning) };
}
// C6: `lc_name` is a string the class defines itself, so it survives minification and excludes subclasses that would
// lose their own fields when rebuilt. Another installed copy of @langchain/core still qualifies.
const nativeToolMessage = (message) => {
    const native = Object.getPrototypeOf(message)?.constructor;
    return ToolMessage.isInstance(message) && !!native && Object.hasOwn(native, 'lc_name') && native.lc_name() === 'ToolMessage';
};
/** C12: rebuild from explicit fields; spreading the instance would copy `lc_kwargs`, which still holds the original. */
function projectedToolMessage(message, content) {
    const NativeToolMessage = Object.getPrototypeOf(message).constructor;
    const fields = { content, tool_call_id: message.tool_call_id, name: message.name, id: message.id, status: message.status, artifact: message.artifact,
        metadata: message.metadata, additional_kwargs: message.additional_kwargs, response_metadata: message.response_metadata };
    return new NativeToolMessage(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)));
}
/** Clone only native ToolMessage text. Other message classes stay identical. */
export async function prepareLangChain(messages, options, config, binding, prefix = [], blocked = null) {
    const signal = config?.signal;
    signal?.throwIfAborted();
    if (currentOwner())
        return { messages, attempt: null };
    const passive = (reason) => ({ messages, attempt: passiveAttempt(options.runtime, 'langchain', reason) });
    if (options.runtime.mode === 'off')
        return passive('disabled');
    if (blocked)
        return passive(blocked);
    const scope = resolveLangChainScope(options.scope, config);
    if (!scope)
        return passive('recovery_unbound');
    return guard(options.runtime, 'langchain', signal, async () => {
        const context = await manifest([...prefix, ...messages].map(m => m.toDict()), options.manifestBytes);
        const names = new Map();
        for (const message of messages)
            if (isAIMessage(message))
                for (const call of message.tool_calls ?? [])
                    if (call.id)
                        names.set(call.id, call.name);
        const candidates = [], setters = new Map();
        messages.forEach((message, mi) => {
            if (!nativeToolMessage(message) || message.name === 'caveman_retrieve' || names.get(message.tool_call_id) === 'caveman_retrieve' || message.status === 'error')
                return;
            if (!message.name && !names.has(message.tool_call_id))
                return;
            const add = (text, pi) => {
                if (typeof text !== 'string')
                    return;
                const id = `message-${mi}.part-${pi ?? 0}`;
                candidates.push({ id, sourceId: id, content: text });
                setters.set(id, { mi, pi });
            };
            if (typeof message.content === 'string')
                add(message.content, null);
            else
                message.content.forEach((part, pi) => { if (plain(part) && part.type === 'text' && !('citations' in part))
                    add(part.text, pi); });
        });
        const attempt = { runtime: options.runtime, scope, logicalCallId: crypto.randomUUID(), attemptId: crypto.randomUUID(), optimization: null, wireSHA256: null, adapter: 'langchain' };
        const optimization = await options.runtime.optimize({ scope, adapter: langChainAdapter, ...context, candidates, binding: binding ?? null,
            ...(binding ? { recoveryOverheadText: JSON.stringify({ name: binding.name, description: binding.description, input_schema: binding.inputSchema }) } : {}),
            logicalCallId: attempt.logicalCallId, attemptId: attempt.attemptId, ...(signal ? { signal } : {}), });
        if (!optimization.replacements.every(r => setters.has(r.segment_id))) {
            attempt.reason = 'invalid_plan';
            return { messages, attempt };
        }
        const result = messages.slice();
        for (const replacement of optimization.replacements) {
            const { mi, pi } = setters.get(replacement.segment_id), message = result[mi];
            let content = replacement.text;
            if (pi !== null && Array.isArray(message.content)) {
                const parts = message.content.slice();
                parts[pi] = { ...parts[pi], text: replacement.text };
                content = parts;
            }
            result[mi] = projectedToolMessage(message, content);
        }
        attempt.optimization = optimization;
        return { messages: optimization.replacements.length ? result : messages, attempt };
    }, () => passive('adapter_error'));
}
function messages(input) {
    if (typeof input === 'string')
        return [new HumanMessage(input)];
    if (Array.isArray(input))
        return input.map(coerceMessageLikeToMessage);
    return input.toChatMessages();
}
/** Public BaseChatModel delegate; provider configuration lives on inner only. It cannot bind the recovery tool, so
 * compress mode reports `recovery_unbound`; withCavemanAgent is the LangChain entry point that compresses. */
export class CavemanChatModel extends BaseChatModel {
    inner;
    caveman;
    withStructuredOutput;
    blocked;
    constructor(inner, caveman) {
        super({});
        this.inner = inner;
        this.caveman = caveman;
        this.blocked = frameworkGate('langchain-core', caveman, () => typeof ToolMessage.isInstance === 'function');
        if (!this.blocked)
            hintRecovery(caveman.runtime, 'langchain', 'withCavemanModel/CavemanChatModel', 'withCavemanAgent');
        this.withStructuredOutput = ((...args) => this.project().pipe(inner.withStructuredOutput(...args)));
    }
    _llmType() { return this.inner ? this.inner._llmType() : 'caveman'; }
    /** The inner model's capabilities (structured output, context size), which createAgent reads. */
    get profile() { return this.inner ? this.inner.profile : super.profile; }
    project() {
        return RunnableLambda.from(async (input, config) => {
            const prepared = await prepareLangChain(messages(input), this.caveman, config, null, [], this.blocked);
            if (prepared.attempt) {
                const attempt = prepared.attempt;
                attempt.runtime.report(attempt.optimization, { reason: attempt.reason ?? 'no_candidate', adapter: 'langchain', logicalCallId: attempt.logicalCallId, attemptId: attempt.attemptId });
            }
            return prepared.messages;
        });
    }
    bindTools(tools, kwargs) {
        if (!this.inner.bindTools)
            throw new Error('Native model does not support bindTools');
        return this.project().pipe(this.inner.bindTools(tools, kwargs));
    }
    async invoke(input, config) {
        const prepared = await prepareLangChain(messages(input), this.caveman, config, null, [], this.blocked);
        if (!prepared.attempt)
            return this.inner.invoke(input, config);
        const attempt = prepared.attempt;
        observe(attempt, 'dispatch_intent');
        try {
            const response = await withOwner(attempt, () => this.inner.invoke(prepared.messages, config));
            observe(attempt, 'completed', isAIMessage(response) ? langChainUsage(response.usage_metadata) : null);
            return response;
        }
        catch (error) {
            observe(attempt, config?.signal?.aborted ? 'cancelled' : 'failed');
            throw error;
        }
    }
    async stream(input, config) {
        const prepared = await prepareLangChain(messages(input), this.caveman, config, null, [], this.blocked);
        if (!prepared.attempt)
            return this.inner.stream(input, config);
        const attempt = prepared.attempt;
        observe(attempt, 'dispatch_intent');
        const stream = await withOwner(attempt, () => this.inner.stream(prepared.messages, config));
        async function* values() {
            const iterator = stream[Symbol.asyncIterator]();
            let last, finished = false;
            try {
                for (;;) {
                    const next = await withOwner(attempt, () => iterator.next());
                    if (next.done) {
                        finished = true;
                        observe(attempt, 'completed', langChainUsage(last));
                        return;
                    }
                    if (isAIMessageChunk(next.value) && next.value.usage_metadata)
                        last = next.value.usage_metadata;
                    yield next.value;
                }
            }
            catch (error) {
                observe(attempt, config?.signal?.aborted ? 'cancelled' : 'failed');
                finished = true;
                throw error;
            }
            finally {
                if (!finished)
                    observe(attempt, 'cancelled');
                await iterator.return?.();
            }
        }
        return IterableReadableStream.fromAsyncGenerator(values());
    }
    async _generate(input, options) {
        const prepared = await prepareLangChain(input, this.caveman, options, null, [], this.blocked);
        const attempt = prepared.attempt;
        if (attempt)
            observe(attempt, 'dispatch_intent');
        try {
            const result = await (attempt ? withOwner(attempt, () => this.inner.generate([prepared.messages], options)) : this.inner.generate([prepared.messages], options));
            const generations = result.generations[0];
            if (attempt) {
                const message = generations[0]?.message;
                observe(attempt, 'completed', message && isAIMessage(message) ? langChainUsage(message.usage_metadata) : null);
            }
            return { generations, ...(result.llmOutput ? { llmOutput: result.llmOutput } : {}) };
        }
        catch (error) {
            if (attempt)
                observe(attempt, 'failed');
            throw error;
        }
    }
}
export function withCavemanModel(model, options) {
    return model instanceof CavemanChatModel ? model : new CavemanChatModel(model, options);
}
/** RAG-only native compressor. Source expansion is required for lossy use. */
export class CavemanDocumentCompressor extends BaseDocumentCompressor {
    options;
    blocked;
    constructor(options) {
        super();
        this.options = options;
        this.blocked = frameworkGate('langchain-core', options, () => typeof ToolMessage.isInstance === 'function');
    }
    async compressDocuments(documents, _query) {
        const report = (reason) => this.options.runtime.report(null, { reason, adapter: 'langchain-rag' });
        if (this.options.runtime.mode === 'off') {
            report('disabled');
            return documents;
        }
        if (this.blocked) {
            report(this.blocked);
            return documents;
        }
        const scope = resolveLangChainScope(this.options.scope);
        if (!scope) {
            report('recovery_unbound');
            return documents;
        }
        return guard(this.options.runtime, 'langchain-rag', undefined, async () => {
            // C6: a structural check survives minification and another installed copy of @langchain/core.
            if (documents.some(d => !d || typeof d.pageContent !== 'string' || !Object.keys(d).every(key => ['pageContent', 'metadata', 'id'].includes(key)))) {
                report('unsupported_shape');
                return documents;
            }
            const context = await manifest(documents.map(d => ({ id: d.id, pageContent: d.pageContent, metadata: d.metadata })), this.options.manifestBytes);
            const reader = this.options.sourceExpansion;
            const binding = this.options.runtime.ownsBinding(reader, scope) && typeof reader.execute === 'function' ? reader : null;
            const result = await this.options.runtime.optimize({ scope, adapter: { ...langChainAdapter, id: 'langchain-rag', serialization_revision: 'langchain-document-v1' }, ...context,
                candidates: documents.map((d, i) => ({ id: `document-${i}`, sourceId: d.id ?? `document-${i}`, content: d.pageContent, kind: 'artifact' })), binding });
            const replacements = new Map(result.replacements.map(r => [r.segment_id, r.text]));
            const segments = new Set(documents.map((_document, index) => `document-${index}`));
            if (result.replacements.some(replacement => !segments.has(replacement.segment_id))) {
                report('invalid_plan');
                return documents;
            }
            const projected = documents.map((d, i) => {
                if (!replacements.has(`document-${i}`))
                    return d;
                // Host applications can load another copy of @langchain/core; keep their native constructor.
                const NativeDocument = Object.getPrototypeOf(d).constructor;
                return new NativeDocument({ pageContent: replacements.get(`document-${i}`), metadata: d.metadata, ...(d.id !== undefined ? { id: d.id } : {}) });
            });
            this.options.runtime.report(result, { adapter: 'langchain-rag' });
            return projected;
        }, () => { report('adapter_error'); return documents; });
    }
}
