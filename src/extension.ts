import * as vscode from 'vscode';
import {
	Selection,
	TextDocumentChangeEvent,
	TextEditorSelectionChangeEvent
} from 'vscode';

import { StatsPanel } from "./StatsPanel";
import { analyse } from "./Analysis";


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
		// I don't see how this could not be the case but...
		if (vscode.window.activeTextEditor?.document === e.document) {
			_selections = null;
			update();
		}
	});

	// Update the stats when the user changes the current editor
	vscode.window.onDidChangeActiveTextEditor((e => {
		if (!e) {
			// If we don't have an active text editor clear the stats
			
			// TODO: This was causing a crash - figure it out
			// StatsPanel.clearDisplay();
			return;
		}

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
				_selections = incomingSelections;
				update();
			}
		}
	});


	/**
	 * Update the stats panel and difficult word highlights
	 */
	function update() {
		const stats = analyse();
		if (!stats) { return; }
		
		StatsPanel.updateWithStats(stats, context.extensionUri);
	}
	

	// Finally, register our extension command with vs code.
	let disposable = vscode.commands.registerCommand('fitzgerald.fitz', () => {
		if (vscode.window.activeTextEditor) {
			update();
		} else {
			vscode.window.showWarningMessage("No active editor found");
		}
	});
	
	context.subscriptions.push(disposable);
}

// noinspection JSUnusedGlobalSymbols
export function deactivate() {}
