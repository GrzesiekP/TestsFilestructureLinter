import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ensureDirectoryExists, updateNamespace } from '../testUtils';

suite('File Operations Tests', () => {
	let tempDir: string;

	setup(async () => {
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-filestructure-'));
		
		// Create basic project structure
		await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
		await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
	});

	teardown(async () => {
		await fs.promises.rm(tempDir, { recursive: true, force: true });
	});

	test('Should create directory structure correctly', async () => {
		//Arrange
		const targetDir = path.join(tempDir, 'tests', 'Project.Tests', 'Common', 'Handlers');
		
		//Act
		await ensureDirectoryExists(targetDir);
		
		//Assert
		const dirExists = await fs.promises.access(targetDir)
			.then(() => true)
			.catch(() => false);
		assert.ok(dirExists);
	});

	test('Should not recreate existing directories', async () => {
		//Arrange
		const existingDir = path.join(tempDir, 'tests', 'Project.Tests');
		const targetDir = path.join(existingDir, 'Common');
		await fs.promises.mkdir(existingDir, { recursive: true });
		
		//Act
		await ensureDirectoryExists(targetDir);
		
		//Assert
		const dirExists = await fs.promises.access(targetDir)
			.then(() => true)
			.catch(() => false);
		assert.ok(dirExists);
	});

	test('Should update namespace when moving test file', async () => {
		//Arrange
		const sourceFile = path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs');
		const testFile = path.join(tempDir, 'tests', 'Project.Tests', 'Handlers', 'HandlerTests.cs');
		const testContent = 'namespace Project.Tests.Handlers;\n\npublic class HandlerTests {}';
		
		await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
		await fs.promises.mkdir(path.dirname(testFile), { recursive: true });
		
		await fs.promises.writeFile(sourceFile, 'public class Handler {}');
		await fs.promises.writeFile(testFile, testContent);

		//Act
		await updateNamespace(
			testFile,
			sourceFile,
			tempDir,
			path.join(tempDir, 'tests', 'Project.Tests')
		);

		//Assert
		const updatedContent = await fs.promises.readFile(testFile, 'utf8');
		assert.ok(updatedContent.includes('namespace Project.Tests.Common;'));
	});

	test('Should preserve indentation when updating namespace', async () => {
		//Arrange
		const testFile = path.join(tempDir, 'tests', 'Project.Tests', 'HandlerTests.cs');
		const testContent = '    namespace Project.Tests.Handlers;\n\npublic class HandlerTests {}';
		
		await fs.promises.mkdir(path.dirname(testFile), { recursive: true });
		await fs.promises.writeFile(testFile, testContent);

		//Act
		await updateNamespace(
			testFile,
			path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs'),
			tempDir,
			path.join(tempDir, 'tests', 'Project.Tests')
		);

		//Assert
		const updatedContent = await fs.promises.readFile(testFile, 'utf8');
		assert.ok(updatedContent.startsWith('    namespace'));
	});

	test('Should handle missing namespace declaration', async () => {
		//Arrange
		const testFile = path.join(tempDir, 'tests', 'Project.Tests', 'HandlerTests.cs');
		const testContent = 'public class HandlerTests {}';
		
		await fs.promises.mkdir(path.dirname(testFile), { recursive: true });
		await fs.promises.writeFile(testFile, testContent);

		//Act & Assert
		await assert.doesNotReject(async () => 
			await updateNamespace(
				testFile,
				path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs'),
				tempDir,
				path.join(tempDir, 'tests', 'Project.Tests')
			)
		);
	});

	test('Should handle non-existent test file when updating namespace', async () => {
		//Arrange
		const nonExistentFile = path.join(tempDir, 'tests', 'Project.Tests', 'NonExistent.cs');

		//Act & Assert
		await assert.rejects(
			async () => await updateNamespace(
				nonExistentFile,
				path.join(tempDir, 'src', 'Project', 'Common', 'Handler.cs'),
				tempDir,
				path.join(tempDir, 'tests', 'Project.Tests')
			)
		);
	});
}); 