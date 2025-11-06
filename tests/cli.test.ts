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

    describe('Scenario 3: --fix to fix wrong location', () => {
        const tempDir = `test-data-temp-${Date.now()}`;
        let jsonOutputAfterFix: any;

        beforeAll(async () => {
            // Create temporary copy of test-data
            await fs.promises.cp('test-data', tempDir, { recursive: true });
            
            // Run CLI with --all on the temporary copy to fix all issues
            await executeCLI(`-s ./${tempDir}/src/ -t ./${tempDir}/tests/ -d -n --fix ${tempDir}/tests/Application.Tests/Services/WrongLocation/UserServiceTests.cs`);
            
            // Run analysis again to get the result after fixing
            const resultAfterFix = await executeCLI(`-s ./${tempDir}/src/ -t ./${tempDir}/tests/ -d -n`);
            jsonOutputAfterFix = resultAfterFix.jsonOutput;
        }, 15000);

        afterAll(async () => {
            // Clean up temporary directory
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        });

        it('should move UserServiceTests.cs from WrongLocation to correct location', async () => {
            const oldFile = `${tempDir}/tests/Application.Tests/Services/WrongLocation/UserServiceTests.cs`;
            const newFile = `${tempDir}/tests/Application.Tests/Services/UserServiceTests.cs`;
            
            // Verify old file no longer exists
            const oldFileExists = await fs.promises.access(oldFile)
                .then(() => true)
                .catch(() => false);
            expect(oldFileExists).toBe(false);
            
            // Verify new file exists
            const newFileExists = await fs.promises.access(newFile)
                .then(() => true)
                .catch(() => false);
            expect(newFileExists).toBe(true);
        });

        it('should not list UserServiceTests.cs as having directory structure issue after fixing', () => {
            const userServiceIssue = jsonOutputAfterFix.filesWithIssues.find(
                (issue: any) => issue.testName === 'UserServiceTests.cs'
            );
            
            // File might still have other issues (like naming), but should not have directory structure issues
            if (userServiceIssue) {
                const hasDirectoryIssue = userServiceIssue.errors.some(
                    (error: any) => error.type === 'InvalidDirectoryStructure'
                );
                expect(hasDirectoryIssue).toBe(false);
            }
        });

        it('should have fewer issues after fixing', () => {
            // Original scenario 1 had 7 issues, after fixing directory structures should have fewer
            expect(jsonOutputAfterFix.summary.totalFilesWithIssues).toBeLessThan(7);
        });
    });

    describe('Scenario 4: --fix to rename wrong file name (incorrect casing)', () => {
        const tempDir = `test-data-temp-${Date.now()}`;
        let jsonOutputAfterFix: any;

        const serviceFolder = 'Application.Tests/Services';
        const newFileName = 'UpercaseXYZServiceTests.cs';
        const oldFileName = 'UpercaseXyzServiceTests.cs';
        const oldFilePath = `${tempDir}/tests/${serviceFolder}/${oldFileName}`;
        const newFilePath = `${tempDir}/tests/${serviceFolder}/${newFileName}`;

        beforeAll(async () => {
            // Create temporary copy of test-data
            await fs.promises.cp('test-data', tempDir, { recursive: true });
            
            // Run CLI with --fix on the temporary copy to rename the file
            await executeCLI(`-s ./${tempDir}/src/ -t ./${tempDir}/tests/ -d -n --fix ${tempDir}/tests/Application.Tests/Services/UpercaseXyzServiceTests.cs`);
            
            // Run analysis again to get the result after fixing
            const resultAfterFix = await executeCLI(`-s ./${tempDir}/src/ -t ./${tempDir}/tests/ -d -n`);
            jsonOutputAfterFix = resultAfterFix.jsonOutput;
        }, 15000);

        afterAll(async () => {
            // Clean up temporary directory
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        });

        it('should have fewer issues after fixing', () => {
            // Original scenario 1 had 7 issues, after fixing file name should have fewer
            expect(jsonOutputAfterFix.summary.totalFilesWithIssues).toBe(6);
        });

        // Note: This test is case-sensitivity dependent and may behave differently on case-insensitive file systems (e.g., Windows default)
        it('old file UpercaseXyzServiceTests.cs should not exist', async () => {

            const oldFileExists = fs.readdirSync(`${tempDir}/tests/Application.Tests/Services`).includes('UpercaseXyzServiceTests.cs');
            expect(oldFileExists).toBe(false);
        });

        it('new file UpercaseXYZServiceTests.cs should exist', async () => {

            // Verify new file exists
            const newFileExists = await fs.promises.access(newFilePath)
                .then(() => true)
                .catch(() => false);
            expect(newFileExists).toBe(true);
        });

        it('UpercaseXYZServiceTests.cs should not be in issues', () => {
            const hasIssue = (fileName: string) =>
                jsonOutputAfterFix.filesWithIssues.some((issue: any) => issue.testName === fileName);
            expect(hasIssue('UpercaseXYZServiceTests.cs')).toBe(false);
        });
    });
});