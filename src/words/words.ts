import { Range } from 'vscode';
import { syllableCount } from "text-readability";
import pluralize = require('pluralize');
import easyWords from "./easy_words";
import {plural} from "pluralize";


// from the original text-readability code
function presentTense(word : string) {
    // good enough for most long words -- we only care about "difficult" words
    // of two or more syllables anyway.
    // Doesn't work for words ending in "e" that aren't "easy"
    if (word.length < 6)
        return word
    if (word.endsWith('ed')) {
        if (easyWords.has(word.slice(0, -1)))
            return word.slice(0, -1) // "easy" word ending in e
        else
            return word.slice(0, -2) // assume we remove "ed"
    }
    if (word.endsWith('ing')) {
        const suffixIngToE = word.slice(0, -3) + "e" // e.g. forcing -> force
        if (easyWords.has(suffixIngToE))
            return suffixIngToE
        else
            return word.slice(0, -3)
    }
    return word
}

// text-readability only returns the *number* of difficult words, not the
// actual set. So I have to duplicate its function here
export function difficultWords(text: string, syllableThreshold : number = 2) : Set<string> {
    const textList = text.match(/[\w=‘’]+/g);
    const diffWordSet = new Set<string>();
    
    if (textList === null)
        return diffWordSet;
    
    for (const word of textList) {
        const normalized = presentTense(pluralize(word.toLocaleLowerCase(), 1));
        if (!easyWords.has(normalized) && syllableCount(word) >= syllableThreshold) {
            diffWordSet.add(word);
        }
    }
    
    return diffWordSet
}

function isHardWord(word : string, syllableThreshold : number = 3) : boolean {
    const normalized = presentTense(pluralize(word.toLocaleLowerCase(), 1));
    return (!easyWords.has(normalized) && syllableCount(word) >= syllableThreshold);
}

export function difficultWordsMap(text: string, syllableThreshold: number = 3) : Map<string, [number,number][]> {
    const regex = /[\w=‘’]+/g;
    const resultSet = new Map<string, [number,number][]>();
    
    let match;
    while (match = regex.exec(text)) {
        let word = match[0];
        if (isHardWord(word, syllableThreshold)) {
            const span : [number, number] = [match.index, match.index + word.length];
            const currentList = resultSet.get(word);
            
            const newList = currentList ? [...currentList, span] : [span];
            resultSet.set(word, newList);
        }
    }
    
    return resultSet;
}