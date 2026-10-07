export declare function installedFrameworkVersion(name: string, entry?: string): string | null;
export declare function warnFrameworkMismatch(name: string, imported: string | null): void;
/** openai and anthropic: the version of the SDK copy that built this client, from its own User-Agent. */
export declare function clientVersion(client: unknown): string | null;
/** `low <= version < high`. A compatible range is not a claim that each release
 * was tested. Serialization revisions identify our format, not upstream changes. */
export declare function inRange(version: string | null, low: string, high: string): boolean;
/** Pure version check for adapters retaining a passive per-call delegate. */
export declare function matchesFramework(name: string, low: string, high: string, entry?: string): boolean;
