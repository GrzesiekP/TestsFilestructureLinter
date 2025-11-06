import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AnalysisResult } from './types';

export interface ReportOptions {
  outputDir: string;
  projectName: string;
}

export async function saveReport(
  results: AnalysisResult[],
  options: ReportOptions,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${options.projectName}-analysis-${timestamp}.json`;
  const outputPath = path.join(options.outputDir, fileName);

  try {
    await fs.mkdir(options.outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    return outputPath;
  } catch (error) {
    throw new Error(
      `Failed to save report: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export async function loadReport(reportPath: string): Promise<AnalysisResult[]> {
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(content) as AnalysisResult[];
  } catch (error) {
    throw new Error(
      `Failed to load report: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
