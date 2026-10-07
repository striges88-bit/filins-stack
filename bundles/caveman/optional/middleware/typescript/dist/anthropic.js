import { bindRecovery, hintRecovery, nameConflict, plain, recoveryResult, resolveScope } from './common.js';
import { frameworkGate } from './compatibility.js';
import { guardSync } from './guard.js';
import { clientVersion } from './versions.js';
import { clientFetch, createCavemanFetch, withNativeRecovery } from './transport.js';
const ID = 'anthropic-sdk';
/** Keep lazy native iterators in their invocation's recovery context. */
function scopedIterator(iterator, context) {
    return {
        next: (...args) => withNativeRecovery(context, () => iterator.next(...args)),
        ...(iterator.return ? { return: value => withNativeRecovery(context, () => iterator.return(value)) } : {}),
        ...(iterator.throw ? { throw: error => withNativeRecovery(context, () => iterator.throw(error)) } : {}),
    };
}
/** Messages and stream helpers remain native. `beta.messages.toolRunner` owns execution and is the entry point that
 * compresses; `messages.create`/`stream` cannot bind the recovery tool and report `recovery_unbound` (hinted once, on use). */
export function withCavemanAnthropic(client, options) {
    if (wrapped.has(client))
        return client;
    // TS-2: gate on the SDK copy that built this client, not whichever `@anthropic-ai/sdk` resolves from this package.
    return wrapAnthropic(client, options, frameworkGate('anthropic', options, undefined, { '@anthropic-ai/sdk': clientVersion(client) }));
}
/** Every client wrapAnthropic returned. Wrapping one again returns it unchanged. */
const wrapped = new WeakSet();
function wrapAnthropic(client, options, blocked) {
    if (!options.fetch)
        options = { ...options, fetch: clientFetch(client) };
    const fetch = createCavemanFetch({ ...options, provider: 'anthropic', providerBaseURL: client.baseURL, frameworkVersion: clientVersion(client) ?? 'unknown',
        ...(blocked ? { passiveReason: blocked } : {}),
        onUnbound: () => hintRecovery(options.runtime, ID, 'withCavemanAnthropic messages.create()/stream()', 'beta.messages.toolRunner') });
    const native = client.withOptions({ fetch });
    wrapped.add(native);
    if (blocked || options.runtime.mode === 'off')
        return native;
    guardSync(options.runtime, ID, () => {
        const run = native.beta.messages.toolRunner.bind(native.beta.messages);
        native.beta.messages.toolRunner = ((body, requestOptions) => {
            if (!plain(body) || !Array.isArray(body.tools) || options.runtime.mode !== 'compress')
                return run(body, requestOptions);
            const bodyTools = body.tools;
            // The runner and its iterator are SDK internals: if they change shape, run natively and recovery-free.
            return guardSync(options.runtime, ID, () => {
                const names = bodyTools.map(tool => plain(tool) ? tool.name : null);
                const logicalCallId = crypto.randomUUID();
                let context;
                let runner;
                const binding = names.includes('caveman_retrieve') || names.some(name => typeof name !== 'string' || !name) || new Set(names).size !== names.length
                    ? null : bindRecovery(options.runtime, resolveScope(options.scope, undefined));
                if (names.includes('caveman_retrieve')) {
                    context = { runtime: options.runtime, reason: nameConflict(options.runtime, ID), logicalCallId, owner: fetch };
                    runner = run(body, requestOptions);
                }
                else if (!binding)
                    return run(body, requestOptions);
                else {
                    const schema = { name: binding.name, description: binding.description, input_schema: binding.inputSchema };
                    const execute = async (input, context) => JSON.stringify(await recoveryResult(ID, context?.signal, input, args => binding.execute(args, context?.signal ? { signal: context.signal } : undefined)));
                    const recovery = Object.freeze({ ...schema, parse: (input) => input, run: execute });
                    const created = runner = run({ ...body, tools: [...bodyTools, recovery] }, requestOptions);
                    const isRegistered = () => {
                        const tools = created.params.tools;
                        const currentNames = tools.map(tool => plain(tool) ? tool.name : null);
                        return options.runtime.ownsBinding(binding, binding.scope) && new Set(currentNames).size === currentNames.length &&
                            currentNames.every(name => typeof name === 'string' && name.length > 0) &&
                            tools.filter(tool => plain(tool) && tool.name === binding.name).length === 1 && tools.find(tool => plain(tool) && tool.name === binding.name) === recovery && recovery.run === execute;
                    };
                    context = { runtime: options.runtime, scope: binding.scope, binding, overhead: JSON.stringify(schema), logicalCallId, isRegistered, owner: fetch };
                }
                // The SDK runner is lazy. Wrapping only its constructor would lose the
                // binding before the first next(), and await runner uses this iterator too.
                const iterate = runner[Symbol.asyncIterator].bind(runner);
                runner[Symbol.asyncIterator] = () => scopedIterator(iterate(), context);
                return runner;
            }, () => run(body, requestOptions));
        });
    }, () => undefined, true);
    const clone = native.withOptions.bind(native);
    native.withOptions = next => {
        const nextFetch = (next.fetch ?? options.fetch);
        return wrapAnthropic(clone({ ...next, fetch: nextFetch }), { ...options, fetch: nextFetch }, blocked);
    };
    return native;
}
