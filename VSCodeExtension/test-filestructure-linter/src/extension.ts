// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TestStructureAnalyzer } from './analyzer/testStructureAnalyzer';
import { AnalysisResult } from './analyzer/types';

let outputChannel: vscode.OutputChannel;
let diagnosticCollection: vscode.DiagnosticCollection;
let currentWebview: vscode.WebviewView | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('Test Filestructure Analyzer');
	diagnosticCollection = vscode.languages.createDiagnosticCollection('testFilestructure');


	const analyzer = new TestStructureAnalyzer();

	// Register webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('testFilestructureLinter', {
			resolveWebviewView(webviewView) {
				webviewView.webview.options = {
					enableScripts: true

				};
				
				updateInitialView();

				// Store the webview
				currentWebview = webviewView;

				// Update view when workspace folders change
				context.subscriptions.push(
					vscode.workspace.onDidChangeWorkspaceFolders(() => {
						updateInitialView();
					})
				);
			}
		})
	);

	const analyzeCommand = vscode.commands.registerCommand('test-filestructure-linter.analyze', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found. Please open a folder to analyze test structure.');
			return;
		}

		try {
			outputChannel.clear();
			outputChannel.show();
			outputChannel.appendLine('Starting test structure analysis...');

			const results = await analyzer.analyzeWorkspace(workspaceFolder.uri.fsPath);
			updateDiagnostics(results);
			showAnalysisResults(results);
			updateWebview(results);

			outputChannel.appendLine('Analysis completed.');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
			outputChannel.appendLine(`Error: ${errorMessage}`);
		}
	});

	context.subscriptions.push(analyzeCommand, outputChannel, diagnosticCollection);
}

function updateInitialView() {
	if (!currentWebview) {
		return;
	}

	const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
	currentWebview.webview.html = getInitialHtml(hasWorkspace ? true : false);
}

function updateWebview(results: AnalysisResult[]) {
	if (!currentWebview) {
		return;
	}

	const issueCount = results.reduce((count, result) => count + result.errors.length, 0);
	
	let html = `<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { 
					padding: 10px; 
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					background-color: var(--vscode-editor-background);
				}
				.error { color: var(--vscode-errorForeground); }
				.file-path { color: var(--vscode-textLink-foreground); }
				.suggestion { 
					color: var(--vscode-notificationsInfoIcon-foreground);
					margin-left: 20px;
				}
				.summary { 
					margin-bottom: 20px;
					padding: 10px;
					background-color: var(--vscode-editor-inactiveSelectionBackground);
					border-radius: 4px;
				}
				.no-issues { color: var(--vscode-testing-iconPassed); }
				.file {
					margin-bottom: 16px;
					padding: 10px;
					background-color: var(--vscode-editor-lineHighlightBackground);
					border-radius: 4px;
				}
			</style>
		</head>
		<body>
			<div class="summary">
				${issueCount === 0 
					? '<div class="no-issues">✓ No issues found</div>'
					: `Found ${issueCount} issue${issueCount === 1 ? '' : 's'}`}
			</div>`;

	if (results.length > 0) {
		for (const result of results) {
			html += `<div class="file">
				<div class="file-path">${result.testFilePath}</div>`;
			
			for (const error of result.errors) {
				html += `<div class="error">❌ ${error.message}</div>`;
				if (error.suggestion) {
					html += `<div class="suggestion">💡 ${error.suggestion}</div>`;
				}
			}
			
			html += '</div>';
		}
	}

	html += '</body></html>';
	
	currentWebview.webview.html = html;
}

function getInitialHtml(hasWorkspace: boolean): string {
	const message = hasWorkspace
		? 'Click the analyze button (🔍) in the title bar above to start test structure analysis.'
		: 'Please open a folder or workspace to analyze test structure. The analyze button will be enabled once a folder is opened.';

	return `<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { 
					padding: 16px; 
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					background-color: var(--vscode-editor-background);
				}
				.message-container {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					text-align: center;
					min-height: 200px;
				}
				.icon {
					font-size: 48px;
					margin-bottom: 16px;
					opacity: 0.6;
				}
				.message { 
					color: var(--vscode-descriptionForeground);
					max-width: 300px;
					line-height: 1.4;
				}
			</style>
		</head>
		<body>
			<div class="message-container">
				<div class="icon">${hasWorkspace ? '🔍' : '📁'}</div>
				<div class="message">
					${message}
				</div>
			</div>
		</body>
		</html>`
}

function updateDiagnostics(results: AnalysisResult[]) {
	diagnosticCollection.clear();

	for (const result of results) {
		const diagnostics: vscode.Diagnostic[] = result.errors.map(error => {
			const diagnostic = new vscode.Diagnostic(
				new vscode.Range(0, 0, 0, 0),
				error.message,
				vscode.DiagnosticSeverity.Error
			);
			diagnostic.source = 'Test Structure Analyzer';
			if (error.suggestion) {
				diagnostic.relatedInformation = [
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(vscode.Uri.file(result.testFilePath), new vscode.Position(0, 0)),
						error.suggestion
					)
				];
			}
			return diagnostic;
		});

		diagnosticCollection.set(vscode.Uri.file(result.testFilePath), diagnostics);
	}
}

function showAnalysisResults(results: AnalysisResult[]) {
	if (results.length === 0) {
		outputChannel.appendLine('No issues found.');
		vscode.window.showInformationMessage('Test structure analysis completed: No issues found.');
		return;
	}

	outputChannel.appendLine('\nAnalysis Results:');
	outputChannel.appendLine('=================\n');

	for (const result of results) {
		outputChannel.appendLine(`File: ${result.testFilePath}`);
		for (const error of result.errors) {
			outputChannel.appendLine(`  - ${error.message}`);
			if (error.suggestion) {
				outputChannel.appendLine(`    Suggestion: ${error.suggestion}`);
			}
		}
		outputChannel.appendLine('');
	}

	const issueCount = results.reduce((count, result) => count + result.errors.length, 0);
	vscode.window.showWarningMessage(
		`Test structure analysis completed: Found ${issueCount} issue${issueCount === 1 ? '' : 's'}. Check the output panel for details.`
	);
}

export function deactivate() {
	if (outputChannel) {
		outputChannel.dispose();
	}
	if (diagnosticCollection) {
		diagnosticCollection.dispose();
	}
}