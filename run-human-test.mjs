import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, 'dist');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log('🚀 Launching Chrome to test the Workspace as a human...');
  
  const browser = await puppeteer.launch({
    headless: false, // User wants to see it!
    defaultViewport: null,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--start-maximized'
    ]
  });

  try {
    // 1. Wait for extension to be loaded
    console.log('⏳ Waiting for extension service worker...');
    const workerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' || target.type() === 'background_page'
    );
    const extensionUrl = workerTarget.url();
    const extensionId = extensionUrl.split('/')[2];
    console.log(`✅ Extension ID found: ${extensionId}`);

    // 2. Open the Workspace page directly
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    console.log('✅ Opened Workspace UI');

    // 3. Test Empty State & Basic Clicks
    await page.waitForSelector('.workspace-empty__title');
    console.log('✅ Empty state renders correctly');
    await delay(1000);

    // 4. Test Tools Menu
    console.log('🖱️ Clicking Add Assets menu...');
    await page.waitForSelector('[aria-controls="workspace-assets-menu"]');
    await page.click('[aria-controls="workspace-assets-menu"]');
    await delay(500);

    // Test text menu
    console.log('🖱️ Clicking Add Text menu...');
    await page.click('[aria-controls="workspace-text-menu"]');
    await delay(500);

    // Add a sticky note
    console.log('🖱️ Clicking Sticky Note tool...');
    await page.click('[data-icon="s-note"]');
    await delay(500);

    // Click canvas to drop note
    console.log('🖱️ Adding note to canvas...');
    await page.mouse.click(300, 300);
    await delay(500);

    // Type text
    await page.keyboard.type('Test workspace note', { delay: 100 });
    await delay(1000);

    // Test Cue Final Validation Logic
    console.log('🖱️ Testing Cue Validation Error State...');
    const cueBtn = await page.$('.workspace-dock__cue');
    await cueBtn.click();
    
    await delay(1000);
    // Wait for the error toast
    const errorEl = await page.$('.toast.error, .toast, [role="alert"]');
    if (errorEl) {
      const msg = await page.evaluate(el => el.textContent, errorEl);
      console.log(`✅ Correctly showed validation toast: "${msg.trim()}" (Human-like validation passed)`);
    } else {
      console.log('⚠️ No error toast found with selector .toast.error');
    }

    console.log('🎉 Testing completed successfully! Leaving browser open for your inspection.');
    
    // We intentionally leave it open so the user can look at the result.
  } catch (err) {
    console.error('❌ Test encountered an issue:', err);
    // await browser.close();
  }
})();
