import {
    exec
} from 'child_process';
import {
    promisify
} from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

describe('CLI Tool Tests', () => {
    // Helper function to execute the CLI tool with the specified arguments
    const executeCLI = async (args: string): Promise<{
        stdout: string;
        stderr: string;
        jsonOutput: any;
    }> => {
        const outputFile = `test-output-${Date.now()}.json`;
        try {
            const result = await execAsync(`node ./dist/index.js ${args} -o ${outputFile}`);
            
            // Read and parse JSON file
            const jsonContent = await fs.promises.readFile(outputFile, 'utf-8');
            const jsonOutput = JSON.parse(jsonContent);
            
            // Clean up temp file
            await fs.promises.unlink(outputFile);
            
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                jsonOutput
            };
        } catch (error: any) {
            // Handle error case - still try to read JSON if it exists
            let jsonOutput = null;
            try {
                const jsonContent = await fs.promises.readFile(outputFile, 'utf-8');
                jsonOutput = JSON.parse(jsonContent);
                await fs.promises.unlink(outputFile);
            } catch {}
            
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                jsonOutput
            };
        }
    };

    describe('Scenario 1: Default options', () => {
        let jsonOutput: any;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n');
            jsonOutput = result.jsonOutput;
        });

        const hasIssue = (fileName: string) => 
            jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);

        const hasNormalizedPathContaining = (path: string) => {
            const allPathsNormalized = jsonOutput.filesWithIssues.map((issue: any) => issue.currentTestFile?.replace(/\\/g, '/'));
            return allPathsNormalized.some((p: string) => p && p.includes(path));
        };

        it('should have 7 issues in summary', () => {
            expect(jsonOutput.summary.totalFilesWithIssues).toBe(7);
        });

        it('should find 7 issues', () => {
            expect(jsonOutput.filesWithIssues.length).toBe(7);
        });

        it('should not contain issue with for files outside source code', () => {
            const hasPath = hasNormalizedPathContaining('tests/obj/Debug/net8.0/Application.Tests/CalcTests.cs');
            expect(hasPath).toBe(false);
        });

        it('should not contain issue with Helper1.cs because it is not test file', () => {
            expect(hasIssue('Helper1.cs')).toBe(false);
        });

        it('should not contain issue with FooIntegrationTest.cs because it is integration test with different structure', () => {
            expect(hasIssue('FooIntegrationTest.cs')).toBe(false);
        });

        it('should not contain issue with FooHelper because it is not test file', () => {
            expect(hasIssue('FooHelper')).toBe(false);
        });

        it('should not contain issue with Application.Tests.AssemblyInfo because it is not test file', () => {
            expect(hasIssue('Application.Tests.AssemblyInfo')).toBe(false);
        });

        it('should not contain issue with Bus/HandlerTests.cs, Car/HandlerTests.cs, Truck/HandlerTests.cs because they are different tests despite the same name', () => {
            expect(hasNormalizedPathContaining('Bus/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Car/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Truck/HandlerTests.cs')).toBe(false);
        });

        it('should contain issue with CalcTests.cs because it is true positive issue', () => {
            expect(hasIssue('CalcTests.cs')).toBe(true);
        });

        it('should contain issue with UserServiceTests.cs because it is true positive issue', () => {
            expect(hasIssue('UserServiceTests.cs')).toBe(true);
        });

        it('should contain issue with UserMapperTests.cs because it is true positive issue', () => {
            expect(hasIssue('UserMapperTests.cs')).toBe(true);
        });

        it('should contain issue with WrongNameTests.cs because it is true positive issue', () => {
            expect(hasIssue('WrongNameTests.cs')).toBe(true);
        });

        it('should contain issue with ProductMapperTests.cs because it is true positive issue', () => {
            expect(hasIssue('ProductMapperTests.cs')).toBe(true);
        });

        it('should contain issue with ToBeIgnoredTests.cs because it is in the ignore list', () => {
            expect(hasIssue('ToBeIgnoredTests.cs')).toBe(true);
        });

        it('should contain issue with InToBeIgnoredFolderTests.cs because it is in the ignore list', () => {
            expect(hasIssue('InToBeIgnoredFolderTests.cs')).toBe(false);
        });
    });

    describe('Scenario 2: With ignore options', () => {
        let jsonOutput: any;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n --ignore-directories "ToBeIgnoredFolder","obj" --ignore-files "ToBeIgnoredTests.cs","OtherIgnoreTests.cs"');
            jsonOutput = result.jsonOutput;
        });
        const hasNormalizedPathContaining = (path: string) => {
            const allPathsNormalized = jsonOutput.filesWithIssues.map((issue: any) => issue.currentTestFile?.replace(/\\/g, '/'));
            return allPathsNormalized.some((p: string) => p && p.includes(path));
        };

        const hasIssue = (fileName: string) => 
            jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);

        it('should not contain issue with for files outside source code', () => {
            const hasPath = hasNormalizedPathContaining('tests/obj/Debug/net8.0/Application.Tests/CalcTests.cs');
            expect(hasPath).toBe(false);
        });

        it('should not contain issue with Helper1.cs because it is not test file', () => {
            expect(hasIssue('Helper1.cs')).toBe(false);
        });

        it('should not contain issue with FooIntegrationTest.cs because it is integration test with different structure', () => {
            expect(hasIssue('FooIntegrationTest.cs')).toBe(false);
        });

        it('should not contain issue with FooHelper because it is not test file', () => {
            expect(hasIssue('FooHelper')).toBe(false);
        });

        it('should not contain issue with Application.Tests.AssemblyInfo because it is not test file', () => {
            expect(hasIssue('Application.Tests.AssemblyInfo')).toBe(false);
        });

        it('should not contain issue with Bus/HandlerTests.cs, Car/HandlerTests.cs, Truck/HandlerTests.cs because they are different tests despite the same name', () => {
            expect(hasNormalizedPathContaining('Bus/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Car/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Truck/HandlerTests.cs')).toBe(false);
        });

        it('should contain issue with CalcTests.cs because it is true positive issue', () => {
            expect(hasIssue('CalcTests.cs')).toBe(true);
        });

        it('should contain issue with UserServiceTests.cs because it is true positive issue', () => {
            expect(hasIssue('UserServiceTests.cs')).toBe(true);
        });


        it('should contain issue with UserMapperTests.cs because it is true positive issue', () => {
            expect(hasIssue('UserMapperTests.cs')).toBe(true);
        });

        it('should contain issue with WrongNameTests.cs because it is true positive issue', () => {
            expect(hasIssue('WrongNameTests.cs')).toBe(true);
        });

        it('should not contain issue with "ToBeIgnoredTests.cs" because it is in the ignore list', () => {
            expect(hasIssue('ToBeIgnoredTests.cs')).toBe(false);
        });

        it('should not contain issue with "InToBeIgnoredFolderTests.cs" because it is in the ignore list', () => {
            expect(hasIssue('InToBeIgnoredFolderTests.cs')).toBe(false);
        });
    });
});