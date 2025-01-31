import * as vscode from 'vscode';
import * as path from 'path';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
	const parts = dirPath.split(path.sep);
	let currentPath = parts[0];

	for (let i = 1; i < parts.length; i++) {
		currentPath = path.join(currentPath, parts[i]);
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(currentPath));
		} catch {
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(currentPath));
		}
	}
}

export async function updateNamespace(filePath: string, sourceFile: string, workspacePath: string, testProjectPath: string): Promise<void> {
	const fileContent = (await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))).toString();
	const lines = fileContent.split('\n');
	
	// Find namespace line
	const namespaceLineIndex = lines.findIndex(line => line.trim().startsWith('namespace'));
	if (namespaceLineIndex === -1) return;

	// Get source project and relative path
	const sourceRoot = path.join(workspacePath, 'src');
	const relativeSourcePath = path.relative(sourceRoot, path.dirname(sourceFile));
	const pathParts = relativeSourcePath.split(path.sep);
	const sourceProjectName = pathParts[0];
	const remainingPath = pathParts.slice(1).join('.');

	// Construct new namespace
	const testProjectName = sourceProjectName + '.Tests';
	const newNamespace = remainingPath 
		? `${testProjectName}.${remainingPath}` 
		: testProjectName;

	// Replace old namespace with new one
	const oldLine = lines[namespaceLineIndex];
	const indentation = oldLine.match(/^\s*/)?.[0] || '';
	lines[namespaceLineIndex] = `${indentation}namespace ${newNamespace};`;

	// Write updated content back to file
	await vscode.workspace.fs.writeFile(
		vscode.Uri.file(filePath),
		Buffer.from(lines.join('\n'), 'utf8')
	);
}

export function createDiagnostic(message: string, lineNumber: number, lineLength: number = 0): vscode.Diagnostic {
	const range = new vscode.Range(lineNumber, 0, lineNumber, lineLength);
	const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
	diagnostic.source = 'Test Structure Analyzer';
	return diagnostic;
}

export function findLineNumber(lines: string[], error: { type: string, message: string }): number {
	const searchPattern = error.type === 'InvalidDirectoryStructure' ? 
		'namespace' : 'public class';
	
	return lines.findIndex(line => line.trim().startsWith(searchPattern)) || 0;
}

export function getFixButtonTooltip(isMissingTest: boolean, results: any[], testFilePath: string): string {
	if (!isMissingTest) {
		return 'Move test file to the correct location';
	}
	
	const hasMisplacedTest = results.some(r => 
		r.errors.some((e: any) => 
			e.type === 'InvalidDirectoryStructure' &&
			path.basename(r.testFilePath, '.cs').replace('Tests', '') === path.basename(testFilePath, '.cs')
		)
	);
	
	return hasMisplacedTest 
		? 'Move existing test file to the correct location' 
		: 'Create a new test file in the correct location';
}

export class TestFixture {
	private uriFactory?: () => vscode.Uri;

	customizeType(type: typeof vscode.Uri, factory: () => vscode.Uri): void {
		this.uriFactory = factory;
	}

	createMany<T>(count: number, template: Partial<T>): T[] {
		return Array(count).fill(null).map(() => {
			const result = { ...template } as T;
			if (this.uriFactory && 'uri' in template) {
				(result as any).uri = this.uriFactory();
			}
			return result;
		});
	}
}

export async function findSourceFile(workspacePath: string, className: string): Promise<string | undefined> {
	const files = await vscode.workspace.findFiles(
		`src/**/${className}.cs`,
		'**/bin/**,**/obj/**'
	);
	return files[0]?.fsPath;
}

export interface AnalysisResult {
	errors: { type: string; message: string }[];
	testFilePath: string;
}

export function generateSummaryText(
	results: AnalysisResult[], 
	hasFixableIssues: () => boolean, 
	countFixableFiles: (results: AnalysisResult[]) => number
): string {
	const fixableText = hasFixableIssues() ? ` (${countFixableFiles(results)} fixable)` : '';
	return `<div class="summary-text">Issues found in ${results.length} files${fixableText}</div>`;
} 