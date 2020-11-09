// Contains the logic for creating the initial content for the webview panel
// Slightly neater to have it in this file rather than cluttering up extension.ts
import * as vscode from 'vscode';

// Constants for the various files referenced in the webview
const MEDIA_DIR = "media";
const SCRIPT_FILE = "fitz.js";
const RESET_CSS_FILE = "reset.css";
const FITZ_CSS_FILE = "fitz.css";

// Generate the security nonce for the embedded webview.
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Generate the initial content for the webview.
 * 
 * @param extensionUri The URI for the extension - needed to derive relative URIs for styles, scripts etc.
 */
export function initialiseWebviewContent(webview : vscode.Webview, extensionUri : vscode.Uri) {
    const nonce = getNonce();
    
    const scriptPath = vscode.Uri.joinPath(extensionUri, MEDIA_DIR, SCRIPT_FILE);
    const scriptUri = webview.asWebviewUri(scriptPath);
    
    const resetStylesPath = vscode.Uri.joinPath(extensionUri, MEDIA_DIR, RESET_CSS_FILE);
    const resetStylesUri = webview.asWebviewUri(resetStylesPath);
    
    const fitzStylesPath = vscode.Uri.joinPath(extensionUri, MEDIA_DIR, FITZ_CSS_FILE);
    const fitzStylesUri = webview.asWebviewUri(fitzStylesPath);

    webview.html = `<!DOCTYPE html>
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
		<div class="grade"><span class="grade-number"></span><sup class="grade-sfx">th</sup></div>
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