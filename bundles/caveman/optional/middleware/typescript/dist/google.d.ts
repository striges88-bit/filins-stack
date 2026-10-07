import { GoogleGenAI, Models, Chats, type GoogleGenAIOptions } from '@google/genai';
import { MiddlewareRuntime } from '@caveman-ai/sdk/middleware';
import { type BudgetOptions, type ScopeSource } from './common.js';
import { type GateOptions } from './compatibility.js';
export interface GoogleOptions extends GateOptions, BudgetOptions {
    runtime: MiddlewareRuntime;
    /** A scope, or a function called per request so one shared client can serve many users. */
    scope: ScopeSource;
}
/**
 * **Experimental tier.** Native Google client with the same GoogleGenAIOptions and native Models/Chats. It hooks the
 * SDK's protected ApiClient, which the SDK's own types mark internal: if that seam moves, construction and every call
 * fall back to the native client (`adapter_error`) instead of failing. It never mutates a private SDK field or
 * replaces the native automatic tool loop. Already constructed Google clients have no public clone/transport
 * injection: reuse their original options here. Other modules retain the original client.
 */
export declare class CavemanGoogleGenAI extends GoogleGenAI {
    readonly models: Models;
    readonly chats: Chats;
    constructor(nativeOptions: GoogleGenAIOptions, options: GoogleOptions);
}
