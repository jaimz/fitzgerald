// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
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

// noinspection JSUnusedGlobalSymbols
export function activate(context: vscode.ExtensionContext) {
	// We have to remember the previous text selection so we can tell if an incoming
	// selection change should cause us to re-calculate the stats
	let _selections : Selection[] | null = null;

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

	function updateHardWordsDecorations(hardWordsMap : Map<string, [number, number][]>, document : TextDocument, offset?: Position, activeWords?: string[]) {
		const wordsToDecorate = activeWords || [...hardWordsMap.keys()];

		const decorations : vscode.DecorationOptions[] = [];

		console.log("Got offset: ", offset);
		for (const word of wordsToDecorate) {
			let spans = hardWordsMap.get(word);
			if (!spans) { continue;};

			for (const span of spans) {
				const startPos = offset ? offset.translate({ characterDelta: span[0] }) : document.positionAt(span[0]);
				const endPos = offset ? offset.translate({ characterDelta: span[1] }) : document.positionAt(span[1]);
				// const startPos = document.positionAt(offset + span[0]);
				// const endPos = document.positionAt(offset + span[1]);

				decorations.push({ range: new vscode.Range(startPos, endPos), hoverMessage: "Difficult word!"});
			}
		}

		vscode.window.activeTextEditor?.setDecorations(hardWordDecorationType, decorations);
	}

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
		// For reasons that escape me the difficult words are rendered in reverse order
		hardWords.reverse();

		let offset;
		if (textSelections && textSelections.length > 0 && selections) {
			console.log("Making offset", textSelections, " ", selections);
			offset = selections[0].start;
			updateHardWordsDecorations(hardWordsMap, document, offset);
		} else {
			console.log("No selections - making an offset at 0");
			offset = document.positionAt(0);
			updateHardWordsDecorations(hardWordsMap, document);
		}

		console.log(offset);

		// const offset = (textSelections && selections) ? selections[0].start : document.positionAt(0);


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


	function update() {
		const stats = reCalcStats();
		StatsPanel.updateWithStats(stats, context.extensionUri);
	}


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
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

	public static updateWithStats(stats? : Stats, extensionUri? : vscode.Uri) {
		const column = vscode.ViewColumn.Two;

		// We only want to reveal the stats panel if it is the first time it is created
		// (otherwise it yanks the user's focus away from the editor window.
		let shouldReveal = !StatsPanel.current;

		// If this is the first time we've been called create the webview
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


	private reveal(column: ViewColumn) {
		this._panel.reveal(column);
	}


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
		<div class="grade" data-stat-name="grade">7<sup class="grade-sfx">th</sup></div>
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

	private update(stats?: Stats) {
		if (!stats) {
			this._panel.webview.postMessage({ command: 'error', message: "Could not calculate statistics"});
			return;
		}

		this._panel.webview.postMessage({ command: 'refresh', stats });
	}

	private clear() {
		this._panel.webview.postMessage({command: "clear"});
	}
}

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
