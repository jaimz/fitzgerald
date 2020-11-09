// Renders and managers a webview displaying various readability stats for the currently
// selected text file.
import * as vscode from 'vscode';
import {ViewColumn} from "vscode";

import { Stats } from "./Analysis";
import {initialiseWebviewContent} from "./WebContent";


/**
 * Manages the statistics web view.
 */
export class StatsPanel {
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

        initialiseWebviewContent(panel.webview, extensionUri);
    }

    // Bring the existing webview into focus
    private reveal(column: ViewColumn) {
        this._panel.reveal(column);
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