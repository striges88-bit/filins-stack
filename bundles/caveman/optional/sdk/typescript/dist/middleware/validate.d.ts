import type { CapabilitiesView, OptimizeRequest, Plan, RecoveryPage, RetrieveArgs, Scope, Transform } from './types.js';
export declare const byteLength: (text: string) => number;
export declare function sha256(value: string | Uint8Array): Promise<string>;
/** Synchronous SHA-256 hex of UTF-8 text. Scope normalization must stay synchronous (recovery() is), and
 * WebCrypto is async-only while `node:crypto` is unavailable on edge runtimes. Inputs here are short. */
export declare function sha256Sync(text: string): string;
export declare const isHash: (s: unknown) => s is string;
export declare const isToken: (s: unknown) => s is string;
export declare const positive: (n: unknown) => n is number;
export declare function scopeKey(scope: Scope): string;
export declare class MiddlewareError extends Error {
    readonly code: string;
    constructor(code: string, detail?: string | null);
}
/** Tolerant capabilities reader (spec §4). Throws `unsupported_version` only for a document this client cannot use at
 * all; unknown fields, limits, features and transforms are ignored instead of rejecting the document. */
export declare function parseCapabilities(value: unknown): CapabilitiesView;
/** The capabilities fields plan validation reads; a parsed CapabilitiesView or a raw document both qualify. */
export type PlanCapabilities = {
    readonly transforms: readonly Transform[];
    readonly mode: string;
    readonly limits: {
        readonly segment_bytes: number;
    };
};
/** Validate every leaf before an adapter is allowed to apply any of them (spec §7). Total: any malformed value,
 * including one that would throw mid-check (a null replacement), is `invalid_plan`, never an adapter error. */
export declare function validatePlan(value: unknown, request: OptimizeRequest, inputDigest: string, caps: PlanCapabilities): Promise<Plan>;
export declare function validatePage(value: unknown, args: RetrieveArgs, maxBytes: number): Promise<RecoveryPage>;
