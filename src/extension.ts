// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as rs from 'text-readability';
import {Selection, ViewColumn} from "vscode";



interface Stats {
	syllables : number,
	sentences : number,
	grade : number
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	function reCalcStats() : Stats | null {
		const document = vscode.window.activeTextEditor?.document;
		if (!document)
			return null

		// Confusingly, VSC seems to take the current insertion point as a "selection" so filter out any empty ones.
		const selections = activeEditor.selections.filter((selection : Selection) => !selection.isEmpty);

		// The text to analyse is the union of all the selected text (or the whole document if there are no selections)
		const text = selections.length > 0 ? selections.map((selection : Selection) => document.getText(selection)).join(" ") : activeEditor.document.getText();		

		
		return {
			syllables: rs.syllableCount(text),
			sentences: rs.sentenceCount(text),
			grade: rs.textStandard(text, true)
		}
	}
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('fitzgerald.helloWorld', () => {
		const activeEditor = vscode.window.activeTextEditor;

		if (activeEditor) {
			const document = activeEditor.document;

			// Confusingly, VSC seems to take the current insertion point as a "selection" so filter out any empty ones.
			const selections = activeEditor.selections.filter((selection) => !selection.isEmpty);

			// The text to analyse is the union of all the selected text (or the whole document if there are no selections)
			const text = selections.length > 0 ? selections.map((selection) => document.getText(selection)).join(" ") : activeEditor.document.getText();

			const stats = reCalcStats();

			StatsPanel.updateWithStats(stats, context.extensionUri);

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
			} else {
				// NOTE: this is extremely awkward - find a way around it.
				console.warn("Need to pass an extension URI the first time updateWithStats is called");
				return;
			}
		}

		StatsPanel.current.update(stats);

		// Reveal the panel if it is hidden
		StatsPanel.current.reveal(column);
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
