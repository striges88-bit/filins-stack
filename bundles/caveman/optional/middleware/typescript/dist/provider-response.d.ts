import { type Attempt } from './common.js';
/** Same native Response contract and bytes; bounded accounting occurs on pulls. */
export declare function observeResponse(response: Response, attempt: Attempt, signal?: AbortSignal | null): Response;
