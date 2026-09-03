/* global chrome */
(function () {
  'use strict';

  function readSetting(key, fallback) {
    try {
      if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
        return new Promise(function (resolve) {
          try {
            chrome.storage.local.get(key, function (value) {
              resolve((value && value[key] !== undefined) ? value[key] : fallback);
            });
          } catch (_) { resolve(fallback); }
        });
      }
    } catch (_) {}
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return Promise.resolve(v === null ? fallback : v);
    } catch (_) { return Promise.resolve(fallback); }
  }

  function writeSetting(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: value });
        return;
      }
    } catch (_) {}
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function init() {
    var shell         = document.getElementById('popup-shell');
    var btnOpen       = document.getElementById('btn-open-workspace');
    var openError     = document.getElementById('open-error');
    var btnAutoSubmit = document.getElementById('btn-auto-submit');
    var toggleEl      = document.getElementById('toggle-el');
    var navHome       = document.getElementById('nav-home');
    var navSettings   = document.getElementById('nav-settings');

    if (!shell || !btnOpen || !navHome || !navSettings) {
      return;
    }

    var autoSubmit = false;
    var openingWorkspace = false;

    function setScreen(screen) {
      shell.className = 'popup-shell screen-' + screen;
      navHome.classList.toggle('is-active', screen === 'home');
      navHome.setAttribute('aria-current', screen === 'home' ? 'page' : 'false');
      navSettings.classList.toggle('is-active', screen === 'settings');
      navSettings.setAttribute('aria-current', screen === 'settings' ? 'page' : 'false');
    }

    navHome.addEventListener('click', function () { setScreen('home'); });
    navSettings.addEventListener('click', function () { setScreen('settings'); });

    function applyAutoSubmit(value) {
      autoSubmit = Boolean(value);
      if (toggleEl) toggleEl.classList.toggle('is-on', autoSubmit);
      if (btnAutoSubmit) btnAutoSubmit.setAttribute('aria-pressed', String(autoSubmit));
    }

    if (btnAutoSubmit) {
      btnAutoSubmit.addEventListener('click', function () {
        applyAutoSubmit(!autoSubmit);
        writeSetting('viscue-auto-submit', autoSubmit);
      });
    }

    async function openWorkspace() {
      if (openingWorkspace) return;
      openingWorkspace = true;
      btnOpen.disabled = true;
      if (openError) { openError.textContent = ''; openError.classList.remove('visible'); }

      try {
        if (typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.runtime.sendMessage) {
          var response = await chrome.runtime.sendMessage({ type: 'open-workspace' });
          if (!response || !response.ok) throw new Error((response && response.error) || 'Could not open workspace.');
          window.close();
          return;
        }
        window.location.assign('./index.html');
      } catch (err) {
        try {
          if (typeof chrome !== 'undefined' && chrome && chrome.tabs && chrome.tabs.create && chrome.runtime && chrome.runtime.getURL) {
            await chrome.tabs.create({ url: chrome.runtime.getURL('index.html'), active: true });
            window.close();
            return;
          }
        } catch (_) {}
        if (openError) {
          openError.textContent = (err && err.message) || 'Could not open workspace.';
          openError.classList.add('visible');
        }
      } finally {
        openingWorkspace = false;
        btnOpen.disabled = false;
      }
    }

    btnOpen.addEventListener('click', openWorkspace);
    readSetting('viscue-auto-submit', false).then(applyAutoSubmit).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();