import {
    exec
} from 'child_process';
import {
    promisify
} from 'util';

const execAsync = promisify(exec);

describe('CLI Tool Tests', () => {
    // Helper function to execute the CLI tool with the specified arguments
    const executeCLI = async (args: string): Promise < {
        stdout: string;stderr: string
    } > => {
        try {
            return await execAsync(`node ./dist/index.js ${args}`);
        } catch (error: any) {
            // If the CLI exits with an error code, we still want to examine the output
            return {
                stdout: error.stdout,
                stderr: error.stderr
            };
        }
    };

    describe('Scenario 1: Default options', () => {
        let stdout: string;
        let stderr: string;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n');
            stdout = result.stdout;
            stderr = result.stderr;
        });

        it('should find 7 issues', () => {
            const issueCountMatch = stdout.match(/Found (\d+) files with issues/);
            expect(issueCountMatch).toBeTruthy();
            expect(parseInt(issueCountMatch![1], 10)).toBe(8);
        });

        it('should not contain issue with "tests\\obj\\Debug\\net8.0\\Application.Tests\\CalcTests.cs" because is is not source code', () => {
            expect(stdout).not.toContain('tests\\obj\\Debug\\net8.0\\Application.Tests\\CalcTests.cs');
        });

        it('should not contain issue with Helper1.cs because it is not test file', () => {
            expect(stdout).not.toContain('Helper1.cs');
        });

        it('should not contain issue with FooIntegrationTest.cs because it is integration test with different structure', () => {
            expect(stdout).not.toContain('FooIntegrationTest.cs');
        });

        it('should not contain issue with FooHelper because it is not test file', () => {
            expect(stdout).not.toContain('FooHelper');
        });

        it('should not contain issue with Application.Tests.AssemblyInfo because it is not test file', () => {
            expect(stdout).not.toContain('Application.Tests.AssemblyInfo');
        });

        it('should not contain issue with Bus\\HandlerTests.cs, Car\\HandlerTests.cs, Truck\\HandlerTests.cs because they are different tests despite the same name', () => {
            expect(stdout).not.toContain('Bus\\HandlerTests.cs');
            expect(stdout).not.toContain('Car\\HandlerTests.cs');
            expect(stdout).not.toContain('Truck\\HandlerTests.cs');
        });

        it('should contain issue with CalcTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('CalcTests.cs');
        });

        it('should contain issue with UserServiceTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('UserServiceTests.cs');
        });

        it('should contain issue with UserMapperTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('UserMapperTests.cs');
        });

        it('should contain issue with WrongNameTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('WrongNameTests.cs');
        });

        it('should contain issue with ProductMapperTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('ProductMapperTests.cs');
        });

        it('should contain issue with ToBeIgnoredTests.cs because it is in the ignore list', () => {
            expect(stdout).toContain('ToBeIgnoredTests.cs');
        });

        it('should contain issue with InToBeIgnoredFolderTests.cs because it is in the ignore list', () => {
            expect(stdout).toContain('InToBeIgnoredFolderTests.cs');
        });
    });

    describe('Scenario 2: With ignore options', () => {
        let stdout: string;
        let stderr: string;

        beforeAll(async () => {
            const result = await executeCLI('-s ./test-data/src/ -t ./test-data/tests/ -d -n --ignore-directories "ToBeIgnoredFolder","obj" --ignore-files "ToBeIgnoredTests.cs","OtherIgnoreTests.cs"');
            stdout = result.stdout;
            stderr = result.stderr;
        });

        it('should not contain issue with "tests\\obj\\Debug\\net8.0\\Application.Tests\\CalcTests.cs" because it is not source code', () => {
            expect(stdout).not.toContain('tests\\obj\\Debug\\net8.0\\Application.Tests\\CalcTests.cs');
        });

        it('should not contain issue with Helper1.cs because it is not test file', () => {
            expect(stdout).not.toContain('Helper1.cs');
        });

        it('should not contain issue with FooIntegrationTest.cs because it is integration test with different structure', () => {
            expect(stdout).not.toContain('FooIntegrationTest.cs');
        });

        it('should not contain issue with FooHelper because it is not test file', () => {
            expect(stdout).not.toContain('FooHelper');
        });

        it('should not contain issue with Application.Tests.AssemblyInfo because it is not test file', () => {
            expect(stdout).not.toContain('Application.Tests.AssemblyInfo');
        });

        it('should not contain issue with Bus\\HandlerTests.cs, Car\\HandlerTests.cs, Truck\\HandlerTests.cs because they are different tests despite the same name', () => {
            expect(stdout).not.toContain('Bus\\HandlerTests.cs');
            expect(stdout).not.toContain('Car\\HandlerTests.cs');
            expect(stdout).not.toContain('Truck\\HandlerTests.cs');
        });

        it('should contain issue with CalcTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('CalcTests.cs');
        });

        it('should contain issue with UserServiceTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('UserServiceTests.cs');
        });


        it('should contain issue with UserMapperTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('UserMapperTests.cs');
        });

        it('should contain issue with WrongNameTests.cs because it is true positive issue', () => {
            expect(stdout).toContain('WrongNameTests.cs');
        });

        it('should not contain issue with "ToBeIgnoredTests.cs" because it is in the ignore list', () => {
            expect(stdout).not.toContain('ToBeIgnoredTests.cs');
        });

        it('should not contain issue with "InToBeIgnoredFolderTests.cs" because it is in the ignore list', () => {
            expect(stdout).not.toContain('InToBeIgnoredFolderTests.cs');
        });
    });
});