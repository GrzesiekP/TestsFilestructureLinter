import {
    exec
} from 'node:child_process';
import {
    promisify
} from 'node:util';
import fs from 'node:fs';

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

    // Common tests that run for both scenarios
    describe('Common validation tests', () => {
        // Store results for both scenarios
        const scenarios = [
            {
                name: 'Default options',
                args: '-s ./test-data/src/ -t ./test-data/tests/ -d -n',
                jsonOutput: null as any
            },
            {
                name: 'With ignore options',
                args: '-s ./test-data/src/ -t ./test-data/tests/ -d -n --ignore-directories "ToBeIgnoredFolder","obj" --ignore-files "ToBeIgnoredTests.cs","OtherIgnoreTests.cs"',
                jsonOutput: null as any
            }
        ];

        beforeAll(async () => {
            // Run both scenarios and store results
            for (const scenario of scenarios) {
                const result = await executeCLI(scenario.args);
                scenario.jsonOutput = result.jsonOutput;
            }
        });

        test.each(scenarios)('$name: should not contain issue with for files outside source code', ({ jsonOutput }) => {
            const hasNormalizedPathContaining = (path: string) => {
                const allPathsNormalized = jsonOutput.filesWithIssues.map((issue: any) => issue.currentTestFile?.replaceAll('\\', '/'));
                return allPathsNormalized.some((p: string) => p && p.includes(path));
            };
            const hasPath = hasNormalizedPathContaining('tests/obj/Debug/net8.0/Application.Tests/CalcTests.cs');
            expect(hasPath).toBe(false);
        });

        test.each(scenarios)('$name: should not contain issue with Helper1.cs because it is not test file', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('Helper1.cs')).toBe(false);
        });

        test.each(scenarios)('$name: should not contain issue with FooIntegrationTest.cs because it is integration test with different structure', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('FooIntegrationTest.cs')).toBe(false);
        });

        test.each(scenarios)('$name: should not contain issue with FooHelper because it is not test file', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('FooHelper')).toBe(false);
        });

        test.each(scenarios)('$name: should not contain issue with Application.Tests.AssemblyInfo because it is not test file', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('Application.Tests.AssemblyInfo')).toBe(false);
        });

        test.each(scenarios)('$name: should not contain issue with Bus/HandlerTests.cs, Car/HandlerTests.cs, Truck/HandlerTests.cs because they are different tests despite the same name', ({ jsonOutput }) => {
            const hasNormalizedPathContaining = (path: string) => {
                const allPathsNormalized = jsonOutput.filesWithIssues.map((issue: any) => issue.currentTestFile?.replaceAll('\\', '/'));
                return allPathsNormalized.some((p: string) => p && p.includes(path));
            };
            expect(hasNormalizedPathContaining('Bus/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Car/HandlerTests.cs')).toBe(false);
            expect(hasNormalizedPathContaining('Truck/HandlerTests.cs')).toBe(false);
        });

        test.each(scenarios)('$name: should contain issue with CalcTests.cs because it is true positive issue', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('CalcTests.cs')).toBe(true);
        });

        test.each(scenarios)('$name: should contain issue with UserServiceTests.cs because it is true positive issue', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('UserServiceTests.cs')).toBe(true);
        });

        test.each(scenarios)('$name: should contain issue with UserMapperTests.cs because it is true positive issue', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('UserMapperTests.cs')).toBe(true);
        });

        test.each(scenarios)('$name: should contain issue with WrongNameTests.cs because it is true positive issue', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('WrongNameTests.cs')).toBe(true);
        });

        test.each(scenarios)('$name: should contain issue with ProductMapperTests.cs because it is true positive issue', ({ jsonOutput }) => {
            const hasIssue = (fileName: string) => 
                jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('ProductMapperTests.cs')).toBe(true);
        });
    });

    // Scenario 1 specific tests
    describe('Scenario 1: Default options - specific validations', () => {
        let jsonOutput: any;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n');
            jsonOutput = result.jsonOutput;
        });

        const hasIssue = (fileName: string) => 
            jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);

        it('should have 7 issues in summary', () => {
            expect(jsonOutput.summary.totalFilesWithIssues).toBe(7);
        });

        it('should find 7 issues', () => {
            expect(jsonOutput.filesWithIssues.length).toBe(7);
        });

        it('should contain issue with ToBeIgnoredTests.cs because it is in the ignore list', () => {
            expect(hasIssue('ToBeIgnoredTests.cs')).toBe(true);
        });

        it('should not contain issue with InToBeIgnoredFolderTests.cs', () => {
            expect(hasIssue('InToBeIgnoredFolderTests.cs')).toBe(false);
        });
    });

    describe('Scenario 2: With ignore options - specific validations', () => {
        let jsonOutput: any;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n --ignore-directories "ToBeIgnoredFolder","obj" --ignore-files "ToBeIgnoredTests.cs","OtherIgnoreTests.cs"');
            jsonOutput = result.jsonOutput;
        });

        const hasIssue = (fileName: string) => 
            jsonOutput.filesWithIssues.some((issue: any) => issue.testName === fileName);

        it('should not contain issue with "ToBeIgnoredTests.cs" because it is in the ignore list', () => {
            expect(hasIssue('ToBeIgnoredTests.cs')).toBe(false);
        });

        it('should not contain issue with "InToBeIgnoredFolderTests.cs" because it is in the ignore list', () => {
            expect(hasIssue('InToBeIgnoredFolderTests.cs')).toBe(false);
        });
    });
});