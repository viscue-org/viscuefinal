import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Home from './page';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../../..');

function mountStylesheet(relativePath: string) {
  const style = document.createElement('style');
  style.dataset.testStylesheet = relativePath;
  style.textContent = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
  document.head.append(style);
}

function computedRadius(selector: string) {
  const element = document.querySelector(selector)!;
  const styles = getComputedStyle(element);
  const radius = styles.borderRadius;
  const variable = radius.match(/^var\((--[^,)]+)/)?.[1];

  if (!variable) return radius;

  let owner: Element | null = element;
  while (owner) {
    const value = getComputedStyle(owner).getPropertyValue(variable).trim();
    if (value) return value;
    owner = owner.parentElement;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-stylesheet]').forEach((style) => style.remove());
  document.body.replaceChildren();
});

describe('logo-derived radius system', () => {
  it('renders the web hero as a rounded-square card with a standard rounded button', () => {
    render(<Home />);

    const heading = screen.getByRole('heading');
    const card = heading.parentElement;
    const action = screen.getByRole('link');

    expect(card).toHaveStyle({ borderRadius: '24px' });
    expect(action).toHaveStyle({ borderRadius: '14px' });
  });

  it('keeps workspace and popup cards and buttons on the same radius scale', () => {
    mountStylesheet('extension/src/styles.css');
    mountStylesheet('extension/src/components/workspace/WorkspaceChrome.css');
    mountStylesheet('extension/src/popup.css');

    document.body.innerHTML = `
      <main class="workspace-chrome">
        <section class="workspace-history">
          <div class="workspace-history__retention-bar"></div>
          <article class="workspace-history__item">
            <button class="workspace-history__restore">Restore</button>
            <div class="workspace-history__actions"><button>Delete</button></div>
          </article>
          <button class="workspace-history__close-btn">Close</button>
        </section>
      </main>
      <section class="settings-card">
        <button class="settings-account-auth-btn">Sign in</button>
        <button class="settings-plan-select-btn">Choose</button>
      </section>
    `;

    expect(computedRadius('.workspace-history')).toBe('24px');
    expect(computedRadius('.workspace-history__retention-bar')).toBe('18px');
    expect(computedRadius('.workspace-history__item')).toBe('18px');
    expect(computedRadius('.workspace-history__restore')).toBe('14px');
    expect(computedRadius('.workspace-history__actions button')).toBe('10px');
    expect(computedRadius('.workspace-history__close-btn')).toBe('14px');
    expect(computedRadius('.settings-card')).toBe('18px');
    expect(computedRadius('.settings-account-auth-btn')).toBe('10px');
    expect(computedRadius('.settings-plan-select-btn')).toBe('10px');
  });
});
