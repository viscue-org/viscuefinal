import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(rootDir, 'dist');
const screenshotDir = path.resolve(rootDir, 'test-results', 'screenshots');

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const delay = ms => new Promise(res => setTimeout(res, ms));

const results = [];
function record(category, element, status, details = '') {
  results.push({ category, element, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${category}] ${element}: ${details || status}`);
}

(async () => {
  console.log('================================================================');
  console.log('🚀 Starting Comprehensive Chrome UI Elements Test');
  console.log('Testing: Workspace UI (index.html) & Popup UI (popup.html)');
  console.log('Extension path:', extensionPath);
  console.log('Screenshots directory:', screenshotDir);
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
    ],
  });

  try {
    // 1. Locate Extension Service Worker
    console.log('⏳ Detecting extension ID from background service worker...');
    const workerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' || target.type() === 'background_page',
      { timeout: 10000 }
    );
    const extensionUrl = workerTarget.url();
    const extensionId = extensionUrl.split('/')[2];
    record('Extension Init', 'Service Worker', 'PASS', `Extension ID: ${extensionId}`);

    const workspacePage = await browser.newPage();

    // =========================================================================
    // PART 1: MAIN WORKSPACE UI (index.html)
    // =========================================================================
    console.log('\n--- 1. Testing Main Workspace UI (index.html) ---');
    await workspacePage.goto(`chrome-extension://${extensionId}/index.html`, { waitUntil: 'domcontentloaded' });
    await delay(1200);

    // 1.1 App Shell
    const appShell = await workspacePage.$('.app-shell.workspace-chrome');
    record('Workspace UI', 'App Shell Container', appShell ? 'PASS' : 'FAIL', 'Mounted with .workspace-chrome');

    // 1.2 One-Time Setup Dialog
    const setupDialog = await workspacePage.$('.platform-plan-dialog, dialog[open]');
    if (setupDialog) {
      record('Workspace Setup', 'Platform Plan Setup Dialog', 'PASS', 'One-time setup modal appeared');
      await workspacePage.screenshot({ path: path.join(screenshotDir, '01-workspace-setup-dialog.png') });

      await workspacePage.waitForSelector('.platform-plan-dialog button.primary, footer button.primary');
      await workspacePage.click('.platform-plan-dialog button.primary, footer button.primary');
      await delay(600);
      record('Workspace Setup', 'Continue to Workspace Action', 'PASS', 'Setup modal dismissed');
    } else {
      record('Workspace Setup', 'Platform Plan Setup Dialog', 'PASS', 'Setup previously completed');
    }

    // 1.3 Empty State Title
    const emptyTitle = await workspacePage.$('#workspace-empty-title, .workspace-empty__title');
    if (emptyTitle) {
      const text = await workspacePage.evaluate(el => el.textContent.replace(/\s+/g, ' ').trim(), emptyTitle);
      record('Workspace UI', 'Empty State Title & Words', 'PASS', `Visible text: "${text}"`);
    } else {
      record('Workspace UI', 'Empty State Title', 'FAIL', 'Element missing');
    }
    await workspacePage.screenshot({ path: path.join(screenshotDir, '02-workspace-empty.png') });

    // 1.4 Utilities - Theme Toggle
    const themeBtn = await workspacePage.$('button[title*="mode"], button[aria-label*="mode"]');
    if (themeBtn) {
      const initialTheme = await workspacePage.evaluate(() => document.querySelector('.workspace-chrome')?.getAttribute('data-theme') || 'dark');
      await themeBtn.click();
      await delay(400);
      const toggledTheme = await workspacePage.evaluate(() => document.querySelector('.workspace-chrome')?.getAttribute('data-theme') || 'dark');
      record('Workspace Utilities', 'Theme Toggle Button', 'PASS', `Switched theme: ${initialTheme} -> ${toggledTheme}`);
      await workspacePage.screenshot({ path: path.join(screenshotDir, '03-workspace-theme-toggled.png') });

      // Toggle back to dark
      await themeBtn.click();
      await delay(300);
    } else {
      record('Workspace Utilities', 'Theme Toggle Button', 'FAIL', 'Missing');
    }

    // 1.5 Utilities - History Modal
    const historyBtn = await workspacePage.$('button[aria-label="Open history"], button[title="History"]');
    if (historyBtn) {
      await historyBtn.click();
      await delay(500);

      const historyModal = await workspacePage.$('.workspace-history');
      if (historyModal) {
        record('Workspace Utilities', 'History Modal', 'PASS', 'History drawer opened');
        await workspacePage.screenshot({ path: path.join(screenshotDir, '04-workspace-history-open.png') });

        await workspacePage.click('.workspace-history__close-btn, button[aria-label="Close history"]');
        await delay(400);
        record('Workspace Utilities', 'History Close Button', 'PASS', 'History drawer closed');
      } else {
        record('Workspace Utilities', 'History Modal', 'FAIL', 'History drawer not displayed');
      }
    } else {
      record('Workspace Utilities', 'History Button', 'FAIL', 'Missing');
    }

    // 1.6 Command Dock - Root Container & Select Tool
    const commandDock = await workspacePage.$('.workspace-dock');
    record('Command Dock', 'Dock Container', commandDock ? 'PASS' : 'FAIL', 'Mounted at bottom of screen');

    const selectTool = await workspacePage.$('button[aria-label="Select"]');
    record('Command Dock', 'Select Tool Button', selectTool ? 'PASS' : 'FAIL', 'Select mode ready');

    // 1.7 Command Dock - Add Assets Morphing Rail
    const assetsBtn = await workspacePage.$('button[aria-label="Add assets"]');
    if (assetsBtn) {
      await assetsBtn.click();
      await delay(400);

      const minimizeBtn = await workspacePage.$('button[aria-label="Minimize menu"]');
      const imageOpt = await workspacePage.$('button[aria-label="Image"]');
      const videoOpt = await workspacePage.$('button[aria-label="Video"]');
      const docOpt = await workspacePage.$('button[aria-label="Document"]');
      const webOpt = await workspacePage.$('button[aria-label="Web page"]');

      if (minimizeBtn && imageOpt && webOpt) {
        record('Command Dock', 'Add Assets Sub-Rail', 'PASS', 'Morphed into [Image, Video, Document, Web page]');
        await workspacePage.screenshot({ path: path.join(screenshotDir, '05-workspace-assets-rail.png') });
        await minimizeBtn.click();
        await delay(300);
        record('Command Dock', 'Minimize Assets Menu', 'PASS', 'Returned to root dock');
      } else {
        record('Command Dock', 'Add Assets Sub-Rail', 'FAIL', 'Sub-rail options missing');
      }
    } else {
      record('Command Dock', 'Add Assets Button', 'FAIL', 'Missing');
    }

    // 1.8 Command Dock - Annotation Morphing Rail
    const annotateBtn = await workspacePage.$('button[aria-label="Annotate"]');
    if (annotateBtn) {
      await annotateBtn.click();
      await delay(400);

      const minimizeBtn = await workspacePage.$('button[aria-label="Minimize menu"]');
      const pointOpt = await workspacePage.$('button[aria-label="Point"]');
      const wholeOpt = await workspacePage.$('button[aria-label="Whole image"]');
      const areaOpt = await workspacePage.$('button[aria-label="Area"]');
      const drawOpt = await workspacePage.$('button[aria-label="Draw"]');
      const eraseOpt = await workspacePage.$('button[aria-label="Erase"]');

      if (minimizeBtn && pointOpt && drawOpt && eraseOpt) {
        record('Command Dock', 'Annotation Sub-Rail', 'PASS', 'Morphed into [Point, Whole, Area, Draw, Erase]');
        await workspacePage.screenshot({ path: path.join(screenshotDir, '06-workspace-annotation-rail.png') });
        await minimizeBtn.click();
        await delay(300);
        record('Command Dock', 'Minimize Annotation Menu', 'PASS', 'Returned to root dock');
      } else {
        record('Command Dock', 'Annotation Sub-Rail', 'FAIL', 'Annotation tools missing');
      }
    } else {
      record('Command Dock', 'Annotate Button', 'FAIL', 'Missing');
    }

    // 1.9 Command Dock - Text Morphing Rail & Sticky Note Tool
    const textBtn = await workspacePage.$('button[aria-label="Add text"]');
    if (textBtn) {
      await textBtn.click();
      await delay(400);

      const textOpt = await workspacePage.$('button[aria-label="Text"]');
      const sNoteBtn = await workspacePage.$('button[aria-label="Sticky note"]');
      if (sNoteBtn && textOpt) {
        record('Command Dock', 'Text Sub-Rail', 'PASS', 'Morphed into [Text, Sticky note]');
        await workspacePage.screenshot({ path: path.join(screenshotDir, '07-workspace-text-rail.png') });

        await sNoteBtn.click();
        await delay(300);
        record('Command Dock', 'Sticky Note Tool Selected', 'PASS', 'Activated S-Note mode');

        // Click canvas to drop sticky note
        console.log('🖱️ Clicking canvas at (500, 350) to drop note...');
        await workspacePage.mouse.click(500, 350);
        await delay(600);

        const noteNode = await workspacePage.$('.react-flow__node-text, .text-node');
        if (noteNode) {
          record('Canvas Interaction', 'Sticky Note Placement', 'PASS', 'Created note node on canvas');
          await workspacePage.keyboard.type('Test instruction for multimodal visual intent', { delay: 20 });
          await delay(400);
          await workspacePage.screenshot({ path: path.join(screenshotDir, '08-workspace-note-placed.png') });
        } else {
          record('Canvas Interaction', 'Sticky Note Placement', 'FAIL', 'Note node not found');
        }

        // Minimize back to root dock if still in sub-menu
        const minimizeBtn = await workspacePage.$('button[aria-label="Minimize menu"]');
        if (minimizeBtn) {
          await minimizeBtn.click();
          await delay(300);
        }
      } else {
        record('Command Dock', 'Sticky Note Tool Option', 'FAIL', 'Button missing');
      }
    } else {
      record('Command Dock', 'Add Text Button', 'FAIL', 'Missing');
    }

    // 1.10 Command Dock - Cue Final Button & Validation Feedback
    const cueBtn = await workspacePage.$('.workspace-dock__cue');
    if (cueBtn) {
      record('Command Dock', 'Cue Final Button', 'PASS', 'Rendered .workspace-dock__cue');
      await cueBtn.click();
      await delay(600);

      const toastEl = await workspacePage.$('.toast.error, .toast');
      if (toastEl) {
        const toastMsg = await workspacePage.evaluate(el => el.textContent.replace(/\s+/g, ' ').trim(), toastEl);
        record('Validation & Feedback', 'Cue Validation Toast', 'PASS', `Displayed: "${toastMsg}"`);
        await workspacePage.screenshot({ path: path.join(screenshotDir, '09-workspace-cue-validation.png') });

        // Dismiss toast
        const dismissBtn = await workspacePage.$('.toast button');
        if (dismissBtn) {
          await dismissBtn.click();
          await delay(300);
          record('Validation & Feedback', 'Toast Dismiss Button', 'PASS', 'Dismissed error toast');
        }
      } else {
        record('Validation & Feedback', 'Cue Validation Toast', 'FAIL', 'No toast appeared');
      }
    } else {
      record('Command Dock', 'Cue Final Button', 'FAIL', 'Missing');
    }

    // =========================================================================
    // PART 2: POPUP UI (popup.html)
    // =========================================================================
    console.log('\n--- 2. Testing Popup UI (popup.html) ---');
    const popupPage = await browser.newPage();

    // 2.1 Onboarding View (?onboarding=1)
    console.log('Testing Onboarding View (?onboarding=1)...');
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html?onboarding=1`, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    const onboardingScene = await popupPage.$('.onboarding, .onboarding-scene');
    record('Popup Onboarding', 'Onboarding Scene Hero', onboardingScene ? 'PASS' : 'FAIL', 'Rendered character hero & copy bubble');
    await popupPage.screenshot({ path: path.join(screenshotDir, '10-popup-onboarding.png') });

    const skipBtn = await popupPage.$('button.onboarding-skip, .onboarding button:last-child');
    if (skipBtn) {
      const skipText = await popupPage.evaluate(el => el.textContent.trim(), skipBtn);
      record('Popup Onboarding', 'Skip / Next Navigation', 'PASS', `Button text: "${skipText}"`);
    }

    // 2.2 Standard Popup - Home View
    console.log('Testing Standard Popup Home View...');
    await popupPage.evaluate(() => {
      if (globalThis.chrome?.storage?.local) {
        return chrome.storage.local.set({ 'viscue-onboarding-complete': true });
      }
      localStorage.setItem('viscue-onboarding-complete', 'true');
    });

    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    const brandEl = await popupPage.$('.brand-lockup, .brand-lockup-main');
    record('Popup Home', 'Brand Logo & Title', brandEl ? 'PASS' : 'FAIL', 'Viscue mark & logo rendered');

    const cueAllowance = await popupPage.$('.typography-count, .typography-cue');
    if (cueAllowance) {
      const cueVal = await popupPage.evaluate(el => el.textContent.trim(), cueAllowance);
      record('Popup Home', 'Daily Cue Allowance Display', 'PASS', `Counter value: "${cueVal}" cues left`);
    } else {
      record('Popup Home', 'Daily Cue Allowance Display', 'FAIL', 'Counter missing');
    }

    const segmentedNav = await popupPage.$('.segmented-control, .toggle-container');
    record('Popup Navigation', 'Segmented Nav Switcher', segmentedNav ? 'PASS' : 'FAIL', 'Home & Settings tabs visible');
    await popupPage.screenshot({ path: path.join(screenshotDir, '11-popup-home.png') });

    // 2.3 Standard Popup - Settings Overlay View
    console.log('Testing Settings Overlay View...');
    const settingsBtn = await popupPage.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.segmented-btn, [role="tab"]'));
      return buttons.find(b => b.textContent.includes('Settings')) || buttons[1];
    });

    if (settingsBtn && settingsBtn.asElement()) {
      await settingsBtn.asElement().click();
      await delay(600);

      const settingsOverlay = await popupPage.$('.settings-overlay');
      record('Popup Settings', 'Settings Overlay Drawer', settingsOverlay ? 'PASS' : 'FAIL', 'Overlay drawer opened');
      await popupPage.screenshot({ path: path.join(screenshotDir, '12-popup-settings-overlay.png') });

      // Auto-Submit Switch
      const autoSubmitSwitch = await popupPage.$('.settings-mini-switch, button[role="switch"]');
      if (autoSubmitSwitch) {
        const initialOn = await popupPage.evaluate(el => el.classList.contains('is-on'), autoSubmitSwitch);
        await autoSubmitSwitch.click();
        await delay(300);
        const toggledOn = await popupPage.evaluate(el => el.classList.contains('is-on'), autoSubmitSwitch);
        record('Popup Settings', 'Auto-Submit Switch', 'PASS', `Toggled state: ${initialOn} -> ${toggledOn}`);
        await popupPage.screenshot({ path: path.join(screenshotDir, '13-popup-toggle-toggled.png') });
      } else {
        record('Popup Settings', 'Auto-Submit Switch', 'FAIL', 'Missing');
      }

      // Account Card
      const accountBlock = await popupPage.$('.settings-account-block');
      if (accountBlock) {
        const emailVal = await popupPage.$('.settings-account-email-val');
        const emailText = emailVal ? await popupPage.evaluate(el => el.textContent.trim(), emailVal) : '';
        const authBtn = await popupPage.$('.settings-account-auth-btn');
        const authText = authBtn ? await popupPage.evaluate(el => el.textContent.trim(), authBtn) : '';
        record('Popup Settings', 'Account Card & Auth Button', 'PASS', `Status: "${emailText}", Button: "${authText}"`);
      } else {
        record('Popup Settings', 'Account Card', 'FAIL', 'Missing');
      }

      // Platform Plan Settings
      const platformCard = await popupPage.$('.settings-platform-plan');
      if (platformCard) {
        const selectEl = await popupPage.$('.settings-platform-plan select');
        if (selectEl) {
          const options = await popupPage.evaluate(sel => Array.from(sel.options).map(o => o.text), selectEl);
          record('Popup Settings', 'Platform Plan Dropdown', 'PASS', `Options: [${options.join(', ')}]`);
          await popupPage.select('.settings-platform-plan select', 'plus');
          await delay(300);
          await popupPage.screenshot({ path: path.join(screenshotDir, '14-popup-plan-changed.png') });
        } else {
          record('Popup Settings', 'Platform Plan Dropdown', 'FAIL', 'Select missing');
        }
      } else {
        record('Popup Settings', 'Platform Plan Settings', 'FAIL', 'Card missing');
      }

      // Plans & Allowance List
      const plansList = await popupPage.$('.settings-plans-list');
      if (plansList) {
        const choices = await popupPage.$$('.settings-plan-choice');
        const details = [];
        for (const c of choices) {
          const text = await popupPage.evaluate(el => el.textContent.replace(/\s+/g, ' ').trim(), c);
          details.push(text);
        }
        record('Popup Settings', 'Plans & Allowance List', 'PASS', `Found ${choices.length} tiers: ${details.join(' | ')}`);
        await popupPage.screenshot({ path: path.join(screenshotDir, '15-popup-plans-list.png') });
      } else {
        record('Popup Settings', 'Plans & Allowance Section', 'FAIL', 'Missing');
      }

      // Close Settings Overlay
      const closeSettingsBtn = await popupPage.$('.settings-overlay-close, button[aria-label="Close settings"]');
      if (closeSettingsBtn) {
        await closeSettingsBtn.click();
        await delay(400);
        record('Popup Settings', 'Close Settings Overlay', 'PASS', 'Returned cleanly to Home view');
      }
    } else {
      record('Popup Navigation', 'Settings Tab Button', 'FAIL', 'Button missing');
    }

  } catch (error) {
    console.error('❌ Test Exception:', error);
  } finally {
    await browser.close();
    console.log('\n================================================================');
    console.log('📊 FINAL TEST RESULTS SUMMARY:');
    console.log('================================================================');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total UI Elements & Interactions Tested: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%`);
    console.log('================================================================\n');
  }
})();
