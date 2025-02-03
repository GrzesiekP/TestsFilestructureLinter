import * as assert from 'assert';
import * as vscode from 'vscode';
import { AnalysisErrorType } from '../../analyzer/types';
import { 
	createDiagnostic, 
	findLineNumber, 
	TestFixture, 
	findSourceFile, 
	getFixButtonTooltip, 
	generateSummaryText,
	AnalysisResult 
} from '../testUtils';

suite('Extension Test Suite', () => {
	const fixture = new TestFixture();
	fixture.customizeType(vscode.Uri, () => vscode.Uri.file('/test/path'));

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('test-filestructure-linter'));
	});

	test('Should activate', async () => {
		const ext = vscode.extensions.getExtension('test-filestructure-linter');
		await ext?.activate();
		assert.ok(true);
	});

	test('Should register commands', async () => {
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('test-filestructure-linter.analyze'));
	});
});

suite('Configuration Tests', () => {
	test('Should read showDiagnosticErrors configuration', () => {
		//Arrange
		const config = vscode.workspace.getConfiguration('testFilestructureLinter');
		
		//Act
		const showDiagnostics = config.get<boolean>('showDiagnosticErrors');
		
		//Assert
		assert.strictEqual(typeof showDiagnostics, 'boolean');
	});

	test('Should read enableExperimentalFixes configuration', () => {
		//Arrange
		const config = vscode.workspace.getConfiguration('testFilestructureLinter');
		
		//Act
		const experimentalFixes = config.get<boolean>('enableExperimentalFixes');
		
		//Assert
		assert.strictEqual(typeof experimentalFixes, 'boolean');
	});
});

suite('Diagnostic Tests', () => {
	test('Should create warning diagnostic with correct source', () => {
		//Arrange
		const message = 'Test warning message';
		const lineNumber = 5;
		const lineLength = 10;
		
		//Act
		const diagnostic = createDiagnostic(message, lineNumber, lineLength);
		
		//Assert
		assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
		assert.strictEqual(diagnostic.source, 'Test Structure Analyzer');
		assert.strictEqual(diagnostic.message, message);
	});

	test('Should find correct line number for namespace error', () => {
		//Arrange
		const lines = [
			'using System;',
			'',
			'namespace TestProject.Tests;',
			'',
			'public class TestClass',
			'{',
			'}'
		];
		const error = { type: 'InvalidDirectoryStructure', message: 'Test error' };
		
		//Act
		const lineNumber = findLineNumber(lines, error);
		
		//Assert
		assert.strictEqual(lineNumber, 2);
	});

	test('Should find correct line number for class error', () => {
		//Arrange
		const lines = [
			'using System;',
			'',
			'namespace TestProject.Tests;',
			'',
			'public class TestClass',
			'{',
			'}'
		];
		const error = { type: 'MissingTest', message: 'Test error' };
		
		//Act
		const lineNumber = findLineNumber(lines, error);
		
		//Assert
		assert.strictEqual(lineNumber, 4);
	});
});

suite('File Operation Tests', () => {
	const fixture = new TestFixture();

	test('Should find source file by class name', async () => {
		//Arrange
		const className = 'TestClass';
		const workspacePath = '/test/workspace';
		
		//Act
		const sourceFile = await findSourceFile(workspacePath, className);
		
		//Assert
		assert.ok(sourceFile === undefined || typeof sourceFile === 'string');
	});

	test('Should generate correct fix button tooltip for missing test', () => {
		//Arrange
		const results = fixture.createMany<AnalysisResult>(1, {
			errors: [{
				type: AnalysisErrorType.MissingTest,
				message: 'Missing test'
			}],
			testFilePath: '/test/path/TestClass.cs'
		});
		
		//Act
		const tooltip = getFixButtonTooltip(true, results, '/test/path/TestClass.cs');
		
		//Assert
		assert.strictEqual(tooltip, 'Create a new test file in the correct location');
	});

	test('Should generate correct fix button tooltip for misplaced test', () => {
		//Arrange
		const results = fixture.createMany<AnalysisResult>(1, {
			errors: [{
				type: AnalysisErrorType.InvalidDirectoryStructure,
				message: 'Test file in invalid directory'
			}],
			testFilePath: '/test/path/TestClass.cs'
		});
		
		//Act
		const tooltip = getFixButtonTooltip(false, results, '/test/path/TestClass.cs');
		
		//Assert
		assert.strictEqual(tooltip, 'Move test file to the correct location');
	});
});

suite('UI Generation Tests', () => {
	test('Should generate correct summary text with fixable issues', () => {
		//Arrange
		const results: AnalysisResult[] = [{
			errors: [{
				type: AnalysisErrorType.InvalidDirectoryStructure,
				message: 'Test file in invalid directory'
			}],
			testFilePath: '/test/path/TestClass.cs'
		}, {
			errors: [{
				type: AnalysisErrorType.InvalidDirectoryStructure,
				message: 'Test file in invalid directory'
			}],
			testFilePath: '/test/path/TestClass2.cs'
		}];
		const hasFixableIssues = () => true;
		const countFixableFiles = () => 2;
		
		//Act
		const summaryText = generateSummaryText(results, hasFixableIssues, countFixableFiles);
		
		//Assert
		assert.strictEqual(summaryText, '<div class="summary-text">Issues found in 2 files (2 fixable)</div>');
	});

	test('Should generate correct summary text without fixable issues', () => {
		//Arrange
		const results: AnalysisResult[] = [{
			errors: [{
				type: AnalysisErrorType.InvalidDirectoryStructure,
				message: 'Some other error'
			}],
			testFilePath: '/test/path/TestClass.cs'
		}, {
			errors: [{
				type: AnalysisErrorType.InvalidDirectoryStructure,
				message: 'Some other error'
			}],
			testFilePath: '/test/path/TestClass2.cs'
		}];
		const hasFixableIssues = () => false;
		const countFixableFiles = () => 0;
		
		//Act
		const summaryText = generateSummaryText(results, hasFixableIssues, countFixableFiles);
		
		//Assert
		assert.strictEqual(summaryText, '<div class="summary-text">Issues found in 2 files</div>');
	});
}); 