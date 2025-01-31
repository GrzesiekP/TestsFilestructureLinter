// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TestStructureAnalyzer } from './analyzer/testStructureAnalyzer';
import { AnalysisResult } from './analyzer/types';
import * as path from 'path';

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
			updateWebview(results, context);

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
	currentWebview.webview.html = getInitialHtml(!!hasWorkspace);
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
		</html>`;
}

function updateWebview(results: AnalysisResult[], context: vscode.ExtensionContext) {
	if (!currentWebview) {
		return;
	}

	const lastAnalyzedTime = new Date().toLocaleTimeString();
	const totalFilesAnalyzed = results.reduce((count, result) => count + 1, 0);
	const hasIssues = results.length > 0;

	let html = `<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { 
					padding: 16px; 
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					background-color: var(--vscode-editor-background);
				}
				.summary {
					padding: 12px;
					margin-bottom: 20px;
					border-radius: 4px;
					border: 1px solid;
					border-color: ${hasIssues ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-testing-iconPassed)'};
					background-color: ${hasIssues ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-inputValidation-infoBackground)'};
				}
				.summary-text {
					margin: 4px 0;
					color: ${hasIssues ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-testing-iconPassed)'};
				}
				.file-container {
					margin-bottom: 12px;
				}
				.file-header {
					cursor: pointer;
					padding: 8px;
					background-color: var(--vscode-editor-lineHighlightBackground);
					border-radius: 4px;
					user-select: none;
				}
				.file-header:hover {
					background-color: var(--vscode-editor-lineHighlightBorder);
				}
				.file-content {
					display: none;
					padding: 8px 8px 8px 24px;
				}
				.file-path {
					color: var(--vscode-descriptionForeground);
					margin: 4px 0;
					cursor: pointer;
					text-decoration: none;
				}
				.file-path:hover {
					text-decoration: underline;
					color: var(--vscode-textLink-foreground);
				}
				.error {
					color: var(--vscode-errorForeground);
					margin: 4px 0;
				}
				.arrow {
					display: inline-block;
					width: 16px;
				}
			</style>
		</head>
		<body>
			<div class="summary">
				<div class="summary-text">Files analyzed: ${totalFilesAnalyzed}</div>
				<div class="summary-text">Last analyzed at: ${lastAnalyzedTime}</div>
				${hasIssues ? `<div class="summary-text">Issues found in ${results.length} files</div>` : ''}
			</div>`;

	if (results.length > 0) {
		for (const result of results) {
			const fileName = path.basename(result.testFilePath);
			html += `
				<div class="file-container">
					<div class="file-header" onclick="toggleContent(this)">
						<span class="arrow">▶</span> ${fileName}
					</div>
					<div class="file-content">
						<a class="file-path" data-path="${result.testFilePath}">${result.testFilePath}</a>
						${result.errors.map(error => `<div class="error">❌ ${error.message}</div>`).join('')}
					</div>
				</div>`;
		}
	} else {
		html += '<div style="color: var(--vscode-descriptionForeground);">No issues found.</div>';
	}

	html += `
		<script>
			function toggleContent(header) {
				const content = header.nextElementSibling;
				const arrow = header.querySelector('.arrow');
				const isExpanded = content.style.display === 'block';
				
				content.style.display = isExpanded ? 'none' : 'block';
				arrow.textContent = isExpanded ? '▶' : '▼';
			}

			const vscode = acquireVsCodeApi();
			document.addEventListener('click', (e) => {
				if (e.target.classList.contains('file-path')) {
					e.preventDefault();
					vscode.postMessage({
						command: 'openFile',
						filePath: e.target.dataset.path
					});
				}
			});
		</script>
		</body>
		</html>`;

	currentWebview.webview.html = html;

	// Handle messages from the webview
	currentWebview.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case 'openFile':
					vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.filePath));
					return;
			}
		},
		undefined,
		context.subscriptions
	);
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