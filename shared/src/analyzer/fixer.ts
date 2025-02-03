import * as fs from 'fs/promises';
import * as path from 'path';
import { AnalysisResult, AnalysisError, AnalysisErrorType, AnalyzerOptions } from './types';

export interface FixOptions {
    createMissingFiles: boolean;
    renameInvalidFiles: boolean;
    moveFiles: boolean;
}

export const DEFAULT_FIX_OPTIONS: FixOptions = {
    createMissingFiles: false,
    renameInvalidFiles: false,
    moveFiles: false
};

export async function applyFixes(results: AnalysisResult[], options: FixOptions = DEFAULT_FIX_OPTIONS): Promise<void> {
    for (const result of results) {
        for (const error of result.errors) {
            switch (error.type) {
                case AnalysisErrorType.MissingTest:
                    if (options.createMissingFiles) {
                        await createMissingTestFile(result.testFilePath);
                    }
                    break;
                case AnalysisErrorType.InvalidFileName:
                    if (options.renameInvalidFiles) {
                        await renameInvalidTestFile(result.testFilePath);
                    }
                    break;
                case AnalysisErrorType.InvalidDirectoryStructure:
                    if (options.moveFiles) {
                        await moveTestFile(error, []);
                    }
                    break;
            }
        }
    }
}

async function createMissingTestFile(sourcePath: string): Promise<void> {
    // Implementation for creating missing test files
    throw new Error('Not implemented');
}

async function renameInvalidTestFile(testPath: string): Promise<void> {
    // Implementation for renaming invalid test files
    throw new Error('Not implemented');
}

interface FixResult {
    from: string;
    to: string;
}

export async function fixDirectoryStructure(results: AnalysisResult[], options: AnalyzerOptions): Promise<FixResult[]> {
    const fixedFiles: FixResult[] = [];

    for (const result of results) {
        for (const error of result.errors) {
            if (error.type === AnalysisErrorType.InvalidDirectoryStructure && 
                error.actualTestPath && 
                error.expectedTestPath && 
                error.sourceFilePath) {
                try {
                    await moveTestFile(error, fixedFiles);
                } catch (err) {
                    console.error(`Failed to fix ${error.actualTestPath}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }
        }
    }

    return fixedFiles;
}

async function moveTestFile(error: AnalysisError, fixedFiles: FixResult[]): Promise<void> {
    if (!error.actualTestPath || !error.expectedTestPath) return;

    const actualPath = error.actualTestPath;
    const expectedPath = error.expectedTestPath;

    // Read the test file content
    const content = await fs.readFile(actualPath, 'utf8');

    // Update namespace if needed
    const updatedContent = updateNamespace(content, actualPath, expectedPath);

    // Create directories as needed
    const dir = path.dirname(expectedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file to its new location
    await fs.writeFile(expectedPath, updatedContent);

    // Delete the original file
    await fs.unlink(actualPath);

    fixedFiles.push({
        from: actualPath,
        to: expectedPath
    });
}

function updateNamespace(content: string, actualPath: string, expectedPath: string): string {
    // Extract namespaces from paths
    const actualNamespace = extractNamespaceFromPath(actualPath);
    const expectedNamespace = extractNamespaceFromPath(expectedPath);

    if (actualNamespace && expectedNamespace && actualNamespace !== expectedNamespace) {
        // Replace namespace in the file
        const namespaceRegex = new RegExp(`namespace\\s+${escapeRegExp(actualNamespace)}\\b`, 'g');
        return content.replace(namespaceRegex, `namespace ${expectedNamespace}`);
    }

    return content;
}

function extractNamespaceFromPath(filePath: string): string | null {
    const parts = path.dirname(filePath).split(path.sep);
    const testIndex = parts.findIndex(p => p.endsWith('.Tests'));
    
    if (testIndex >= 0) {
        return parts.slice(testIndex).join('.');
    }
    
    return null;
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 