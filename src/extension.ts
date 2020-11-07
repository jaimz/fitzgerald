// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {Selection, TextDocumentChangeEvent, TextEditorSelectionChangeEvent, ViewColumn} from 'vscode';
import * as rs from 'text-readability';


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
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// We have to remember the previous text selection so we can tell if an incoming
	// selection change should cause us to re-calculate the stats
	let _selections : Selection[] | null = null
	
	// Recalculate the stats if the text document changes - should probably be smarter about deltas
	// in 'real life'
	vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
		console.log("Changed text document");
		// I don't see how this could not be the case but...
		if (vscode.window.activeTextEditor?.document === e.document) {
			_selections = null;
			update();
		}
	})
	
	// Update the stats when the user changes the current editor
	vscode.window.onDidChangeActiveTextEditor((e => {
		if (!e) {
			// If we don't have an active text editor clear the stats
			StatsPanel.clearDisplay();
			return;
		}
		
		_selections = null;
		update();
	}))

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
	})


	function reCalcStats() : Stats | undefined {
		const document = vscode.window.activeTextEditor?.document;
		const selections = vscode.window.activeTextEditor?.selections;
		
		
		if (!document)
			return;

		// Confusingly, VSC seems to take the current insertion point as a "selection" so filter out any empty ones.
		const textSelections = selections ? selections.filter((selection : Selection) => !selection.isEmpty) : null;

		// The text to analyse is the union of all the selected text (or the whole document if there are no selections)
		const text = textSelections && textSelections.length > 0 ? textSelections.map((selection : Selection) => document.getText(selection)).join(" ") : document.getText();		
		
		console.log("Difficult words");
		console.log(rs.difficultWords(text));
		
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
			friendlyGrade: rs.textStandard(text, false)
		}
	}
	
	
	function update() {
		const stats = reCalcStats();
		StatsPanel.updateWithStats(stats, context.extensionUri);
	}
	
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('fitzgerald.helloWorld', () => {
		
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
	private _disposables: vscode.Disposable[] = [];

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
		
		if (shouldReveal)
			StatsPanel.current.reveal(column);
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
  <div class="stat-panel">
    <div class="stat-count" data-stat-name="syllables"></div>
    <div class="stat-name">Syllables</div>
  </div>
  <div class="stat-panel">
    <div class="stat-count" data-stat-name="sentences"></div>
    <div class="stat-name">Sentences</div>
  </div>
  <div class="stat-panel">
    <div class="stat-count" data-stat-name="grade"></div>
    <div class="stat-name">Grade</div>
  </div>

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

// this method is called when your extension is deactivated
export function deactivate() {}
