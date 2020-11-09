import * as vscode from 'vscode';
import {
	Position,
	Selection,
	TextDocument,
	TextDocumentChangeEvent,
	TextEditorSelectionChangeEvent,
	ViewColumn
} from 'vscode';

import * as rs from 'text-readability';
import { difficultWordsMap } from './words/words';


// Encapsulates the statistics to show for the current
// text editor
interface Stats {
	syllables : number,
	words: number,
	sentences : number,

	grade : number | string,
	friendlyGrade: number | string,

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



/**
 * Activate the extension
 * @param context Represents the VSC instance to activate within.
 */
// noinspection JSUnusedGlobalSymbols
export function activate(context: vscode.ExtensionContext) {
	
	// We have to remember the previous text selection so we can tell if an incoming
	// selection change should cause us to re-calculate the stats
	let _selections : Selection[] | null = null;
	
	
	// Recalculate the stats if the text document changes - should probably be smarter about deltas
	// in 'real life'
	vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
		console.log("Changed text document");
		// I don't see how this could not be the case but...
		if (vscode.window.activeTextEditor?.document === e.document) {
			_selections = null;
			update();
		}
	});

	// Update the stats when the user changes the current editor
	vscode.window.onDidChangeActiveTextEditor((e => {
		if (!e) {
			console.log("No text editor?");
			// If we don't have an active text editor clear the stats
			// StatsPanel.clearDisplay();
			return;
		}

		console.log("Got text editor");

		_selections = null;
		update();
	}));

	// Update the stats to change the selection when the user updates it
	vscode.window.onDidChangeTextEditorSelection((e: TextEditorSelectionChangeEvent) => {
		if (e.textEditor === vscode.window.activeTextEditor) {
			// This event also gets fired if the user simply moves the caret. Only do anything if we have non-empty selections
			const nonEmptySelections = e.selections?.filter((selection) => !selection.isEmpty) || [];
			const incomingSelections = nonEmptySelections.length > 0 ? nonEmptySelections : null;

			// Only do an update if a selection has meaningfully changed.
			if (incomingSelections !== _selections) {
				console.log("Changed selection");

				_selections = incomingSelections;
				update();
			}
		}
	});

	
	/**
	 * Re-generate the difficult word decorations whenever the text or selection changes.
	 * 
	 * @param hardWordsMap a map of word -> word locations. Locations are supplied as an array of spans (0-based start and end positions)
	 * @param document The current text document.
	 * @param offset Offset of the current selection (if there is one). Decorations should be relative to this if it is supplied.
	 */
	function updateHardWordsDecorations(hardWordsMap : Map<string, [number, number][]>, document : TextDocument, offset?: Position) {
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
	 * Recalculate the statistics for the current text document.
	 * 
	 * @return A Stats object, or undefined if there is no current document.
	 */
	function reCalcStats() : Stats | undefined {
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
		
		// If we have a selection the difficult words decorations should be rendered relative to
		// that selection
		if (textSelections && textSelections.length > 0 && selections) {
			const offset = selections[0].start;
			updateHardWordsDecorations(hardWordsMap, document, offset);
		} else {
			updateHardWordsDecorations(hardWordsMap, document);
		}


		return {
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
			friendlyGrade: rs.textStandard(text, false),

			difficultWords: hardWords
		};
	}


	/**
	 * Update the stats panel and difficult words highlights
	 */
	function update() {
		const stats = reCalcStats();
		StatsPanel.updateWithStats(stats, context.extensionUri);
	}
	

	let disposable = vscode.commands.registerCommand('fitzgerald.fitz', () => {

		if (vscode.window.activeTextEditor) {
			update();
		} else {
			vscode.window.showWarningMessage("No active editor found");
		}
	});
	context.subscriptions.push(disposable);
}



/**
 * Manages the statistics web view
 */
class StatsPanel {
	public static current : StatsPanel | undefined;
	public static readonly viewType = 'fitz';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri : vscode.Uri;

	/**
	 * Display the supplied stats in the web view. If there is no current view
	 * this method will create one, otherwise we update the view that exists.
	 * 
	 * @param stats The statistics to show.
	 * @param extensionUri The uri of the extension. Required so we can look up relative URIs for web content.
	 */
	public static updateWithStats(stats? : Stats, extensionUri? : vscode.Uri) {
		// We attempt to show the web view as a "side" panel using column two of the editor
		const column = vscode.ViewColumn.Two;

		// We only want to reveal the stats panel if it is the first time it is created
		// (otherwise it yanks the user's focus away from the editor window.
		let shouldReveal = !StatsPanel.current;

		// Create the webview if this is the first time we've been called...
		if (!StatsPanel.current) {
			if (extensionUri) {
				const panel = vscode.window.createWebviewPanel(
					StatsPanel.viewType,
					'Fitzgerald',
					column,
					{
						enableScripts: true,
						localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
					}
				);

				StatsPanel.current = new StatsPanel(panel, extensionUri);
				shouldReveal = true;
			} else {
				// NOTE: this is extremely awkward - find a way around it.
				console.warn("Need to pass an extension URI the first time updateWithStats is called");
				return;
			}
		}

		StatsPanel.current.update(stats);

		if (shouldReveal) { StatsPanel.current.reveal(column); }
	}

	// Called when there is no active text editor (and therefore no stats to sensibly display.
	public static clearDisplay() {
		if (!StatsPanel.current) {
			// nothing to do.
			return;
		}

		StatsPanel.current.clear();
	}


	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		this.initialiseContent();
	}

	// Bring the existing webview into focus
	private reveal(column: ViewColumn) {
		this._panel.reveal(column);
	}

	// Initialise the content to show in the webview. We don't display any stats until "update" is called.
	private initialiseContent() {
		const webview = this._panel.webview;

		const nonce = getNonce();
		const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'fitz.js');
		const scriptUri = webview.asWebviewUri(scriptPath);
		const resetStylesPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const fitzStylesPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'fitz.css');
		const resetStylesUri = webview.asWebviewUri(resetStylesPath);
		const fitzStylesUri = webview.asWebviewUri(fitzStylesPath);

		this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
	<link href="${resetStylesUri}" rel="stylesheet">
	<link href="${fitzStylesUri}" rel="stylesheet">

	<title>Fitzgerald</title>
</head>
<body>
	<div id="warningBar"></div>
	<div id="emptyState">Nothing to show..</div>

	<section>
		<div class="gauge-panel">
		  <div id="ease-gauge">
			<div class="gauge-label">Hard</div>
			<div class="gauge-track">
			  <div id="gaugePointer" class="gauge-pointer" style="left: 59%"></div>
			  <div id="gaugeLabel" class="reading-ease" style="left: 59%">71.68</div>
			</div>
			<div class="gauge-label">Easy</div>
		  </div>
		</div>
	</section>

	<section>
	<div class="discloser-panel">
	<div class="stat-panel">
	  <div class="stat">
		<div class="grade"><span class="grade-number">7</span><sup class="grade-sfx">th</sup></div>
		<div class="stat-name">Grade</div>
	  </div>
	  <div id="grades-expansion" class="disclosable">
		<div class="minor-grade">
		  <div class="minor-grade-name">Flesch-Kincaid Grade Level</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="fleschKincaid"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">The Fog Scale</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="gunningFog"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">The Smog Index</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="smog"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">Automated Readability Index</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="automatedReadability"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">The Coleman-Liau Index</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="colemanLiau"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">Linsear Write Formula</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="linsearWrite"></div>
		</div>
		<div class="minor-grade">
		  <div class="minor-grade-name">Dale-Chall Readability Score</div>
		  <div class="dotted-pad"></div>
		  <div class="minor-grade-value" data-stat-name="daleChall"></div>
		</div>
	  </div>
	</div>
		</div>
	</section>

	<section>
		<div id="difficultWords" class="stat-panel">
			<div class="panel-title">
				Difficult words (<span id="difficultWordCount"></span>)
				<div id="clear-difficult-words">clear</div>
			</div>
			<div class="difficult-word-list"></div>
		</div>
	</section>

	<section>
		<div class="stat-panel">
			<div class="stat">
				<div class="stat-count" data-stat-name="words"></div>
				<div class="stat-name">Words</div>
			</div>
			<div class="stat">
				<div class="stat-count" data-stat-name="sentences"></div>
				<div class="stat-name">Sentences</div>
			</div>
			<div class="stat">
				<div class="stat-count" data-stat-name="syllables"></div>
				<div class="stat-name">Syllables</div>
			</div>
		</div>
	</section>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	// Display the given stats
	private update(stats?: Stats) {
		if (!stats) {
			this._panel.webview.postMessage({ command: 'error', message: "Could not calculate statistics"});
			return;
		}

		this._panel.webview.postMessage({ command: 'refresh', stats });
	}

	// Clear the panel - called when, for some reason, there is no active editor (and
	// therefore no sensible stats to show)
	private clear() {
		this._panel.webview.postMessage({command: "clear"});
	}
}

// Generate the security nonce for the embedded webview.
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// noinspection JSUnusedGlobalSymbols
export function deactivate() {}
