// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TestStructureAnalyzer } from './analyzer/testStructureAnalyzer';
import { AnalysisResult } from './analyzer/types';
import * as path from 'path';
import { AnalysisErrorType } from './analyzer/types';

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

async function handleFixAction(filePath: string, errorType?: AnalysisErrorType) {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found.');
			return;
		}

		const analyzer = new TestStructureAnalyzer();
		const results = await analyzer.analyzeWorkspace(workspaceFolder.uri.fsPath);

		if (errorType === AnalysisErrorType.MissingTest) {
			// This is a source file that needs a test
			const sourceFile = filePath;
			const sourceFileName = path.basename(sourceFile);
			const className = sourceFileName.replace('.cs', '');

			// First check if there's a misplaced test file
			const misplacedTest = results.find(r => 
				r.errors.some(e => 
					e.type === AnalysisErrorType.InvalidDirectoryStructure &&
					path.basename(r.testFilePath, '.cs').replace('Tests', '') === className
				)
			);

			if (misplacedTest) {
				// Move the existing test file to the correct location
				await moveTestFile(misplacedTest.testFilePath, sourceFile, workspaceFolder.uri.fsPath);
			} else {
				// Create a new test file
				await createTestFile(sourceFile, workspaceFolder.uri.fsPath);
			}
		} else {
			// This is a test file that needs to be moved
			const fileToFix = results.find(r => r.testFilePath === filePath);
			if (!fileToFix) {
				vscode.window.showErrorMessage('Could not find file to fix.');
				return;
			}

			const testFileName = path.basename(filePath);
			const testedClassName = testFileName.replace('Tests.cs', '');
			const sourceFile = await findSourceFile(workspaceFolder.uri.fsPath, testedClassName);

			if (!sourceFile) {
				vscode.window.showErrorMessage('Could not find source file.');
				return;
			}

			await moveTestFile(filePath, sourceFile, workspaceFolder.uri.fsPath);
		}

		// Refresh the view
		vscode.commands.executeCommand('test-filestructure-linter.analyze');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to fix file: ${errorMessage}`);
	}
}

async function createTestFile(sourceFile: string, workspacePath: string): Promise<void> {
	const analyzer = new TestStructureAnalyzer();
	const testProjects = await analyzer.findTestProjects(path.join(workspacePath, analyzer.getTestRoot()));
	if (testProjects.length === 0) {
		throw new Error('No test projects found.');
	}

	const expectedTestPath = analyzer.getExpectedTestPath(sourceFile, workspacePath, testProjects[0]);
	
	// Create directory if it doesn't exist
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(expectedTestPath)));

	// Create empty test file
	await vscode.workspace.fs.writeFile(
		vscode.Uri.file(expectedTestPath),
		Buffer.from('', 'utf8')
	);

	vscode.window.showInformationMessage(`Created test file at: ${expectedTestPath}`);
}

async function moveTestFile(testFilePath: string, sourceFile: string, workspacePath: string): Promise<void> {
	const analyzer = new TestStructureAnalyzer();
	const testProjects = await analyzer.findTestProjects(path.join(workspacePath, analyzer.getTestRoot()));
	if (testProjects.length === 0) {
		throw new Error('No test projects found.');
	}

	const expectedTestPath = analyzer.getExpectedTestPath(sourceFile, workspacePath, testProjects[0]);

	// Create directory if it doesn't exist
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(expectedTestPath)));

	// Move the file
	await vscode.workspace.fs.rename(
		vscode.Uri.file(testFilePath),
		vscode.Uri.file(expectedTestPath),
		{ overwrite: false }
	);

	vscode.window.showInformationMessage(`Successfully moved test file to: ${expectedTestPath}`);
}

async function handleFixAllAction(filePaths: string[], context: vscode.ExtensionContext) {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found.');
			return;
		}

		const analyzer = new TestStructureAnalyzer();
		const results = await analyzer.analyzeWorkspace(workspaceFolder.uri.fsPath);

		// Collect all fixable files
		const filesToFix = results.filter(result => {
			const isInvalidDir = result.errors.some(error => 
				error.type === AnalysisErrorType.InvalidDirectoryStructure && 
				error.message.includes('Test file in invalid directory')
			);
			const isMissingTest = result.errors.some(error => 
				error.type === AnalysisErrorType.MissingTest
			);
			return isInvalidDir || isMissingTest;
		});

		// Fix each file
		for (const fileToFix of filesToFix) {
			const isMissingTest = fileToFix.errors.some(error => 
				error.type === AnalysisErrorType.MissingTest
			);
			await handleFixAction(fileToFix.testFilePath, 
				isMissingTest ? AnalysisErrorType.MissingTest : AnalysisErrorType.InvalidDirectoryStructure
			);
		}

		// Show success message
		vscode.window.showInformationMessage('All Fixed');

		// Update the view by removing fixed files
		const remainingResults = results.filter(result => !filesToFix.includes(result));
		updateDiagnostics(remainingResults);
		showAnalysisResults(remainingResults);
		updateWebview(remainingResults, context);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to fix all files: ${errorMessage}`);
	}
}

async function findSourceFile(workspacePath: string, className: string): Promise<string | undefined> {
	const files = await vscode.workspace.findFiles(
		`src/**/${className}.cs`,
		'**/bin/**,**/obj/**'
	);
	
	return files[0]?.fsPath;
}

function updateWebview(results: AnalysisResult[], context: vscode.ExtensionContext) {
	if (!currentWebview) {
		return;
	}

	const config = vscode.workspace.getConfiguration('testFilestructureLinter');
	const experimentalFixesEnabled = config.get<boolean>('enableExperimentalFixes') ?? false;

	const lastAnalyzedTime = new Date().toLocaleTimeString();
	const totalFilesAnalyzed = results.reduce((count, result) => count + 1, 0);
	const hasIssues = results.length > 0;

	function hasFixableIssues() {
		return results.some(result => 
			result.errors.some(error => 
				error.type === AnalysisErrorType.InvalidDirectoryStructure && 
				error.message.includes('Test file in invalid directory')
			)
		);
	}

	function countFixableFiles(results: AnalysisResult[]): number {
		return results.filter(result => 
			result.errors.some(error => 
				error.type === AnalysisErrorType.InvalidDirectoryStructure && 
				error.message.includes('Test file in invalid directory')
			)
		).length;
	}

	let html = `<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { 
					padding: 0; 
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					background-color: var(--vscode-editor-background);
				}
				.summary {
					padding: 12px;
					margin: 8px 12px 16px;
					border-radius: 4px;
					border: 1px solid;
					border-color: ${hasIssues ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-testing-iconPassed)'};
					background-color: ${hasIssues ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-inputValidation-infoBackground)'};
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.summary-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
				.summary-stats {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.summary-text {
					margin: 4px 0;
					color: ${hasIssues ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-testing-iconPassed)'};
				}
				.tree {
					padding: 0;
				}
				.file-container {
					margin: 0;
				}
				.file-header {
					cursor: pointer;
					padding: 3px 0 3px 16px;
					user-select: none;
					display: flex;
					align-items: center;
					height: 22px;
					color: var(--vscode-foreground);
					line-height: 22px;
					font-size: 13px;
					justify-content: space-between;
				}
				.file-header-content {
					display: flex;
					align-items: center;
					gap: 8px;
				}
				.file-header:hover {
					background-color: var(--vscode-list-hoverBackground);
				}
				.file-header.expanded {
					background-color: var(--vscode-list-activeSelectionBackground);
					color: var(--vscode-list-activeSelectionForeground);
				}
				.file-content {
					display: none;
					margin-left: 16px;
				}
				.file-path {
					color: var(--vscode-descriptionForeground);
					padding: 3px 0 3px 16px;
					cursor: pointer;
					text-decoration: none;
					word-break: break-word;
					display: block;
					min-height: 22px;
					line-height: 22px;
					font-size: 13px;
					white-space: normal;
				}
				.file-path:hover {
					background-color: var(--vscode-list-hoverBackground);
					text-decoration: underline;
					color: var(--vscode-textLink-foreground);
				}
				.error {
					color: var(--vscode-editorWarning-foreground);
					padding: 3px 0 3px 16px;
					display: flex;
					align-items: flex-start;
					gap: 6px;
					min-height: 22px;
					line-height: 22px;
					font-size: 13px;
					position: relative;
					white-space: normal;
				}
				.error:hover {
					background-color: var(--vscode-list-hoverBackground);
				}
				.error-message {
					flex-grow: 1;
					padding-right: 8px;
					padding-left: 20px;
					white-space: normal;
					word-break: break-word;
				}
				.error-icon {
					flex-shrink: 0;
					color: var(--vscode-editorWarning-foreground);
					font-size: 16px;
					line-height: 22px;
					margin-right: 4px;
				}
				.fix-button {
					background-color: var(--vscode-button-secondaryBackground);
					color: var(--vscode-button-secondaryForeground);
					border: 1px solid var(--vscode-button-border, transparent);
					padding: 4px 10px;
					border-radius: 4px;
					cursor: pointer;
					font-size: 12px;
					display: ${experimentalFixesEnabled ? 'inline-block' : 'none'};
					white-space: nowrap;
					margin-right: 8px;
					flex-shrink: 0;
					height: 22px;
					line-height: 14px;
					font-family: var(--vscode-font-family);
				}
				.fix-button:hover {
					background-color: var(--vscode-button-secondaryHoverBackground);
					color: var(--vscode-button-secondaryForeground);
				}
				.arrow {
					display: inline-flex;
					width: 16px;
					height: 16px;
					justify-content: center;
					align-items: center;
					margin-right: 4px;
					font-size: 16px;
					line-height: 22px;
				}
				.no-issues {
					padding: 3px 0 3px 16px;
					color: var(--vscode-descriptionForeground);
					height: 22px;
					line-height: 22px;
					font-size: 13px;
				}
				.fix-all-button {
					background-color: var(--vscode-button-secondaryBackground);
					color: var(--vscode-button-secondaryForeground);
					border: 1px solid var(--vscode-button-border, transparent);
					padding: 4px 10px;
					border-radius: 4px;
					cursor: pointer;
					font-size: 12px;
					display: ${experimentalFixesEnabled ? 'inline-block' : 'none'};
					white-space: nowrap;
					height: 24px;
					line-height: 14px;
					font-family: var(--vscode-font-family);
					align-self: flex-start;
				}
				.fix-all-button:hover {
					background-color: var(--vscode-button-secondaryHoverBackground);
					color: var(--vscode-button-secondaryForeground);
				}
			</style>
		</head>
		<body>
			<div class="summary">
				<div class="summary-header">
					<div class="summary-stats">
						<div class="summary-text">Files analyzed: ${totalFilesAnalyzed}</div>
						<div class="summary-text">Last analyzed at: ${lastAnalyzedTime}</div>
						${hasIssues ? `<div class="summary-text">Issues found in ${results.length} files${hasFixableIssues() ? ` (${countFixableFiles(results)} fixable)` : ''}</div>` : ''}
					</div>
					${hasFixableIssues() ? `<button class="fix-all-button">Fix All</button>` : ''}
				</div>
			</div>
			<div class="tree">`;

	if (results.length > 0) {
		for (const result of results) {
			const fileName = path.basename(result.testFilePath);
			const isFixable = result.errors.some(error => 
				error.type === AnalysisErrorType.InvalidDirectoryStructure && 
				error.message.includes('Test file in invalid directory')
			);
			const isMissingTest = result.errors.some(error => 
				error.type === AnalysisErrorType.MissingTest
			);

			html += `
				<div class="file-container">
					<div class="file-header" onclick="toggleContent(this)">
						<div class="file-header-content">
							${fileName}
						</div>
						${(isFixable || isMissingTest) && experimentalFixesEnabled ? 
							`<button class="fix-button" data-error-type="${isMissingTest ? AnalysisErrorType.MissingTest : AnalysisErrorType.InvalidDirectoryStructure}" data-file-path="${result.testFilePath}">Fix</button>` : 
							''}
					</div>
					<div class="file-content">
						<a class="file-path" data-path="${result.testFilePath}">${result.testFilePath}</a>
						${result.errors.map(error => `
							<div class="error">
								<span class="error-icon">⚠</span>
								<div class="error-message">${error.message}</div>
							</div>`).join('')}
					</div>
				</div>`;
		}
	} else {
		html += '<div class="no-issues">No issues found.</div>';
	}

	html += `</div>
		<script>
			const vscode = acquireVsCodeApi();

			function countFixableFiles(results) {
				return results.filter(result => 
					result.errors.some(error => 
						error.type === AnalysisErrorType.InvalidDirectoryStructure && 
						error.message.includes('Test file in invalid directory')
					)
				).length;
			}

			function toggleContent(header) {
				const content = header.nextElementSibling;
				const isExpanded = content.style.display === 'block';
				
				content.style.display = isExpanded ? 'none' : 'block';
				header.classList.toggle('expanded', !isExpanded);
			}

			document.addEventListener('click', (e) => {
				if (e.target.classList.contains('file-path')) {
					e.preventDefault();
					vscode.postMessage({
						command: 'openFile',
						filePath: e.target.dataset.path
					});
				} else if (e.target.classList.contains('fix-button')) {
					e.preventDefault();
					const button = e.target;
					vscode.postMessage({
						command: 'fix',
						errorType: button.dataset.errorType,
						filePath: button.dataset.filePath
					});
				} else if (e.target.classList.contains('fix-all-button')) {
					e.preventDefault();
					vscode.postMessage({
						command: 'fixAll'
					});
				}
			});
		</script>
		</body>
		</html>`;

	currentWebview.webview.html = html;

	// Update the message handler
	currentWebview.webview.onDidReceiveMessage(
		async message => {
			switch (message.command) {
				case 'openFile':
					vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.filePath));
					return;
				case 'fix':
					await handleFixAction(message.filePath, message.errorType);
					return;
				case 'fixAll':
					await handleFixAllAction(message.filePaths, context);
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