import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import markSteel from '../assets/viscue-mark-steel.png';
import markOrange from '../assets/viscue-mark-orange.png';
import usageHero from '../assets/viscue-usage-hero.png';
import person from '../assets/onboarding-person.png';
import aiGrid from '../assets/onboarding-ai-grid.png';
import demoWorkspace from '../assets/demo-01-workspace.png';
import demoAssets from '../assets/demo-02-assets.png';
import demoReference from '../assets/demo-03-reference.png';
import demoAnnotate from '../assets/demo-04-annotate.png';
import demoText from '../assets/demo-05-text.png';
import {
  SlidersHorizontal,
  UserCircle,
  SignOut,
  X,
} from '@phosphor-icons/react';
import {
  advanceOnboarding,
  createOnboardingState,
  getOnboardingSceneDuration,
  shouldShowOnboarding,
  skipOnboarding,
} from './onboardingModel.mjs';
import './popup.css';

const ONBOARDING_KEY = 'viscue-onboarding-complete';
const DEMO_FRAMES = [demoWorkspace, demoAssets, demoReference, demoAnnotate, demoText];

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
          <span className="demo-recording" aria-label="Recording of the real Viscue workspace">
            {DEMO_FRAMES.map((frame, index) => (
              <img key={frame} src={frame} alt="" style={{ '--frame-index': index }} />
            ))}
            <span className="recording-badge"><span /> Actual Viscue flow</span>
          </span>
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

function Onboarding({ onComplete, onStart }) {
  const [state, setState] = useState(createOnboardingState);
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
    onComplete();
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
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [plan, setPlan] = useState('free');
  const [userEmail, setUserEmail] = useState('witne@gmail.com');
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    readSetting('viscue-auto-submit', false).then(setAutoSubmit);
    readSetting('viscue-plan', 'free').then(value => setPlan(['free', 'pro', 'plus'].includes(value) ? value : 'free'));
    readSetting('viscue-user-email', 'witne@gmail.com').then(setUserEmail);
    readSetting('viscue-is-logged-out', false).then(setIsLoggedOut);
  }, []);

  const toggleAutoSubmit = () => {
    const next = !autoSubmit;
    setAutoSubmit(next);
    writeSetting('viscue-auto-submit', next);
  };

  const pickPlan = (newPlan) => {
    setPlan(newPlan);
    writeSetting('viscue-plan', newPlan);
  };

  const handleLogout = () => {
    setIsLoggedOut(true);
    writeSetting('viscue-is-logged-out', true);
  };

  const handleLogin = () => {
    setIsLoggedOut(false);
    writeSetting('viscue-is-logged-out', false);
  };

  const planLabel = { free: 'Free', pro: 'Pro', plus: 'Plus' }[plan] ?? 'Free';
  const cuesTotal = plan === 'free' ? 9 : plan === 'pro' ? 20 : 50;

  return (
    <main className="popup-shell">
      <div className="popup-content">
        <header className="brand-lockup">
          <div className="brand-lockup-main">
            <img src={markSteel} alt="" />
            <h1>Viscue</h1>
          </div>
          <button
            type="button"
            className="brand-settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
            title="Open Settings"
          >
            <SlidersHorizontal size={20} weight="bold" />
          </button>
        </header>

        <button
          type="button"
          className="plan-label"
          onClick={() => setShowSettings(true)}
          title="Change plan"
        >
          <strong>Plan</strong> - {planLabel}
        </button>

        <div className="typography-cue">
          Cue<br />left
        </div>

        <div className="typography-count">
          {cuesTotal}/{cuesTotal}
        </div>

        <div className="toggle-container">
          <button
            type="button"
            className={`switch ${autoSubmit ? 'is-on' : ''}`}
            onClick={toggleAutoSubmit}
            aria-label="Toggle auto submit"
            role="switch"
            aria-checked={autoSubmit}
            title={autoSubmit ? 'Auto submit is ON' : 'Auto submit is OFF'}
          >
            <span className="handle" />
          </button>
        </div>
      </div>

      {showSettings && (
        <aside className="settings-overlay" aria-label="Settings">
          <header className="settings-overlay-header">
            <h2>Settings</h2>
            <button
              type="button"
              className="settings-overlay-close"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              <X size={22} weight="bold" />
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
                    {isLoggedOut ? 'Signed out' : userEmail}
                  </span>
                </div>
              </div>
              {isLoggedOut ? (
                <button type="button" className="settings-account-auth-btn" onClick={handleLogin}>
                  Sign in
                </button>
              ) : (
                <button type="button" className="settings-account-auth-btn" onClick={handleLogout}>
                  <SignOut size={14} weight="bold" />
                  <span>Log out</span>
                </button>
              )}
            </div>
          </div>

          <div className="settings-card settings-plans-list">
            <h3>Plans &amp; Allowance</h3>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Free</strong>
                <small>9 Cues / day</small>
              </div>
              {plan === 'free' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button type="button" className="settings-plan-select-btn" onClick={() => pickPlan('free')}>
                  Select
                </button>
              )}
            </div>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Pro</strong>
                <small>20 Cues / day</small>
              </div>
              {plan === 'pro' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button type="button" className="settings-plan-select-btn" onClick={() => pickPlan('pro')}>
                  $4.90 / mo
                </button>
              )}
            </div>

            <div className="settings-plan-choice">
              <div className="settings-plan-name-group">
                <strong>Plus</strong>
                <small>50 Cues / day</small>
              </div>
              {plan === 'plus' ? (
                <span className="settings-plan-badge">Current</span>
              ) : (
                <button type="button" className="settings-plan-select-btn" onClick={() => pickPlan('plus')}>
                  $9 / mo
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}

function Popup() {
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    readSetting(ONBOARDING_KEY, false).then(value => setOnboardingComplete(Boolean(value)));
  }, []);

  const completeOnboarding = async () => {
    await writeSetting(ONBOARDING_KEY, true);
    setOnboardingComplete(true);
  };

  const startViscue = async () => {
    await completeOnboarding();
    if (globalThis.chrome?.runtime?.sendMessage) {
      const response = await chrome.runtime.sendMessage({ type: 'open-workspace' });
      if (response?.ok) globalThis.close();
      return;
    }
    globalThis.location.assign('./index.html');
  };

  if (onboardingComplete === null) return <main className="popup-loading" aria-label="Loading Viscue" />;
  if (shouldShowOnboarding(onboardingComplete)) {
    return <Onboarding onComplete={completeOnboarding} onStart={startViscue} />;
  }
  return <StandardPopup />;
}

createRoot(document.getElementById('popup-root')).render(<Popup />);
