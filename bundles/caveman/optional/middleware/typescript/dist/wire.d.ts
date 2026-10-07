/** Native JSON string-leaf offsets. All bytes outside selected leaves survive. */
export interface StringLeaf {
    path: (string | number)[];
    start: number;
    end: number;
    value: string;
}
export interface WireJSON {
    value: unknown;
    strings: Map<string, StringLeaf>;
}
export declare const pathKey: (path: (string | number)[]) => string;
/** Bounded by `maxBytes` (UTF-16 units) and one node per 16 of them; beyond either the body stays unparsed. */
export declare function parseWire(text: string, maxBytes?: number): WireJSON | null;
export declare function patchWire(text: string, patches: {
    leaf: StringLeaf;
    replacement: string;
}[]): string | null;
