import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import markSteel from '../assets/viscue-mark-steel.png';
import markOrange from '../assets/viscue-mark-orange.png';
import usageHero from '../assets/viscue-usage-hero.png';
import person from '../assets/onboarding-person.png';
import aiGrid from '../assets/onboarding-ai-grid.png';
import { ViscueLogo } from './components/ui/ViscueLogo';
import {
  SlidersHorizontal,
  UserCircle,
  SignOut,
  X,
  ArrowUpRight,
  House,
  Sparkle,
} from '@phosphor-icons/react';
import {
  advanceOnboarding,
  createOnboardingState,
  getOnboardingSceneDuration,
  shouldShowOnboarding,
  skipOnboarding,
} from './onboardingModel.mjs';
import { accountView } from './accountModel.mjs';
import { STORAGE_KEY } from '../auth/session.mjs';
import { normalizePlatformCapability } from '../../local-server/lib/platform-capabilities.mjs';
import { PLATFORM_PLAN_SETUP_KEY, PLATFORM_PLAN_STORAGE_KEY, platformPlanState } from './platformPlanModel.mjs';
import { PlatformPlanSettings } from './components/ui/PlatformPlanSettings.mjs';
import './popup.css';

const ONBOARDING_KEY = 'viscue-onboarding-complete';
const CACHED_SUMMARY_KEY = 'viscue_cached_account_summary';

const readSetting = (key, fallback) => {
  if (globalThis.chrome?.storage?.local) {
    return new Promise(resolve => chrome.storage.local.get(key, value => resolve(value[key] ?? fallback)));
  }
  return Promise.resolve(JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)));
};

const writeSetting = (key, value) => {
  if (globalThis.chrome?.storage?.local) return chrome.storage.local.set({ [key]: value });
  localStorage.setItem(key, JSON.stringify(value));
  return Promise.resolve();
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = event => setReduced(event.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function Eye({ children, className = '', blinking, label, onClick }) {
  return (
    <button
      type="button"
      className={`onboarding-eye ${className}${blinking ? ' is-blinking' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <span className="eye-content">{children}</span>
    </button>
  );
}

function LiveWorkspaceDemo() {
  return (
    <div className="live-demo-workspace" aria-label="Interactive live preview of Viscue workspace">
      <div className="live-demo-dest">
        <span className="live-demo-dest__pill">ChatGPT</span>
        <div className="live-demo-dest__badge">
          <span className="live-demo-pulse" />
          <span>Intent Attached</span>
        </div>
      </div>

      <div className="live-demo-canvas">
        <div className="live-demo-card">
          <div className="live-demo-card__header">
            <span className="live-demo-card__dot red" />
            <span className="live-demo-card__dot yellow" />
            <span className="live-demo-card__dot green" />
            <span className="live-demo-card__title">Checkout Modal</span>
          </div>
          <div className="live-demo-card__body">
            <div className="live-demo-card__row">
              <span className="live-demo-card__line long" />
              <span className="live-demo-card__line short" />
            </div>
            <div className="live-demo-target-btn">
              Pay $49.00
              <div className="live-demo-target-ring" />
            </div>
          </div>
        </div>

        <svg className="live-demo-svg" viewBox="0 0 160 90" fill="none">
          <path d="M 72 48 C 92 32, 102 28, 114 28" stroke="#DF5360" strokeWidth="2" strokeDasharray="3 3" />
          <polygon points="115,25 123,28 115,31" fill="#DF5360" />
        </svg>

        <div className="live-demo-note">
          <span className="live-demo-note__pin" />
          <div className="live-demo-note__text">
            <strong>Make rounded</strong>
            <span>with #3B82F6</span>
          </div>
        </div>

        <div className="live-demo-scanline" />
      </div>

      <div className="live-demo-dock">
        <div className="live-demo-dock__rail">
          <span className="live-demo-dock__icon active" title="Select">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg>
          </span>
          <span className="live-demo-dock__icon" title="Add Assets">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
          </span>
          <span className="live-demo-dock__icon" title="Annotate">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
          </span>
          <span className="live-demo-dock__icon" title="Text Note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
          </span>
        </div>
        <div className="live-demo-dock__cue">
          <span>Cue</span>
        </div>
      </div>
    </div>
  );
}

function Scene({ scene, blinking, onAdvance, onStart }) {
  if (scene === 0) {
    return (
      <section className="onboarding-scene scene-idea" aria-label="Your idea is clear in your head">
        <img className="person person-close" src={person} alt="A person visualizing an idea" />
        <Eye blinking={blinking} label="Continue to make the idea clear to AI" onClick={onAdvance}>
          <span className="eye-copy eye-copy-left">Your idea is clear<br />in your head</span>
        </Eye>
      </section>
    );
  }

  if (scene === 1) {
    return (
      <section className="onboarding-scene scene-explain" aria-label="Now make it clear to AI">
        <img className="person person-explain" src={person} alt="A person explaining an idea" />
        <Eye blinking={blinking} label="Continue to see Viscue in action" onClick={onAdvance}>
          <span className="eye-copy explain-copy">Now make it<br />clear to <strong>AI</strong></span>
        </Eye>
      </section>
    );
  }

  if (scene === 2) {
    return (
      <section className="onboarding-scene scene-demo" aria-label="Show AI what you really mean">
        <h2>Show AI what you<br />really mean.</h2>
        <Eye blinking={blinking} className="demo-eye" label="Continue to supported AI tools" onClick={onAdvance}>
          <LiveWorkspaceDemo />
        </Eye>
      </section>
    );
  }

  if (scene === 3) {
    return (
      <section className="onboarding-scene scene-anywhere" aria-label="Anywhere you work">
        <Eye blinking={blinking} className="apps-eye" label="Continue to start Viscue" onClick={onAdvance}>
          <img className="ai-grid" src={aiGrid} alt="ChatGPT, Claude, Gemini, Copilot, Grok and DeepSeek" />
        </Eye>
        <h2>Anywhere you<br />work.</h2>
      </section>
    );
  }

  return (
    <section className="onboarding-scene scene-finish" aria-label="Start Viscue">
      <div className="finish-blink" aria-hidden="true"><span /></div>
      <p className="finish-steps"><strong>Open.</strong><strong>Show.</strong><strong>Cue.</strong></p>
      <p className="finish-line">That’s it.</p>
      <button type="button" className="start-viscue" onClick={onStart}>
        <img src={markSteel} alt="" />
        <span>Start Viscue</span>
      </button>
    </section>
  );
}

function Onboarding({ onStart }) {
  const [state, setState] = useState(() => {
    const params = new URLSearchParams(globalThis.location?.search || '');
    const sceneParam = params.get('scene');
    if (sceneParam !== null && !isNaN(Number(sceneParam))) {
      return { scene: Number(sceneParam), completed: false };
    }
    return createOnboardingState();
  });
  const [blinking, setBlinking] = useState(false);
  const reducedMotion = useReducedMotion();

  const advance = useCallback(() => {
    if (blinking || state.scene === 4) return;
    if (reducedMotion) {
      setState(current => advanceOnboarding(current));
      return;
    }
    setBlinking(true);
    globalThis.setTimeout(() => {
      setState(current => advanceOnboarding(current));
      setBlinking(false);
    }, 460);
  }, [blinking, reducedMotion, state.scene]);

  useEffect(() => {
    if (state.scene >= 4) return undefined;
    const timer = globalThis.setTimeout(advance, getOnboardingSceneDuration(state.scene, reducedMotion));
    return () => globalThis.clearTimeout(timer);
  }, [advance, reducedMotion, state.scene]);

  const skip = () => {
    setState(current => skipOnboarding(current));
  };

  return (
    <main className={`onboarding-shell scene-${state.scene}`}>
      <div className="onboarding-progress" aria-label={`Onboarding step ${state.scene + 1} of 5`}>
        {[0, 1, 2, 3, 4].map(step => <span key={step} className={step === state.scene ? 'active' : ''} />)}
      </div>
      <Scene scene={state.scene} blinking={blinking} onAdvance={advance} onStart={onStart} />
      {state.scene < 4 && <button type="button" className="skip-button" onClick={skip}>Skip</button>}
    </main>
  );
}

function StandardPopup() {
  const [activeView, setActiveView] = useState('home');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [summary, setSummary] = useState(null);
  const [session, setSession] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [billingBusy, setBillingBusy] = useState(null);
  const [platformName, setPlatformName] = useState('ChatGPT');
  const [platformCapability, setPlatformCapability] = useState(() => normalizePlatformCapability({}, 'ChatGPT'));
  const generationRef = useRef(0);

  const fetchSummary = useCallback(() => {
    const reqGen = ++generationRef.current;
    if (globalThis.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'account-get' }, res => {
        if (generationRef.current !== reqGen) return;
        if (res?.ok && res?.data && !res.signedOut) {
          setSummary(res.data);
          writeSetting(CACHED_SUMMARY_KEY, res.data);
        } else {
          setSummary(null);
          writeSetting(CACHED_SUMMARY_KEY, null);
        }
      });
    }
  }, []);

  const refreshPlatformDetection = useCallback(() => {
    Promise.all([
      readSetting(PLATFORM_PLAN_STORAGE_KEY, null),
      readSetting(PLATFORM_PLAN_SETUP_KEY, false),
      globalThis.chrome?.runtime?.sendMessage
        ? new Promise(resolve => chrome.runtime.sendMessage({ type: 'active-context' }, resolve))
        : Promise.resolve(null),
    ]).then(([capability, completed, response]) => {
      const detected = response?.context?.platform || 'ChatGPT';
      const state = platformPlanState({ [PLATFORM_PLAN_STORAGE_KEY]: capability, [PLATFORM_PLAN_SETUP_KEY]: completed }, detected);
      setPlatformName(detected);
      setPlatformCapability(state.capability);
    });
  }, []);

  useEffect(() => {
    readSetting('viscue-auto-submit', false).then(setAutoSubmit);
    readSetting(STORAGE_KEY, null).then(sess => {
      if (sess?.user?.email) {
        setSession(sess);
      }
    });
    readSetting(CACHED_SUMMARY_KEY, null).then(cached => {
      if (cached?.email) {
        setSummary(cached);
      }
    });

    refreshPlatformDetection();
    fetchSummary();

    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchSummary();
        refreshPlatformDetection(); // Re-detect platform every time popup opens
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let removeStorageListener = null;
    if (globalThis.chrome?.storage?.onChanged) {
      const storageListener = (changes, area) => {
        if (area === 'local') {
          if (changes[STORAGE_KEY]) {
            const newSession = changes[STORAGE_KEY].newValue;
            if (newSession?.user?.email) {
              setSession(newSession);
              fetchSummary();
            } else {
              setSession(null);
              setSummary(null);
            }
          }
          if (changes[CACHED_SUMMARY_KEY]) {
            const newSummary = changes[CACHED_SUMMARY_KEY].newValue;
            if (newSummary) {
              setSummary(newSummary);
            }
          }
          // Re-sync platform capability when storage changes (e.g. user navigates to different AI tool)
          if (changes[PLATFORM_PLAN_STORAGE_KEY] || changes[PLATFORM_PLAN_SETUP_KEY]) {
            refreshPlatformDetection();
          }
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
      removeStorageListener = () => chrome.storage.onChanged.removeListener(storageListener);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (removeStorageListener) removeStorageListener();
    };
  }, [fetchSummary, refreshPlatformDetection]);

  const updatePlatformCapability = capability => {
    const normalized = normalizePlatformCapability(capability, platformName);
    setPlatformCapability(normalized);
    if (globalThis.chrome?.storage?.local) {
      chrome.storage.local.set({ [PLATFORM_PLAN_STORAGE_KEY]: normalized, [PLATFORM_PLAN_SETUP_KEY]: true });
    } else {
      writeSetting(PLATFORM_PLAN_STORAGE_KEY, normalized);
      writeSetting(PLATFORM_PLAN_SETUP_KEY, true);
    }
  };

  const toggleAutoSubmit = () => {
    const next = !autoSubmit;
    setAutoSubmit(next);
    writeSetting('viscue-auto-submit', next);
  };

  const handleLogout = () => {
    generationRef.current++;
    setSummary(null);
    setSession(null);
    writeSetting(CACHED_SUMMARY_KEY, null);
    setAuthBusy(true);
    if (globalThis.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'auth-sign-out' }, () => {
        setAuthBusy(false);
        setSummary(null);
        setSession(null);
      });
    } else {
      setAuthBusy(false);
    }
  };

  const handleLogin = () => {
    setAuthBusy(true);
    if (globalThis.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'auth-sign-in' }, res => {
        setAuthBusy(false);
        if (res?.ok) {
          // Re-read session directly from storage for instant, reliable update
          chrome.storage.local.get('viscue_oauth_session', result => {
            const stored = result?.viscue_oauth_session;
            if (stored?.user?.email) setSession(stored);
          });
          fetchSummary();
        }
      });
    } else {
      setAuthBusy(false);
    }
  };

  const openBilling = (plan) => {
    setBillingBusy(plan || 'default');
    if (globalThis.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'billing-open', plan }, () => {
        setBillingBusy(null);
      });
    } else {
      setBillingBusy(null);
    }
  };

  const view = accountView(summary, session);
  const planLabel = { free: 'Free', pro: 'Pro', plus: 'Plus' }[view.plan] ?? 'Free';

  const openWorkspace = () => {
    if (globalThis.chrome?.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open('./index.html', '_blank');
    }
  };

  const countParts = String(view.count || '9/9').split('/');
  const currentCount = parseInt(countParts[0], 10) || 0;
  const totalCount = parseInt(countParts[1], 10) || 9;
  const countPercent = totalCount > 0 ? Math.min(100, Math.max(0, Math.round((currentCount / totalCount) * 100))) : 100;

  return (
    <main className="popup-shell">
      <div className="popup-content">
        <header className="brand-lockup">
          <div className="brand-lockup-main">
            <ViscueLogo size={34} variant="mark" animated={true} style={{ color: '#5B7593', cursor: 'pointer' }} title="Viscue — Click to replay animation" />
            <h1>Viscue</h1>
          </div>
          <div className="brand-lockup-actions">
            <button
              type="button"
              className="plan-label"
              onClick={() => setActiveView('settings')}
              title="Change plan"
            >
              <span className="plan-pill-tag">Plan</span>
              <span className="plan-pill-sep">·</span>
              <span className="plan-pill-val">{planLabel}</span>
            </button>
            <button
              type="button"
              className="brand-settings-toggle"
              onClick={() => setActiveView(activeView === 'home' ? 'settings' : 'home')}
              aria-label={activeView === 'home' ? 'Open settings' : 'Return to home'}
              title={activeView === 'home' ? 'Open settings' : 'Return to home'}
            >
              <SlidersHorizontal size={18} weight="bold" />
            </button>
          </div>
        </header>

        <section className="popup-hero-card" aria-label="Daily Cue Allowance">
          <div className="popup-hero-header">
            <span className="typography-cue">
              Cue left
            </span>
            <span className="popup-hero-badge">
              <Sparkle size={11} weight="fill" />
              <span>{view.plan === 'free' ? 'Daily Reset' : `${planLabel} Plan`}</span>
            </span>
          </div>

          <div className="popup-hero-count-row">
            <span className="typography-count">
              {view.count}
            </span>
            <span className="popup-hero-count-sub">cues left today</span>
          </div>

          <div className="popup-hero-meter" role="progressbar" aria-valuenow={currentCount} aria-valuemin={0} aria-valuemax={totalCount}>
            <div className="popup-hero-track">
              <div
                className="popup-hero-bar"
                style={{ width: `${countPercent}%` }}
              />
            </div>
          </div>

          <div className="popup-hero-meta-row">
            <span className="popup-hero-meta-chip ready">
              <span className="meta-dot" />
              <span>{countPercent}% Available</span>
            </span>
            <span className="popup-hero-meta-chip">
              <Sparkle size={11} weight="fill" />
              <span>Visual Intent Ready</span>
            </span>
          </div>

          <p className="popup-hero-caption">
            Visual reference context and AI intents ready for ChatGPT, Claude &amp; more.
          </p>
        </section>

        <div className="popup-actions-group">
          <button
            type="button"
            className="popup-btn-open-workspace"
            onClick={openWorkspace}
            title="Open Viscue Canvas Workspace"
          >
            <span>Open Canvas Workspace</span>
            <ArrowUpRight size={17} weight="bold" />
          </button>
        </div>

        <div className="popup-platform-status">
          <div className="popup-platform-indicator">
            <span className="popup-platform-dot" />
            <span className="popup-platform-dot-ring" />
          </div>
          <div className="popup-platform-text">
            <span className="popup-platform-title">Connected AI</span>
            <span className="popup-platform-val">{platformName || 'ChatGPT'} · Intent Ready</span>
          </div>
          <button
            type="button"
            className="popup-platform-config-btn"
            onClick={() => setActiveView('settings')}
            title="Configure platform plan"
          >
            Configure
          </button>
        </div>

        <div className="popup-feature-card">
          <div className="popup-feature-item">
            <span className="popup-feature-icon">
              <Sparkle size={15} weight="fill" />
            </span>
            <div className="popup-feature-copy">
              <strong>Visual Intent Engine</strong>
              <small>Point, annotate, and compile instructions into your chat</small>
            </div>
          </div>
        </div>
      </div>

      {activeView === 'settings' && (
        <aside className="settings-overlay" aria-label="Settings">
          <header className="settings-overlay-header">
            <div className="settings-overlay-title-group">
              <h2>Settings</h2>
              <p className="settings-overlay-sub">Preferences, account &amp; AI limits</p>
            </div>
            <button
              type="button"
              className="settings-overlay-close"
              onClick={() => setActiveView('home')}
              aria-label="Close settings"
            >
              <X size={20} weight="bold" />
            </button>
          </header>

          <div className="settings-card">
            <div className="settings-auto-submit-row">
              <div className="settings-auto-submit-info">
                <h3>Auto submit</h3>
                <p>VisCue prepares the chat; you stay in control of Send.</p>
              </div>
              <button
                type="button"
                className={`settings-mini-switch ${autoSubmit ? 'is-on' : ''}`}
                onClick={toggleAutoSubmit}
                role="switch"
                aria-checked={autoSubmit}
                aria-label="Toggle auto submit"
              >
                <span className="settings-mini-knob" />
              </button>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-account-block">
              <div className="settings-account-meta">
                <UserCircle size={28} weight="bold" color="#8299B2" />
                <div className="settings-account-email-wrap">
                  <span className="settings-account-label">Account</span>
                  <span className="settings-account-email-val">
                    {view.email || 'Signed out'}
                  </span>
                </div>
              </div>
              {!view.email || view.state === 'signed-out' ? (
                <button
                  type="button"
                  className="settings-account-auth-btn"
                  onClick={handleLogin}
                  disabled={authBusy}
                >
                  {authBusy ? 'Signing in…' : 'Sign in'}
                </button>
              ) : (
                <button
                  type="button"
                  className="settings-account-auth-btn"
                  onClick={handleLogout}
                  disabled={authBusy}
                >
                  <SignOut size={14} weight="bold" />
                  <span>{authBusy ? 'Signing out…' : 'Log out'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="settings-card">
            <PlatformPlanSettings
              platformName={platformName}
              capability={platformCapability}
              viscuePlan={view.plan}
              onChange={updatePlatformCapability}
            />
          </div>

          <div className="settings-card settings-plans-list">
            <h3>Plans &amp; Allowance</h3>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Free</strong>
                <small>{view.plan === 'free' && view.cuesMax > 0 ? `${view.cuesLeft} / ${view.cuesMax} Cues left` : '9 Cues / day'}</small>
              </div>
              {view.plan === 'free' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button
                  type="button"
                  className="settings-plan-select-btn"
                  onClick={() => openBilling('free')}
                  disabled={Boolean(billingBusy)}
                >
                  Default
                </button>
              )}
            </div>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Plus</strong>
                <small>{view.plan === 'plus' && view.cuesMax > 0 ? `${view.cuesLeft} / ${view.cuesMax} Cues left` : '28 Cues / day'}</small>
              </div>
              {view.plan === 'plus' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button
                  type="button"
                  className="settings-plan-select-btn"
                  onClick={() => openBilling('plus')}
                  disabled={Boolean(billingBusy)}
                >
                  {billingBusy === 'plus' ? 'Opening…' : '$4.90 / mo'}
                </button>
              )}
            </div>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Pro</strong>
                <small>{view.plan === 'pro' && view.cuesMax > 0 ? `${view.cuesLeft} / ${view.cuesMax} Cues left` : '99 Cues / day'}</small>
              </div>
              {view.plan === 'pro' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button
                  type="button"
                  className="settings-plan-select-btn"
                  onClick={() => openBilling('pro')}
                  disabled={Boolean(billingBusy)}
                >
                  {billingBusy === 'pro' ? 'Opening…' : '$9.00 / mo'}
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      <div className="toggle-container" role="tablist" aria-label="Navigation">
        <div className={`segmented-control ${activeView === 'settings' ? 'is-settings' : 'is-home'}`}>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'home'}
            className={`segmented-btn ${activeView === 'home' ? 'is-active' : ''}`}
            onClick={() => setActiveView('home')}
          >
            <House size={14} weight={activeView === 'home' ? 'fill' : 'bold'} />
            <span>Home</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'settings'}
            className={`segmented-btn ${activeView === 'settings' ? 'is-active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <SlidersHorizontal size={14} weight={activeView === 'settings' ? 'fill' : 'bold'} />
            <span>Settings</span>
          </button>
          <span className="segmented-thumb" aria-hidden="true" />
        </div>
      </div>
    </main>
  );
}

function Popup() {
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (params.get('onboarding') === '1' || params.get('scene') !== null) {
      setOnboardingComplete(false);
      return;
    }
    readSetting(ONBOARDING_KEY, false).then(value => setOnboardingComplete(Boolean(value)));
  }, []);

  const completeOnboarding = async () => {
    await writeSetting(ONBOARDING_KEY, true);
    setOnboardingComplete(true);
  };

  const startViscue = async () => {
    if (globalThis.chrome?.runtime?.sendMessage) {
      // Wait for sign-in to complete before marking onboarding done,
      // so StandardPopup mounts with a live session already in storage.
      chrome.runtime.sendMessage({ type: 'auth-sign-in' }, async () => {
        await completeOnboarding();
      });
      return;
    }
    // Fallback for non-extension environments
    await completeOnboarding();
    globalThis.location.assign('./index.html');
  };

  if (onboardingComplete === null) return <main className="popup-loading" aria-label="Loading Viscue" />;
  if (shouldShowOnboarding(onboardingComplete)) {
    return <Onboarding onStart={startViscue} />;
  }
  return <StandardPopup />;
}

createRoot(document.getElementById('popup-root')).render(<Popup />);
