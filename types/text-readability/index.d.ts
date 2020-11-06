declare module 'text-readability' {
    export function syllableCount(text: string, lang?: string): number;
    export function lexiconCount(text : string, removePunctuation?: boolean): number;
    export function sentenceCount(text: string) : number;
    export function fleschReadingEase(text: string) : number;
    export function textStandard(text: string, floatOutput:  boolean) : number;
}