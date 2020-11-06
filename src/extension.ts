// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as rs from 'text-readability';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('"fitzgerald" is now active!');

	const composeMessage = (text : string) => (
		`Syllables: ${rs.syllableCount(text)}\nSentences: ${rs.sentenceCount(text)}\nGrade: ${rs.textStandard(text, true)}`
	)

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('fitzgerald.helloWorld', () => {
		const activeEditor = vscode.window.activeTextEditor;

		if (activeEditor) {
			const document = activeEditor.document;
			
			// Confusingly, VSC seems to take the current insertion point as a "selection" so filter out any empty ones.
			const selections = activeEditor.selections.filter((selection) => !selection.isEmpty);

			// The text to analyse is the union of all the selected text
			const text = selections.length > 0 ? selections.map((selection) => document.getText(selection)).join(" ") : activeEditor.document.getText();

			vscode.window.showInformationMessage(composeMessage(text));
		} else {
			vscode.window.showWarningMessage("No active editor found");
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
