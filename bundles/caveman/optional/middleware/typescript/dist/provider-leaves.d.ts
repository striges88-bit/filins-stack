import { type WireJSON, type StringLeaf } from './wire.js';
export type Protocol = 'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'google-genai';
export interface Selection {
    context: unknown[];
    leaves: StringLeaf[];
}
export declare function selectLeaves(wire: WireJSON, protocol: Protocol): Selection | null;
