/** Node transport for the middleware runtime (spec §15): honors HTTP(S)_PROXY / NO_PROXY without Node's
 * NODE_USE_ENV_PROXY flag (CONNECT tunnel for https, absolute-form for http), accepts a custom CA, keeps connections
 * alive and never proxies loopback. node:http/https/tls load lazily, so edge bundles never touch them. */
export interface NodeTransport {
    fetch: typeof globalThis.fetch;
    /** Destroys pooled and in-flight sockets, including tunnels still being set up. */
    close(): void;
}
/** Why this transport cannot use `proxy` (TLS to the proxy itself and SOCKS are unsupported), or null. Names the scheme,
 * never the URL, which may carry credentials. `escape` names the caller's way around it. */
export declare function unsupportedProxy(proxy: string, escape: string): string | null;
/** `proxy` is the resolveProxy() result for the runtime endpoint (null when none applies, loopback included). */
export declare function createNodeTransport(options: {
    proxy: string | null;
    ca?: string | readonly string[] | undefined;
}): NodeTransport;
