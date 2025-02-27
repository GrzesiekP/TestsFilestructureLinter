import { existsSync } from 'fs';
import { join } from 'path';

describe('Test Environment Setup', () => {
  it('should have the required files in test-data', () => {
    // Check that test-data directory exists
    expect(existsSync('test-data')).toBe(true);
    expect(existsSync('test-data/src')).toBe(true);
    expect(existsSync('test-data/tests')).toBe(true);
  });

  it('should have the compiled CLI tool available', () => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');
    expect(existsSync(cliPath)).toBe(true);
  });
}); 