import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Secret Exposure Guard', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  const dangerousPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i,
    /DODO_PAYMENTS_API_KEY\s*=\s*['"][^'"]+['"]/i,
    /AWS_SECRET_ACCESS_KEY\s*=\s*['"][^'"]+['"]/i,
    /test_local_key_88/i,
  ];

  it('ensures no secret keys are hardcoded in web client source files', () => {
    const webSrcDir = path.resolve(__dirname, '..');

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.next') {
            checkDir(fullPath);
          }
        } else if (/\.(tsx?|jsx?|json|css)$/.test(entry.name) && !entry.name.includes('.test.')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of dangerousPatterns) {
            expect(content).not.toMatch(pattern);
          }
        }
      }
    }

    checkDir(webSrcDir);
  });
});
