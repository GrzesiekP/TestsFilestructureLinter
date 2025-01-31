import * as assert from 'assert';
import * as path from 'path';
import { TestStructureAnalyzer } from '../../analyzer/testStructureAnalyzer';
import { AnalysisErrorType } from '../../analyzer/types';
import * as fs from 'fs';
import * as os from 'os';

suite('TestStructureAnalyzer Tests', () => {
	let analyzer: TestStructureAnalyzer;
	let tempDir: string;

	setup(async () => {
		analyzer = new TestStructureAnalyzer();
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-filestructure-'));
		
		// Create basic project structure
		await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
		await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
	});

	teardown(async () => {
		await fs.promises.rm(tempDir, { recursive: true, force: true });
	});

	test('Should find test projects', async () => {
		//Arrange
		const testProjectPath = path.join(tempDir, 'tests', 'Project.Tests');
		await fs.promises.mkdir(testProjectPath, { recursive: true });
		await fs.promises.writeFile(
			path.join(testProjectPath, 'Project.Tests.csproj'),
			'<Project Sdk="Microsoft.NET.Sdk">\n</Project>'
		);

		//Act
		const testProjects = await analyzer.findTestProjects(path.join(tempDir, 'tests'));

		//Assert
		assert.strictEqual(testProjects.length, 1);
		assert.strictEqual(path.basename(testProjects[0]), 'Project.Tests');
	});

	test('Should detect missing test file', async () => {
		//Arrange
		const sourceFile = path.join(tempDir, 'src', 'Project', 'Handler.cs');
		await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
		await fs.promises.writeFile(sourceFile, 'public class Handler {}');

		//Act
		const results = await analyzer.analyzeWorkspace(tempDir);

		//Assert
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].errors[0].type, AnalysisErrorType.MissingTest);
	});

	test('Should detect test file in wrong directory', async () => {
		//Arrange
		const sourceFile = path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs');
		const testFile = path.join(tempDir, 'tests', 'Project.Tests', 'Handlers', 'HandlerTests.cs');
		
		await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
		await fs.promises.mkdir(path.dirname(testFile), { recursive: true });
		
		await fs.promises.writeFile(sourceFile, 'public class Handler {}');
		await fs.promises.writeFile(testFile, 'public class HandlerTests {}');

		//Act
		const results = await analyzer.analyzeWorkspace(tempDir);

		//Assert
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].errors[0].type, AnalysisErrorType.InvalidDirectoryStructure);
	});

	test('Should get correct expected test path', async () => {
		//Arrange
		const sourceFile = path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs');
		const testProjectPath = path.join(tempDir, 'tests', 'Project.Tests');
		
		//Act
		const expectedPath = analyzer.getExpectedTestPath(sourceFile, tempDir, testProjectPath);

		//Assert
		assert.strictEqual(
			path.normalize(expectedPath),
			path.normalize(path.join(testProjectPath, 'Common', 'HandlerTests.cs'))
		);
	});

	test('Should handle non-existent source file', async () => {
		//Arrange
		const nonExistentFile = path.join(tempDir, 'src', 'Project', 'NonExistent.cs');

		//Act & Assert
		await assert.rejects(
			async () => await analyzer.analyzeWorkspace(tempDir),
			/No source files found/
		);
	});

	test('Should handle empty test directory', async () => {
		//Arrange
		const sourceFile = path.join(tempDir, 'src', 'Project', 'Handler.cs');
		await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
		await fs.promises.writeFile(sourceFile, 'public class Handler {}');

		//Act
		const results = await analyzer.analyzeWorkspace(tempDir);

		//Assert
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].errors[0].type, AnalysisErrorType.MissingTest);
	});

	test('Should handle multiple test projects', async () => {
		//Arrange
		const testProjects = ['Project1.Tests', 'Project2.Tests'];
		for (const project of testProjects) {
			const projectPath = path.join(tempDir, 'tests', project);
			await fs.promises.mkdir(projectPath, { recursive: true });
			await fs.promises.writeFile(
				path.join(projectPath, `${project}.csproj`),
				'<Project Sdk="Microsoft.NET.Sdk">\n</Project>'
			);
		}

		//Act
		const foundProjects = await analyzer.findTestProjects(path.join(tempDir, 'tests'));

		//Assert
		assert.strictEqual(foundProjects.length, 2);
		assert.ok(foundProjects.every(p => testProjects.includes(path.basename(p))));
	});
}); 