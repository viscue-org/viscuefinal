import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { shouldCloseWorkspace } from '../../extension/api/workspaceCompletion.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const ADAPTERS = [
  { name: 'ChatGPT', fixture: 'chatgpt.html' },
  { name: 'Gemini', fixture: 'gemini.html' },
  { name: 'Claude', fixture: 'claude.html' },
  { name: 'Copilot', fixture: 'copilot.html' },
  { name: 'Perplexity', fixture: 'perplexity.html' },
  { name: 'Grok', fixture: 'grok.html' },
];

function computePromptHash(prompt) {
  const norm = String(prompt || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return crypto.createHash('sha256').update(norm).digest('hex');
}

function createMockServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    let pathname = parsedUrl.pathname;

    let filePath;
    if (pathname.startsWith('/fixtures/')) {
      filePath = path.join(__dirname, pathname);
    } else if (pathname.startsWith('/dist/')) {
      filePath = path.join(ROOT_DIR, pathname);
    } else if (pathname.startsWith('/extension/')) {
      filePath = path.join(ROOT_DIR, pathname);
    } else {
      filePath = path.join(__dirname, 'fixtures', pathname);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=UTF-8',
        '.js': 'application/javascript; charset=UTF-8',
        '.mjs': 'application/javascript; charset=UTF-8',
        '.css': 'text/css; charset=UTF-8',
        '.json': 'application/json; charset=UTF-8',
        '.png': 'image/png',
      };
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise(cb => server.close(cb)),
      });
    });
  });
}

async function setupPageForAdapter(page, baseUrl, adapterName, fixture) {
  await page.evaluateOnNewDocument((platform) => {
    window.__MOCK_PLATFORM__ = platform;
    const listeners = [];
    window.chrome = {
      runtime: {
        id: 'viscue-e2e-test',
        getManifest: () => ({ version: '3.3.0' }),
        onMessage: {
          addListener(fn) { listeners.push(fn); },
          dispatch(msg, sender, sendResponse) {
            for (const fn of listeners) {
              const res = fn(msg, sender, sendResponse);
              if (res === true) return;
            }
          }
        },
        sendMessage() { return Promise.resolve({ ok: true }); }
      }
    };
  }, adapterName);

  await page.goto(`${baseUrl}/fixtures/${fixture}`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: `${baseUrl}/extension/handoff-contract.js` });
  await page.addScriptTag({ url: `${baseUrl}/extension/content.js` });
}

test('Deterministic Six-Adapter Browser E2E Suite', async (t) => {
  let mockServer;
  let browser;

  try {
    mockServer = await createMockServer();
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    for (const adapter of ADAPTERS) {
      await t.test(`Scenario 1 & 2: Pure text intent handoff on ${adapter.name}`, async () => {
        const page = await browser.newPage();
        try {
          await setupPageForAdapter(page, mockServer.baseUrl, adapter.name, adapter.fixture);

          const prompt = `Please analyze this diagram for ${adapter.name}.`;
          const promptHash = computePromptHash(prompt);

          const result = await page.evaluate(async (platform, text, hash) => {
            return new Promise((resolve) => {
              window.chrome.runtime.onMessage.dispatch(
                {
                  type: 'handoff',
                  prompt: text,
                  promptHash: hash,
                  attachments: [],
                  submit: true,
                  executionId: 'exec-text-01',
                  destinationFingerprint: `${platform}:new`,
                },
                {},
                resolve
              );
            });
          }, adapter.name, prompt, promptHash);

          assert.equal(result.ok, true, `Handoff should succeed on ${adapter.name}: ${result.error}`);
          assert.equal(result.prompt_verified, true, `Prompt should be verified on ${adapter.name}`);

          const events = await page.evaluate(() => window.__VISCUE_EVENTS || []);
          const submitEvent = events.find(e => e.type === 'submit');
          assert.ok(submitEvent, `Submit event was captured on ${adapter.name}`);
          assert.match(submitEvent.prompt, /Please analyze this diagram/);
        } finally {
          await page.close();
        }
      });

      await t.test(`Scenario 3: Single reference with corner annotation on ${adapter.name}`, async () => {
        const page = await browser.newPage();
        try {
          await setupPageForAdapter(page, mockServer.baseUrl, adapter.name, adapter.fixture);

          const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          const prompt = `Focus on the top-right corner element (#c71332) located at [820, 140, 960, 260].`;
          const promptHash = computePromptHash(prompt);

          const result = await page.evaluate(async (platform, dataUrl, text, hash) => {
            return new Promise((resolve) => {
              window.chrome.runtime.onMessage.dispatch(
                {
                  type: 'handoff',
                  prompt: text,
                  promptHash: hash,
                  attachments: [{ id: 'ref-corner', name: 'corner-diagram.png', mime: 'image/png', dataUrl, stateHash: 'hash-c1' }],
                  submit: true,
                  executionId: 'exec-corner-01',
                  destinationFingerprint: `${platform}:new`,
                },
                {},
                resolve
              );
            });
          }, adapter.name, tinyPng, prompt, promptHash);

          assert.equal(result.ok, true, `Corner annotation handoff succeeded on ${adapter.name}: ${result.error}`);
          assert.equal(result.attached, 1, `1 reference attached on ${adapter.name}`);
          assert.equal(result.prompt_verified, true);
        } finally {
          await page.close();
        }
      });

      await t.test(`Scenario 4: Multi-reference attachment flow on ${adapter.name}`, async () => {
        const page = await browser.newPage();
        try {
          await setupPageForAdapter(page, mockServer.baseUrl, adapter.name, adapter.fixture);

          const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          const prompt = 'Cross-reference Image A with Image B to update the style guide.';
          const promptHash = computePromptHash(prompt);

          const result = await page.evaluate(async (platform, dataUrl, text, hash) => {
            return new Promise((resolve) => {
              window.chrome.runtime.onMessage.dispatch(
                {
                  type: 'handoff',
                  prompt: text,
                  promptHash: hash,
                  attachments: [
                    { id: 'ref-1', name: 'mockup-a.png', mime: 'image/png', dataUrl, stateHash: 'h-a' },
                    { id: 'ref-2', name: 'mockup-b.png', mime: 'image/png', dataUrl, stateHash: 'h-b' }
                  ],
                  submit: true,
                  executionId: 'exec-multi-01',
                  destinationFingerprint: `${platform}:new`,
                },
                {},
                resolve
              );
            });
          }, adapter.name, tinyPng, prompt, promptHash);

          assert.equal(result.ok, true, `Multi-ref handoff succeeded on ${adapter.name}: ${result.error}`);
          assert.equal(result.attached, 2, `2 references attached on ${adapter.name}`);
          assert.equal(result.attachment_state_hashes?.length, 2);
        } finally {
          await page.close();
        }
      });
    }

    await t.test('Scenario 5: Two-Phase separation (Prompt not inserted into host during Phase A)', async () => {
      const page = await browser.newPage();
      try {
        await setupPageForAdapter(page, mockServer.baseUrl, 'ChatGPT', 'chatgpt.html');

        // Phase A: Workspace compiles intent (simulation)
        const compiledIntent = {
          prompt: 'Replace central subject with realistic lion.',
          attachments: [{ id: 'ref-1', name: 'lion.png' }],
        };
        const promptHash = computePromptHash(compiledIntent.prompt);

        // In Phase A, no handoff message has been dispatched to destination tab yet!
        const composerText = await page.evaluate(() => {
          const el = document.querySelector('#prompt-textarea');
          return el ? el.innerText.trim() : '';
        });
        assert.equal(composerText, '', 'Composer must remain completely empty during Phase A review');

        const eventsBeforeHandoff = await page.evaluate(() => window.__VISCUE_EVENTS || []);
        assert.equal(eventsBeforeHandoff.length, 0, 'No events in host destination before Phase B confirmation');

        // Phase B: User clicks "Confirm & Send" in review dialog
        const handoffResult = await page.evaluate(async (intent, hash) => {
          return new Promise((resolve) => {
            window.chrome.runtime.onMessage.dispatch(
              {
                type: 'handoff',
                prompt: intent.prompt,
                promptHash: hash,
                attachments: [],
                submit: false, // Insert only
                executionId: 'phase-b-01',
                destinationFingerprint: 'ChatGPT:new',
              },
              {},
              resolve
            );
          });
        }, compiledIntent, promptHash);

        assert.equal(handoffResult.ok, true);
        assert.equal(handoffResult.prompt_verified, true);

        // Verify composer now contains prompt
        const composerAfter = await page.evaluate(() => {
          return document.querySelector('#prompt-textarea')?.innerText.trim();
        });
        assert.match(composerAfter, /Replace central subject with realistic lion/);
      } finally {
        await page.close();
      }
    });

    await t.test('Scenario 6: Verified receipt check and auto-close boundary', async () => {
      // 1. Success boundary: handoff ok, prompt verified, receipt cached -> shouldCloseWorkspace is true
      const validHandoff = { ok: true, prompt_verified: true };
      const validReceipt = { ok: true, cached: true };
      assert.equal(shouldCloseWorkspace(validHandoff, validReceipt), true);

      // 2. Failure boundary: prompt rejected by host (?reject=true)
      const page = await browser.newPage();
      try {
        await setupPageForAdapter(page, mockServer.baseUrl, 'ChatGPT', 'chatgpt.html?reject=true');

        const prompt = 'This will be cleared by the host to test rejection.';
        const promptHash = computePromptHash(prompt);

        const failedHandoff = await page.evaluate(async (text, hash) => {
          return new Promise((resolve) => {
            window.chrome.runtime.onMessage.dispatch(
              {
                type: 'handoff',
                prompt: text,
                promptHash: hash,
                attachments: [],
                submit: true,
                executionId: 'exec-fail-01',
                destinationFingerprint: 'ChatGPT:new',
              },
              {},
              resolve
            );
          });
        }, prompt, promptHash);

        assert.equal(failedHandoff.ok, false, 'Handoff must report failure when host drops prompt');
        assert.equal(shouldCloseWorkspace(failedHandoff, { ok: false }), false, 'Workspace must NOT close on failed handoff');
      } finally {
        await page.close();
      }
    });

  } finally {
    // Scenario 7: Guarantee zero stranded browser processes
    if (browser) {
      await browser.close();
    }
    if (mockServer) {
      await mockServer.close();
    }
  }
});
