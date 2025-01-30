import { TestStructureAnalyzer } from './analyzer/testStructureAnalyzer';
import * as path from 'path';

async function main() {
    const workspacePath = process.argv[2];
    if (!workspacePath) {
        console.error('Please provide a workspace path');
        process.exit(1);
    }

    const analyzer = new TestStructureAnalyzer();
    try {
        const results = await analyzer.analyzeWorkspace(path.resolve(workspacePath));
        
        if (results.length === 0) {
            console.log('No issues found.');
            return;
        }

        console.log('\nAnalysis Results:');
        console.log('=================\n');

        let totalIssues = 0;
        for (const result of results) {
            console.log(`File: ${result.testFilePath}`);
            for (const error of result.errors) {
                console.log(`  - ${error.message}`);
                if (error.suggestion) {
                    console.log(`    Suggestion: ${error.suggestion}`);
                }
                totalIssues++;
            }
            console.log('');
        }

        console.log(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'}`);
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}

main(); 