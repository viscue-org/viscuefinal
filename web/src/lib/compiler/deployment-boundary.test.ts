import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('compiler deployment boundary', () => {
  it('uploads every source tree imported by the web compiler', () => {
    const ignore = readFileSync(resolve(process.cwd(), '..', '.vercelignore'), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    expect(ignore).not.toContain('local-server/');
    expect(ignore).not.toContain('gesture/');
  });
});
