import { recoveryInputSchema, recoveryToolDescription, warnOnce } from '@caveman-ai/sdk/middleware';
import { bindRecovery, hintRecovery, nameConflict, plain, recoveryResult, resolveScope } from './common.js';
import { frameworkGate } from './compatibility.js';
import { guardSync } from './guard.js';
import { clientVersion } from './versions.js';
import { clientFetch, createCavemanFetch, withNativeRecovery } from './transport.js';
const ID = 'openai-sdk';
// TS-2: gate on the SDK copy that built this client, not whichever `openai` resolves from this package.
const gate = (client, options) => frameworkGate('openai', options, undefined, { openai: clientVersion(client) });
/** Native application-owned Chat/Responses calls, with no added scheduler. The OpenAI entry point that compresses. */
export function withCavemanOpenAITools(client, options) {
    // An already-wrapped client is rewrapped from its native source, so exactly one Caveman layer runs.
    client = sources.get(client) ?? client;
    const definitions = structuredClone(options.tools);
    let functions = Object.freeze({ ...options.functions });
    const blocked = gate(client, options);
    let context, conflict = false;
    if (options.runtime.mode === 'compress' && !blocked) {
        const names = definitions.map(tool => 'function' in tool ? tool.function.name : tool.name);
        // Nothing raises at wrap time (spec §8): a clash with caveman_retrieve, or a malformed table, disables recovery.
        if (names.includes('caveman_retrieve') || 'caveman_retrieve' in functions)
            conflict = !!nameConflict(options.runtime, ID);
        else if (!plain(options.functions) || names.some(name => typeof name !== 'string' || !name) || new Set(names).size !== names.length ||
            names.length !== Object.keys(functions).length || names.some(name => typeof functions[name] !== 'function'))
            warnOnce(ID, 'invalid_configuration');
        else {
            const schema = { name: 'caveman_retrieve', description: recoveryToolDescription, parameters: structuredClone(recoveryInputSchema) };
            const definition = options.protocol === 'openai-chat' ? { type: 'function', function: schema } : { type: 'function', ...schema, strict: false };
            definitions.push(definition);
            const execute = (input) => recoveryResult(ID, undefined, input, args => options.runtime.retrieve(resolveScope(options.scope, undefined), args));
            functions = Object.freeze({ ...functions, caveman_retrieve: execute });
            const overhead = JSON.stringify(definition);
            // Per request, so a scope function resolves in each caller's own context.
            context = () => {
                const binding = bindRecovery(options.runtime, resolveScope(options.scope, undefined));
                return binding && { runtime: options.runtime, scope: binding.scope, binding, overhead, logicalCallId: crypto.randomUUID(), isRegistered: () => functions.caveman_retrieve === execute };
            };
        }
    }
    const serialized = JSON.stringify(definitions);
    return Object.freeze({ client: wrapOpenAI(client, options, blocked, { context, conflict, protocol: options.protocol }), functions, get tools() { return JSON.parse(serialized); } });
}
/** A native withOptions clone; APIPromise, parsers, streams and runners survive. `chat.completions.runTools`
 * compresses; plain `create` calls cannot bind the recovery tool and report `recovery_unbound` (hinted once, on use). */
export function withCavemanOpenAI(client, options) {
    return sources.has(client) ? client : wrapOpenAI(client, options, gate(client, options));
}
/** Every client wrapOpenAI returned, mapped to the native client it wraps. Wrapping one again returns it unchanged. */
const sources = new WeakMap();
function wrapOpenAI(client, options, blocked, tools) {
    if (!options.fetch)
        options = { ...options, fetch: clientFetch(client) };
    const fetch = createCavemanFetch({ ...options, provider: 'openai', providerBaseURL: client.baseURL, frameworkVersion: clientVersion(client) ?? 'unknown', ...(blocked ? { passiveReason: blocked } : {}),
        ...(tools ? {} : { onUnbound: () => hintRecovery(options.runtime, ID, 'withCavemanOpenAI create()', 'chat.completions.runTools or withCavemanOpenAITools') }) });
    const native = client.withOptions({ fetch });
    sources.set(native, client);
    if (blocked || options.runtime.mode === 'off')
        return native;
    guardSync(options.runtime, ID, () => {
        const run = native.chat.completions.runTools.bind(native.chat.completions);
        native.chat.completions.runTools = ((body, requestOptions) => {
            if (!plain(body) || !Array.isArray(body.tools) || options.runtime.mode !== 'compress')
                return run(body, requestOptions);
            const bodyTools = body.tools;
            return guardSync(options.runtime, ID, () => {
                const names = bodyTools.map(t => plain(t) && plain(t.function) ? t.function.name || (typeof t.function.function === 'function' ? t.function.function.name : null) : null);
                const logicalCallId = crypto.randomUUID();
                if (names.includes('caveman_retrieve'))
                    return withNativeRecovery({ runtime: options.runtime, reason: nameConflict(options.runtime, ID), logicalCallId, owner: fetch }, () => run(body, requestOptions));
                const binding = names.some(name => typeof name !== 'string' || !name) || new Set(names).size !== names.length ? null : bindRecovery(options.runtime, resolveScope(options.scope, undefined));
                if (!binding)
                    return run(body, requestOptions);
                const execute = (input, runner) => recoveryResult(ID, runner.controller.signal, input, args => binding.execute(args, { signal: runner.controller.signal }));
                const recovery = Object.freeze({ type: 'function', function: Object.freeze({ name: binding.name, description: binding.description, parameters: binding.inputSchema, parse: JSON.parse, function: execute }) });
                const params = { ...body, tools: [...bodyTools, recovery] };
                const overhead = JSON.stringify({ type: 'function', function: { name: binding.name, description: binding.description, parameters: binding.inputSchema } });
                // The native runner snapshots its dispatch table before any callbacks. The
                // invocation-owned recovery entry cannot change after that snapshot.
                const isRegistered = () => options.runtime.ownsBinding(binding, binding.scope) && recovery.function.function === execute && recovery.function.parse === JSON.parse;
                return withNativeRecovery({ runtime: options.runtime, scope: binding.scope, binding, overhead, logicalCallId, isRegistered, owner: fetch }, () => run(params, requestOptions));
            }, () => run(body, requestOptions));
        });
    }, () => undefined, true);
    if (tools?.context || tools?.conflict) {
        const { context, conflict, protocol } = tools;
        // `post` is an SDK-internal seam: if it moves, calls run recovery-free instead of failing.
        guardSync(options.runtime, ID, () => {
            const post = native.post.bind(native);
            native.post = (path, params) => {
                if (path !== (protocol === 'openai-chat' ? '/chat/completions' : '/responses'))
                    return post(path, params);
                const current = conflict ? { runtime: options.runtime, reason: 'recovery_name_conflict', logicalCallId: crypto.randomUUID() } : context?.();
                return current ? withNativeRecovery({ ...current, owner: fetch }, () => post(path, params)) : post(path, params);
            };
        }, () => undefined, true);
    }
    const clone = native.withOptions.bind(native);
    native.withOptions = (next) => {
        const nextFetch = (next.fetch ?? options.fetch);
        return wrapOpenAI(clone({ ...next, fetch: nextFetch }), { ...options, fetch: nextFetch }, blocked, tools);
    };
    return native;
}
export { createCavemanFetch } from './transport.js';
