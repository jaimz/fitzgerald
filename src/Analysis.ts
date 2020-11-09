import * as vscode from 'vscode';
import * as rs from 'text-readability';

import {Position, Selection, TextDocument} from "vscode";
import {difficultWordsMap} from "./words/words";

// Encapsulates the statistics to show for the current
// text editor
export interface Stats {
    syllables : number,
    words: number,
    sentences : number,

    grade : number | string,

    flesch: number,
    fleschKincaid: number,
    gunningFog: number,
    smog: number,
    automatedReadability: number,
    colemanLiau: number,
    linsearWrite: number,
    daleChall: number,

    difficultWords: string[]
}

// Convenience typealias for the difficult words decorator location map
type DifficultWordsMap = Map<string, [number, number][]>;


// The decoration used to highlight "difficult" words in the text.
const hardWordDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: 'blue',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    dark: {
        backgroundColor: '#6f4446',
        overviewRulerColor: '#6f4446',
    },
    light: {
        backgroundColor: '#FFC0C2',
        overviewRulerColor: '#FFC0C2',
    },
    fontWeight: 'bold'
});



// Apply the difficult word decorators to the current editor.
// hardWordsMap: a map of word -> word locations. Locations are supplied as an array of spans (0-based start and end positions)
// document: The current text document
// offset: Starting offset of the current selection (if there is one). Decorations will be relative to this if supplied.
//
// TODO: Awkward that decoration logic is in this file.
function applyDecorators(hardWordsMap : DifficultWordsMap, document: TextDocument, offset?: Position) : void {
    const wordsToDecorate = [...hardWordsMap.keys()];

    const decorations : vscode.DecorationOptions[] = [];

    // We would have to be smarter about the range of text over which we operate in long documents
    for (const word of wordsToDecorate) {
        let spans = hardWordsMap.get(word);
        if (!spans) { continue;}

        for (const span of spans) {
            const startPos = offset ? offset.translate({ characterDelta: span[0] }) : document.positionAt(span[0]);
            const endPos = offset ? offset.translate({ characterDelta: span[1] }) : document.positionAt(span[1]);

            decorations.push({ range: new vscode.Range(startPos, endPos), hoverMessage: "Difficult word!"});
        }
    }

    vscode.window.activeTextEditor?.setDecorations(hardWordDecorationType, decorations);
}


/**
 * Analyse the currently active text document.
 *
 * @return a Stats object with the statistics. undefined if there is no document or no editor. 
 */
export function analyse() : Stats | undefined {
    const document = vscode.window.activeTextEditor?.document;
    const selections = vscode.window.activeTextEditor?.selections;
    
    if (!document) { return; }

    // Confusingly, VSC seems to take the current insertion point as a "selection" so filter out any empty ones.
    const textSelections = selections ? selections.filter((selection : Selection) => !selection.isEmpty) : null;

    // The text to analyse is the union of all the selected text (or the whole document if there are no selections)
    const text = textSelections && textSelections.length > 0 ? textSelections.map((selection : Selection) => document.getText(selection)).join(" ") : document.getText();

    // const difficultWordSet = difficultWords(text, 3);
    const hardWordsMap = difficultWordsMap(text, 3);
    const hardWords = [...hardWordsMap.keys()];
    hardWords.sort();
    // For reasons that escape me the difficult words are rendered in reverse order unless we do this
    hardWords.reverse();
    
    const stats = {
        automatedReadability: rs.automatedReadabilityIndex(text),
        colemanLiau: rs.colemanLiauIndex(text),
        daleChall: rs.daleChallReadabilityScore(text),
        flesch: rs.fleschReadingEase(text),
        fleschKincaid: rs.fleschKincaidGrade(text),
        gunningFog: rs.gunningFog(text),
        linsearWrite: rs.linsearWriteFormula(text),
        smog: rs.smogIndex(text),

        syllables: rs.syllableCount(text),
        words: rs.lexiconCount(text, true),
        sentences: rs.sentenceCount(text),
        grade: rs.textStandard(text, true),

        difficultWords: hardWords
    };
    
    if (textSelections && textSelections.length > 0 && selections) {
        applyDecorators(hardWordsMap, document, selections[0].start);
    } else {
        applyDecorators(hardWordsMap, document);
    }
    
    return stats;
}