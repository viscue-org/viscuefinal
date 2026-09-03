
    const lucide = {
      sun: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>`,
      moon: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>`,
      moreStack: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 4.5h5.5A4.5 4.5 0 0 1 19 9v1.5A4.5 4.5 0 0 1 14.5 15H9Z" />
          <path d="M6 7.5V16a3 3 0 0 0 3 3h8.5" />
          <path d="M3.5 10.5V17a4 4 0 0 0 4 4H14" />
        </svg>`,
      grid: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>`,
      database: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
          <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
        </svg>`,
      x: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>`,
      plus: `
        <!-- Lucide: Plus -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
      check: `
        <!-- Lucide: Check -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>`,
      chevronDown: `
        <!-- Lucide: ChevronDown -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
      search: `
        <!-- Lucide: Search -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
      settings2: `
        <!-- Lucide: Settings2 -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>`,
      slidersHorizontal: `
        <!-- Lucide: SlidersHorizontal -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>`,
      copy: `
        <!-- Lucide: Copy -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
      download: `
        <!-- Lucide: Download -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
      upload: `
        <!-- Lucide: Upload -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
      share2: `
        <!-- Lucide: Share2 -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`,
      save: `
        <!-- Lucide: Save -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
      link2: `
        <!-- Lucide: Link2 -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`,
      lock: `
        <!-- Lucide: Lock -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      eyeOff: `
        <!-- Lucide: EyeOff -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 2 20 20"/><path d="M6.71 6.71C4.94 7.95 3.58 9.68 3 12c2.73 4.2 5.73 6 9 6 1.04 0 2.05-.18 3.02-.53"/><path d="M10.73 5.08C11.15 5.03 11.57 5 12 5c3.27 0 6.27 1.8 9 7a11.8 11.8 0 0 1-1.39 2.19"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/></svg>`,
      trash2: `
        <!-- Lucide: Trash2 -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
      bold: `
        <!-- Lucide: Bold -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`,
      italic: `
        <!-- Lucide: Italic -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
      underline: `
        <!-- Lucide: Underline -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>`,
      alignLeft: `
        <!-- Lucide: AlignLeft -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>`,
      alignCenter: `
        <!-- Lucide: AlignCenter -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>`,
      image: `
        <!-- Lucide: Image -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
      fileText: `
        <!-- Lucide: FileText -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
      globe2: `
        <!-- Lucide: Globe2 -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      stickyNote: `
        <!-- Lucide: StickyNote -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M16 3v5h5"/></svg>`,
      rotateCcw: `
        <!-- Lucide: RotateCcw -->
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
      historySparkle: `
        <!-- Lucide: WandSparkles -->
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z" />
          <path d="m14 7 3 3" />
          <path d="M5 6v4" />
          <path d="M19 14v4" />
          <path d="M3 8h4" />
          <path d="M17 16h4" />
          <path d="M9 2v2" />
          <path d="M8 3h2" />
        </svg>`,
      historyFocus: `
        <!-- Lucide: History -->
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>`
    };

    const baseComponentStyles = `
      :host {
        font-family: "Instrument Sans", "Inter", "Noto Sans", system-ui, -apple-system, sans-serif;
        color: #1B1A18;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        font-synthesis: none;
      }
      * { box-sizing: border-box; }
      button {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        text-decoration: none !important;
      }
      button:focus-visible {
        outline: 2px solid var(--viscue-signal, #5B7593);
        outline-offset: 2px;
      }
      button:disabled,
      button[aria-disabled="true"] {
        cursor: not-allowed;
        opacity: 0.45;
      }
      @media (forced-colors: active) {
        button:focus-visible { outline: 2px solid CanvasText; }
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      svg path, svg line, svg polyline, svg circle, svg rect, svg ellipse {
        vector-effect: non-scaling-stroke;
      }
    `;

    class VisCueReferenceEmpty extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: block; width: 100%; font-family: "Instrument Sans", "Inter", system-ui, -apple-system, sans-serif; }
            .wrap {
              width: 100%;
              max-width: 480px;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              gap: 24px;
            }
            .icon-ring {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              background: linear-gradient(135deg, rgba(91,117,147,0.2) 0%, rgba(91,117,147,0.05) 100%);
              border: 1px solid rgba(91,117,147,0.15);
              display: grid;
              place-items: center;
              color: var(--viscue-signal, #5B7593);
              box-shadow: 0 0 32px rgba(91,117,147,0.1);
            }
            .icon-ring svg {
              width: 28px;
              height: 28px;
            }
            h1 {
              margin: 0;
              font-size: 28px;
              line-height: 34px;
              font-weight: 600;
              letter-spacing: -0.02em;
              color: var(--viscue-ink, #FFFFFF);
            }
            .subtitle {
              margin: 0;
              font-size: 15px;
              line-height: 22px;
              color: var(--viscue-muted, #A59CC8);
            }
            .actions {
              display: flex;
              flex-direction: column;
              gap: 12px;
              align-items: center;
              margin-top: 8px;
            }
            button.primary {
              appearance: none;
              -webkit-appearance: none;
              border: none;
              background: var(--viscue-signal, #5B7593);
              color: #FFFFFF;
              padding: 0 24px;
              height: 48px;
              border-radius: 24px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              transition: all 200ms ease;
              box-shadow: 0 8px 16px rgba(91, 117, 147, 0.15);
            }
            button.primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 24px rgba(91, 117, 147, 0.25);
            }
            .hint {
              font-size: 13px;
              color: var(--viscue-muted, #A59CC8);
              display: flex;
              align-items: center;
              gap: 6px;
            }
            kbd {
              background: rgba(255,255,255,0.1);
              padding: 2px 6px;
              border-radius: 4px;
              font-family: inherit;
              font-size: 11px;
              color: var(--viscue-ink, #FFFFFF);
            }
          </style>
          <div class="wrap">
            <div class="icon-ring">
              <svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
            </div>
            <div>
              <h1>Visual Context Canvas</h1>
              <p class="subtitle">Drag & drop files, or paste with <kbd>Ctrl</kbd> + <kbd>V</kbd></p>
            </div>
            <div class="actions">
              <button class="primary" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Reference
              </button>
            </div>
          </div>
        `;
      }

      connectedCallback() {
        this.shadowRoot.querySelector('.primary').addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('reference-request', { bubbles: true, composed: true, detail: { format: 'assets' } }));
        });
      }
    }

    class VisCueUtilityMenu extends HTMLElement {
      static get observedAttributes() { return ['theme']; }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: inline-block; }
            .group {
              display: inline-flex;
              align-items: center;
              gap: 12px;
            }
            button {
              width: 40px;
              height: 40px;
              display: grid;
              place-items: center;
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 12px;
              background: var(--viscue-paper, #FFFFFF);
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
              transition:
                transform 120ms cubic-bezier(.2,.8,.2,1),
                box-shadow 120ms ease,
                background-color 110ms ease;
            }
            .icon {
              width: 18px;
              height: 18px;
              color: var(--viscue-ink, #1B1A18);
              transition: transform 145ms cubic-bezier(.2,.8,.2,1);
            }
            .theme .icon { width: 19px; height: 19px; }
            .more .icon { width: 20px; height: 20px; }
            .more .icon svg { stroke-width: 2; }
            @media (hover:hover) {
              button:hover {
                transform: translateY(-1px);
                background: var(--viscue-paper, #FFFFFF);
                box-shadow: 0 4px 12px rgba(27,26,24,.06);
              }
              button:hover .icon { transform: translateY(-1px); }
              .more:hover { transform: translateY(-1px); }
            }
            button:active {
              transform: translateY(0) scale(.975);
              box-shadow: 0 2px 6px rgba(27,26,24,.04);
              transition-duration: 90ms;
            }
            .more:active { transform: translateY(0) scale(.97); }
            @media (prefers-reduced-motion: reduce) {
              button, .icon { transition: none; }
              button:hover, .more:hover, button:hover .icon, button:active, .more:active { transform: none; }
            }
          </style>
          <div class="group" role="group" aria-label="Theme and more options">
            <button class="theme" type="button" aria-label="Toggle appearance" aria-pressed="false">
              <span class="icon">${lucide.moon}</span>
            </button>
            <button class="more" type="button" aria-label="More options">
              <span class="icon">${lucide.moreStack}</span>
            </button>
          </div>
        `;
      }

      connectedCallback() {
        const themeBtn = this.shadowRoot.querySelector('.theme');
        const moreBtn = this.shadowRoot.querySelector('.more');
        this._syncTheme();
        themeBtn.addEventListener('click', () => {
          const isDark = this.getAttribute('theme') === 'dark' || themeBtn.getAttribute('aria-pressed') === 'true';
          const next = !isDark;
          this.setAttribute('theme', next ? 'dark' : 'light');
          this.dispatchEvent(new CustomEvent('appearance-toggle', {
            bubbles: true, composed: true, detail: { active: next, theme: next ? 'dark' : 'light' }
          }));
        });
        moreBtn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('more-request', { bubbles: true, composed: true }));
        });
      }

      attributeChangedCallback(name) {
        if (name === 'theme') this._syncTheme();
      }

      _syncTheme() {
        const themeBtn = this.shadowRoot?.querySelector('.theme');
        if (!themeBtn) return;
        const isDark = this.getAttribute('theme') === 'dark';
        themeBtn.setAttribute('aria-pressed', String(isDark));
        themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        const iconWrap = themeBtn.querySelector('.icon');
        if (iconWrap) {
          iconWrap.innerHTML = isDark ? lucide.sun : lucide.moon;
        }
      }
    }

    class VisCueViewSwitcher extends HTMLElement {
      static get observedAttributes() { return ['value', 'count', 'grid-active', 'components-active']; }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: inline-block; }
            .switcher {
              height: 40px;
              padding: 4px;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 14px;
              background: var(--viscue-control-soft, #F8F6F3);
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
            }
            button {
              position: relative;
              width: 32px;
              height: 32px;
              display: grid;
              place-items: center;
              border-radius: 10px;
              background: transparent;
              color: var(--viscue-ink, #1B1A18);
              transition: background-color 120ms ease, transform 110ms ease, box-shadow 120ms ease;
            }
            button[aria-pressed="true"] {
              background: var(--viscue-paper, #FFFFFF);
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
            }
            .icon { width: 18px; height: 18px; transition: transform 140ms ease; }
            .count {
              position: absolute;
              top: -3px;
              right: -3px;
              min-width: 17px;
              height: 17px;
              padding: 0 4px;
              display: grid;
              place-items: center;
              border: 2px solid var(--viscue-control-soft, #F8F6F3);
              border-radius: 99px;
              background: var(--viscue-signal, #5B7593);
              color: #FFFFFF;
              font-size: 10px;
              line-height: 1;
              font-weight: 700;
              font-variant-numeric: tabular-nums;
            }
            @media (hover:hover) {
              button:hover { background: rgba(255,255,255,.72); }
              button[aria-pressed="true"]:hover { transform: translateY(-1px); }
              button[aria-pressed="true"]:hover .icon { transform: translateY(-1px); }
            }
            button:active { transform: translateY(1px) scale(.985); transition-duration: 90ms; }
            @media (prefers-reduced-motion: reduce) {
              button, .icon { transition: none; }
              button:hover, button:active, button:hover .icon { transform: none; }
            }
          </style>
          <div class="switcher" role="group" aria-label="View mode">
            <button data-value="grid" type="button" aria-label="Grid view" aria-pressed="true">
              <span class="icon">${lucide.grid}</span>
            </button>
            <button data-value="components" type="button" aria-label="Canvas contents, 0 items" aria-pressed="false">
              <span class="icon">${lucide.database}</span>
              <span class="count" aria-hidden="true">0</span>
            </button>
          </div>
        `;
      }

      connectedCallback() {
        this._sync();
        this.shadowRoot.querySelectorAll('button[data-value]').forEach(button => {
          button.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('view-change', {
              bubbles: true,
              composed: true,
              detail: { value: button.dataset.value }
            }));
          });
        });
      }

      attributeChangedCallback() { this._sync(); }

      get value() { return this.getAttribute('value') || 'grid'; }
      set value(next) { this.setAttribute('value', next); }

      _sync() {
        if (!this.shadowRoot) return;
        this.shadowRoot.querySelectorAll('button[data-value]').forEach(button => {
          const active = button.dataset.value === 'grid'
            ? this.hasAttribute('grid-active')
            : this.hasAttribute('components-active');
          button.setAttribute('aria-pressed', String(active));
        });
        const count = Math.max(0, Number(this.getAttribute('count')) || 0);
        const contentsButton = this.shadowRoot.querySelector('[data-value="components"]');
        const badge = contentsButton?.querySelector('.count');
        if (badge) badge.textContent = count > 99 ? '99+' : String(count);
        contentsButton?.setAttribute('aria-label', `Canvas contents, ${count} ${count === 1 ? 'item' : 'items'}`);
      }
    }

    class VisCueCloseButton extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: inline-block; }
            button {
              width: 40px;
              height: 40px;
              display: grid;
              place-items: center;
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 12px;
              background: var(--viscue-control-soft, #F8F6F3);
              color: var(--viscue-ink, #1B1A18);
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
              transition: transform 110ms ease, background-color 110ms ease, box-shadow 120ms ease;
            }
            .icon { width: 20px; height: 20px; transition: transform 135ms ease; }
            @media (hover:hover) {
              button:hover { background: var(--viscue-paper, #FFFFFF); transform: translateY(-1px); }
              button:hover .icon { transform: scale(1.035); }
            }
            button:active { transform: translateY(1px) scale(.98); transition-duration: 90ms; }
            @media (prefers-reduced-motion: reduce) {
              button, .icon { transition: none; }
              button:hover, button:active, button:hover .icon { transform: none; }
            }
          </style>
          <button type="button" aria-label="Close" part="button">
            <span class="icon">${lucide.x}</span>
          </button>
        `;
      }

      connectedCallback() {
        this.shadowRoot.querySelector('button').addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        });
      }
    }

    class VisCuePlatformPill extends HTMLElement {
      static get observedAttributes() { return ['platform', 'selected']; }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: inline-block; }
            button {
              min-width: 148px;
              height: 52px;
              padding: 0 20px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #E5E2DD;
              border-radius: 16px;
              background: #FFFFFF;
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
              color: #1B1A18;
              font-size: 20px;
              line-height: 28px;
              font-weight: 600;
              letter-spacing: -0.015em;
              transition: transform 130ms cubic-bezier(.2,.8,.2,1), box-shadow 130ms ease, background-color 120ms ease;
            }
            :host([selected]) button { color: var(--viscue-signal, #5B7593); }
            .label { transition: transform 150ms cubic-bezier(.2,.8,.2,1); }
            @media (hover:hover) {
              button:hover {
                transform: translateY(-1px);
                box-shadow: 0 8px 18px rgba(27,26,24,.06);
              }
              button:hover .label { transform: translateY(-1px); }
            }
            button:active { transform: translateY(0) scale(.985); transition-duration: 90ms; }
            @media (prefers-reduced-motion: reduce) {
              button, .label { transition: none; }
              button:hover, button:active, button:hover .label { transform: none; }
            }
          </style>
          <button type="button" aria-pressed="false" part="button"><span class="label"></span></button>
        `;
      }

      connectedCallback() {
        this._sync();
        this.shadowRoot.querySelector('button').addEventListener('click', () => {
          const selected = !this.hasAttribute('selected');
          this.toggleAttribute('selected', selected);
          this._sync();
          this.dispatchEvent(new CustomEvent('platform-change', {
            bubbles: true,
            composed: true,
            detail: { platform: this.platform, selected }
          }));
        });
      }

      attributeChangedCallback() { this._sync(); }

      get platform() { return this.getAttribute('platform') || 'ChatGPT'; }
      set platform(value) { this.setAttribute('platform', value); }

      _sync() {
        if (!this.shadowRoot) return;
        this.shadowRoot.querySelector('.label').textContent = this.platform;
        this.shadowRoot.querySelector('button').setAttribute('aria-pressed', String(this.hasAttribute('selected')));
      }
    }

    class VisCueHistoryPanel extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = `
          <style>
            ${baseComponentStyles}
            :host {
              display: block;
              width: min(540px, 94vw);
              font-family: "Instrument Sans", "Inter", -apple-system, system-ui, sans-serif;
              font-synthesis: none;
              color: var(--viscue-ink, #1B1A18);
            }

            * { box-sizing: border-box; }

            .panel {
              position: relative;
              width: 100%;
              max-height: min(580px, 85vh);
              display: flex;
              flex-direction: column;
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 20px;
              background: var(--viscue-paper, #FFFFFF);
              box-shadow: var(--viscue-shadow-soft, 0 16px 48px rgba(0,0,0,.15));
              overflow: hidden;
            }

            .panel-header {
              padding: 20px 24px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid var(--viscue-hairline, #E5E2DD);
              background: var(--viscue-paper, #FFFFFF);
            }

            .header-info {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .header-icon {
              width: 36px;
              height: 36px;
              border-radius: 10px;
              display: grid;
              place-items: center;
              background: var(--viscue-control-soft, #F8F6F3);
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              color: var(--viscue-signal, #5B7593);
            }

            .header-icon svg {
              width: 18px;
              height: 18px;
            }

            .title-group {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .title {
              margin: 0;
              font-size: 17px;
              line-height: 22px;
              font-weight: 600;
              letter-spacing: -0.01em;
              color: var(--viscue-ink, #1B1A18);
            }

            .subtitle {
              margin: 0;
              font-size: 12px;
              line-height: 16px;
              color: var(--viscue-muted, #7A7670);
            }

            .close-btn {
              width: 32px;
              height: 32px;
              display: grid;
              place-items: center;
              padding: 0;
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 10px;
              background: var(--viscue-control-soft, #F8F6F3);
              color: var(--viscue-ink, #1B1A18);
              cursor: pointer;
              transition: background-color 120ms ease, color 120ms ease;
            }

            .close-btn:hover {
              background: var(--viscue-paper, #FFFFFF);
            }

            .close-btn svg {
              width: 16px;
              height: 16px;
            }

            .history-body {
              flex: 1;
              min-height: 0;
              padding: 16px 20px;
              overflow-y: auto;
              overscroll-behavior: contain;
              scrollbar-width: none;
            }
            .history-body::-webkit-scrollbar {
              display: none;
            }

            .empty-state {
              padding: 44px 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              gap: 8px;
            }

            .empty-icon {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              display: grid;
              place-items: center;
              background: var(--viscue-control-soft, #F8F6F3);
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              color: var(--viscue-muted, #7A7670);
              margin-bottom: 6px;
            }

            .empty-icon svg {
              width: 24px;
              height: 24px;
            }

            .empty-state .message {
              margin: 0;
              color: var(--viscue-ink, #1B1A18);
              font-size: 16px;
              font-weight: 600;
            }

            .empty-state .helper {
              margin: 0;
              color: var(--viscue-muted, #7A7670);
              font-size: 13px;
              line-height: 18px;
              max-width: 320px;
            }

            .empty-action {
              margin-top: 16px;
              height: 38px;
              padding: 0 18px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border-radius: 10px;
              background: var(--viscue-control-soft, #F8F6F3);
              color: var(--viscue-ink, #1B1A18);
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: background-color 120ms ease, transform 120ms ease;
            }

            .empty-action:hover {
              background: var(--viscue-paper, #FFFFFF);
              transform: translateY(-1px);
            }

            .history-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }

            .history-card {
              background: var(--viscue-control-soft, #F8F6F3);
              border: 1px solid var(--viscue-hairline, #E5E2DD);
              border-radius: 14px;
              padding: 14px 18px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
            }

            .history-card:hover {
              border-color: var(--viscue-signal, #5B7593);
              transform: translateY(-1px);
              box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
            }

            .history-card-meta {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .history-card-date {
              color: var(--viscue-ink, #FFFFFF);
              font-size: 13.5px;
              font-weight: 600;
              line-height: 18px;
            }

            .history-card-stats {
              display: flex;
              align-items: center;
              gap: 8px;
              color: var(--viscue-muted, #A59CC8);
              font-size: 12px;
              line-height: 16px;
            }

            .history-card-stats span {
              display: inline-flex;
              align-items: center;
              gap: 4px;
            }

            .restore-action {
              height: 34px;
              padding: 0 16px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 9px;
              border: 0;
              background: var(--viscue-signal, #5B7593);
              color: #FFFFFF;
              font-size: 12.5px;
              font-weight: 700;
              cursor: pointer;
              transition: background-color 120ms ease, transform 100ms ease;
            }

            .restore-action:hover {
              background: var(--steel-600, #4A6380);
              transform: translateY(-1px);
            }

            .restore-action:active {
              transform: translateY(0) scale(0.98);
            }

            .panel-footer {
              padding: 12px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-top: 1px solid var(--viscue-hairline, #E5E2DD);
              background: var(--viscue-paper, #FFFFFF);
              font-size: 12px;
              color: var(--viscue-muted, #7A7670);
            }
          </style>

          <section class="panel" aria-labelledby="history-title">
            <header class="panel-header">
              <div class="header-info">
                <div class="header-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                </div>
                <div class="title-group">
                  <h2 class="title" id="history-title">Workspace History</h2>
                  <p class="subtitle">Restore previous canvas checkpoints</p>
                </div>
              </div>

              <button class="close-btn" type="button" aria-label="Close history">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </header>

            <div class="history-body"></div>
          </section>
        `;
      }

      connectedCallback() {
        if (!this._attached) {
          this._attached = true;
          this.shadowRoot.querySelector('.close-btn').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('history-close', { bubbles: true, composed: true }));
          });
          this.renderHistory();
        }
      }

      set historyItems(items) {
        this._historyItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items || '[]') : []);
        if (this._attached) this.renderHistory();
      }

      get historyItems() {
        return this._historyItems || [];
      }

      renderHistory() {
        const body = this.shadowRoot.querySelector('.history-body');
        if (!body) return;
        
        if (!this._historyItems || this._historyItems.length === 0) {
          body.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
              </div>
              <p class="message">No history snapshots recorded yet</p>
              <p class="helper">Snapshots are created automatically when you add references, text, or modify the canvas.</p>
              <button class="empty-action" type="button">
                <span>Return to canvas</span>
              </button>
            </div>
          `;
          const emptyBtn = body.querySelector('.empty-action');
          if (emptyBtn) {
            emptyBtn.addEventListener('click', () => {
              this.dispatchEvent(new CustomEvent('history-close', { bubbles: true, composed: true }));
            });
          }
          return;
        }

        const listHtml = [...this._historyItems].reverse().map((item, index) => {
          const date = new Date(item.timestamp || Date.now());
          const dateString = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const nodes = item.nodes ? item.nodes.length : 0;
          const edges = item.edges ? item.edges.length : 0;
          const originalIndex = (this._historyItems.length - 1) - index;
          return `
            <div class="history-card">
              <div class="history-card-meta">
                <div class="history-card-date">${dateString}</div>
                <div class="history-card-stats">
                  <span>${nodes} ${nodes === 1 ? 'item' : 'items'}</span>
                  <span>•</span>
                  <span>${edges} ${edges === 1 ? 'connection' : 'connections'}</span>
                </div>
              </div>
              <button class="restore-action" type="button" data-index="${originalIndex}">Restore</button>
            </div>
          `;
        }).join('');

        body.innerHTML = `<div class="history-list">${listHtml}</div>`;

        body.querySelectorAll('.restore-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            const snapshot = this._historyItems[idx];
            if (snapshot) {
              this.dispatchEvent(new CustomEvent('history-restore', { bubbles: true, composed: true, detail: snapshot }));
            }
          });
        });
      }
    }

    class VisCueButtonLibrary extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: block; width: min(100%, 760px); }
            .section { display: grid; gap: 20px; }
            .heading { display: grid; gap: 4px; }
            h2 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; }
            .hint { margin: 0; color: #5C5853; font-size: 14px; line-height: 20px; font-weight: 500; }
            .surface {
              padding: 24px;
              display: grid;
              gap: 20px;
              border: 1px solid #E5E2DD;
              border-radius: 16px;
              background: #FFFFFF;
              box-shadow: 0 8px 24px rgba(27,26,24,.045);
            }
            .row { display: flex; flex-wrap: wrap;  gap: 12px; }
            .label { width: 100%; color: #5C5853; font-size: 12px; line-height: 16px; font-weight: 500; }
            .btn {
              --move: -1px;
              height: 40px;
              padding: 0 18px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border-radius: 12px;
              border: 1px solid transparent;
              font-size: 14px;
              line-height: 20px;
              font-weight: 500;
              white-space: nowrap;
              transition: transform 120ms cubic-bezier(.2,.7,.2,1), box-shadow 120ms ease, background-color 110ms ease, border-color 110ms ease, color 110ms ease;
            }
            .btn .icon { width: 18px; height: 18px; flex: 0 0 18px; transition: transform 145ms cubic-bezier(.2,.7,.2,1); }
            .btn--sm { height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; }
            .btn--lg { height: 48px; padding: 0 20px; border-radius: 12px; font-size: 15px; }
            .primary { --move: -1px; background: var(--viscue-signal, #5B7593); color: #FFFFFF; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
            .dark { --move: -1px; background: var(--viscue-ink, #1B1A18); color: var(--viscue-paper, #FFFFFF); box-shadow: 0 2px 8px rgba(27,26,24,.05); }
            .secondary { background: var(--viscue-paper, #FFFFFF); color: var(--viscue-ink, #1B1A18); border-color: var(--viscue-hairline, #E5E2DD); box-shadow: 0 2px 8px rgba(27,26,24,.04); }
            .soft { background: var(--viscue-control-soft, #F8F6F3); color: var(--viscue-ink, #1B1A18); border-color: var(--viscue-hairline, #E5E2DD); }
            .ghost { background: transparent; color: var(--viscue-ink, #1B1A18); }
            .outline { background: var(--viscue-paper, #FFFFFF); color: var(--viscue-ink, #1B1A18); border-color: var(--viscue-ink, #1B1A18); }
            .disabled, .btn:disabled, .btn[aria-disabled="true"] { opacity: .42; cursor: not-allowed; transform: none !important; box-shadow: none; }
            .selected { background: var(--viscue-ink, #1B1A18); color: var(--viscue-paper, #FFFFFF); box-shadow: 0 2px 8px rgba(27,26,24,.06); }
            .loading { position: relative; cursor: progress; }
            .loading::before {
              content: ""; width: 16px; height: 16px; flex: 0 0 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
            }
            @media (prefers-reduced-motion: no-preference) { .loading::before { animation: vc-spin 700ms linear infinite; } }
            @keyframes vc-spin { to { transform: rotate(360deg); } }
            .icon-btn {
              width: 40px; height: 40px; padding: 0; border-radius: 12px;
              background: var(--viscue-paper, #FFFFFF); border: 1px solid var(--viscue-hairline, #E5E2DD); color: var(--viscue-ink, #1B1A18);
              box-shadow: 0 2px 8px rgba(27,26,24,.04);
            }
            .icon-btn.sm { width: 36px; height: 36px; }
            .icon-btn.lg { width: 48px; height: 48px; border-radius: 12px; }
            .split { display: inline-flex;  }
            .split .btn:first-child { border-radius: 12px 0 0 12px; }
            .split .btn:last-child { width: 40px; padding: 0; border-left: 1px solid rgba(17,17,15,.16); border-radius: 0 12px 12px 0; }
            .split .btn:last-child .icon { width: 16px; height: 16px; }
            @media (hover:hover) and (pointer:fine) {
              .btn:not(.disabled):hover { transform: translateY(var(--move)); }
              .primary:hover { background: var(--steel-600, #4A6380); box-shadow: 0 4px 12px rgba(27,44,62,.12); }
              .dark:hover { background: #11110F; box-shadow: 0 4px 12px rgba(27,26,24,.07); }
              .secondary:hover, .icon-btn:hover { background: #F8F6F3; box-shadow: 0 4px 12px rgba(27,26,24,.06); }
              .soft:hover { background: #E5E2DD; }
              .ghost:hover { background: #F8F6F3; }
              .btn:not(.disabled):hover .icon { transform: translateY(-.5px); }
            }
            .btn:not(.disabled):active { transform: translateY(0) scale(.985); transition-duration: 90ms; }
            @media (prefers-reduced-motion: reduce) { .btn, .btn .icon { transition: none; } .btn:hover, .btn:active, .btn:hover .icon { transform: none !important; } }
          </style>
          <section class="section" aria-labelledby="button-library-title">
            <div class="heading">
              <h2 id="button-library-title">Button system</h2>
              <p class="hint">Production sizes: 36px compact, 40px standard, 48px prominent CTA.</p>
            </div>
            <div class="surface">
              <div class="row">
                <div class="label">Core actions</div>
                <button class="btn btn--lg dark" type="button"><span class="icon">${lucide.plus}</span>Create</button>
                <button class="btn btn--lg primary" type="button">Run Cue</button>
                <button class="btn secondary" type="button"><span class="icon">${lucide.upload}</span>Upload</button>
                <button class="btn soft" type="button">Preview</button>
                <button class="btn ghost" type="button">Cancel</button>
              </div>
              <div class="row">
                <div class="label">Common tool actions</div>
                <button class="btn btn--sm secondary" type="button"><span class="icon">${lucide.save}</span>Save</button>
                <button class="btn btn--sm secondary" type="button"><span class="icon">${lucide.share2}</span>Share</button>
                <button class="btn btn--sm secondary" type="button"><span class="icon">${lucide.copy}</span>Copy</button>
                <button class="btn btn--sm outline" type="button"><span class="icon">${lucide.download}</span>Export</button>
                <span class="split" role="group" aria-label="Export options">
                  <button class="btn primary" type="button">Export</button><button class="btn primary" type="button" aria-label="Open export menu"><span class="icon">${lucide.chevronDown}</span></button>
                </span>
              </div>
              <div class="row">
                <div class="label">Icon buttons</div>
                <button class="btn icon-btn sm" type="button" aria-label="Search"><span class="icon">${lucide.search}</span></button>
                <button class="btn icon-btn" type="button" aria-label="Settings"><span class="icon">${lucide.settings2}</span></button>
                <button class="btn icon-btn" type="button" aria-label="Adjust"><span class="icon">${lucide.slidersHorizontal}</span></button>
                <button class="btn icon-btn lg" type="button" aria-label="Download"><span class="icon">${lucide.download}</span></button>
                <button class="btn btn--sm soft disabled" type="button" disabled>Disabled</button>
              </div>
              <div class="row">
                <div class="label">State completeness</div>
                <button class="btn selected" type="button" aria-pressed="true">Selected</button>
                <button class="btn secondary loading" type="button" aria-busy="true" aria-live="polite">Processing</button>
                <button class="btn secondary" type="button" aria-disabled="true">Unavailable</button>
              </div>
            </div>
          </section>`;
      }
      connectedCallback() {
        if (this._wired) return;
        this._wired = true;
        this.shadowRoot.querySelectorAll('[aria-disabled="true"]').forEach(btn => {
          btn.addEventListener('click', event => event.preventDefault());
        });
      }
    }

class VisCueSubbarLibrary extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: block; width: min(100%, 760px); }
            .section { display: grid; gap: 20px; }
            .heading { display: grid; gap: 4px; }
            h2 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; }
            .hint { margin: 0; color: #5C5853; font-size: 14px; line-height: 20px; font-weight: 500; }
            .samples { display: grid; gap: 16px; }
            .subbar {
              width: fit-content; max-width: 100%; min-height: 52px; padding: 6px;
              display: flex; flex-wrap: wrap;  gap: 4px;
              border: 1px solid #E5E2DD; border-radius: 16px; background: #FFFFFF;
              box-shadow: 0 8px 24px rgba(27,26,24,.05);
            }
            .subbar.soft { background: #F8F6F3; }
            .group { display: inline-flex;  gap: 4px; }
            .divider { width: 1px; height: 28px; margin: 0 4px; background: #E5E2DD; }
            button {
              min-width: 40px; height: 40px; padding: 0 12px; border-radius: 12px;
              display: inline-flex;  justify-content: center; gap: 8px;
              background: transparent; color: #1B1A18; font-size: 14px; line-height: 20px; font-weight: 500;
              transition: transform 110ms cubic-bezier(.2,.7,.2,1), background-color 110ms ease, box-shadow 120ms ease;
            }
            button .icon { width: 18px; height: 18px; flex: 0 0 18px; transition: transform 130ms cubic-bezier(.2,.7,.2,1); }
            button[aria-pressed="true"], button.is-active { background: #FFFFFF; box-shadow: 0 2px 8px rgba(27,26,24,.04); }
            .danger .icon { color: #D92D20; }
            .segment { padding: 0 16px; }
            @media (hover:hover) and (pointer:fine) {
              button:hover { background: rgba(248,246,243,.9); transform: translateY(-1px); }
              button[aria-pressed="true"]:hover, button.is-active:hover { background: #FFFFFF; }
              button:hover .icon { transform: translateY(-.5px); }
            }
            button:active { transform: translateY(0) scale(.98); transition-duration: 90ms; }
            @media (max-width: 620px) { .subbar { width: 100%; } .divider { display: none; } }
            @media (prefers-reduced-motion: reduce) { button, button .icon { transition: none; } button:hover, button:active, button:hover .icon { transform: none; } }
          </style>
          <section class="section" aria-labelledby="subbar-library-title">
            <div class="heading"><h2 id="subbar-library-title">Sub bars</h2><p class="hint">Reusable context controls for selection, text, insert, and filtering.</p></div>
            <div class="samples">
              <div class="subbar" role="toolbar" aria-label="Selection actions">
                <button type="button"><span class="icon">${lucide.copy}</span>Duplicate</button>
                <button type="button"><span class="icon">${lucide.lock}</span>Lock</button>
                <button type="button"><span class="icon">${lucide.eyeOff}</span>Hide</button>
                <span class="divider" aria-hidden="true"></span>
                <button class="danger" type="button"><span class="icon">${lucide.trash2}</span>Delete</button>
              </div>
              <div class="subbar soft" role="toolbar" aria-label="Text formatting">
                <div class="group" data-toggle-group>
                  <button type="button" aria-label="Bold" aria-pressed="true"><span class="icon">${lucide.bold}</span></button>
                  <button type="button" aria-label="Italic" aria-pressed="false"><span class="icon">${lucide.italic}</span></button>
                  <button type="button" aria-label="Underline" aria-pressed="false"><span class="icon">${lucide.underline}</span></button>
                </div>
                <span class="divider" aria-hidden="true"></span>
                <div class="group" data-exclusive-group>
                  <button type="button" aria-label="Align left" aria-pressed="true"><span class="icon">${lucide.alignLeft}</span></button>
                  <button type="button" aria-label="Align center" aria-pressed="false"><span class="icon">${lucide.alignCenter}</span></button>
                </div>
              </div>
              <div class="subbar" role="toolbar" aria-label="Insert content">
                <button type="button"><span class="icon">${lucide.image}</span>Image</button>
                <button type="button"><span class="icon">${lucide.stickyNote}</span>S-Note</button>
                <button type="button"><span class="icon">${lucide.link2}</span>Link</button>
                <button type="button"><span class="icon">${lucide.globe2}</span>Web</button>
              </div>
              <div class="subbar soft" role="group" aria-label="Filter content" data-exclusive-group>
                <button class="segment" type="button" aria-pressed="true">All</button>
                <button class="segment" type="button" aria-pressed="false">Images</button>
                <button class="segment" type="button" aria-pressed="false">Docs</button>
                <button class="segment" type="button" aria-pressed="false">Web</button>
              </div>
            </div>
          </section>`;
      }
      connectedCallback() {
        if (this._wired) return; this._wired = true;
        this.shadowRoot.querySelectorAll('[data-toggle-group] button').forEach(btn => btn.addEventListener('click', () => btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true'))));
        this.shadowRoot.querySelectorAll('[data-exclusive-group]').forEach(group => group.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => group.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === btn))))));
      }
    }

    class VisCueCardLibrary extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            ${baseComponentStyles}
            :host { display: block; width: min(100%, 760px); }
            .section { display: grid; gap: 20px; }
            .heading { display: grid; gap: 4px; }
            h2 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; }
            .hint { margin: 0; color: #5C5853; font-size: 14px; line-height: 20px; font-weight: 500; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
            .card { padding: 24px; border: 1px solid #E5E2DD; border-radius: 16px; background: #FFFFFF; box-shadow: 0 8px 24px rgba(27,26,24,.045); }
            .popup { max-width: 320px; }
            .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
            .title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 600; letter-spacing: -.01em; }
            .copy { margin: 4px 0 0; color: #5C5853; font-size: 14px; line-height: 20px; font-weight: 400; }
            .icon-button { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: #F8F6F3; color: #1B1A18; }
            .icon-button .icon { width: 18px; height: 18px; }
            .menu { display: grid; gap: 4px; }
            .menu button { width: 100%; min-height: 40px; padding: 0 12px; display: flex;  gap: 10px; border-radius: 10px; background: transparent; text-align: left; font-size: 14px; line-height: 20px; font-weight: 500; transition: background-color 110ms ease, transform 110ms cubic-bezier(.2,.7,.2,1); }
            .menu .icon { width: 18px; height: 18px; flex: 0 0 18px; }
            .setting-list { display: grid; gap: 4px; }
            .setting-row { min-height: 52px; display: flex;  justify-content: space-between; gap: 16px; border-bottom: 1px solid #E5E2DD; }
            .setting-row:last-child { border-bottom: 0; }
            .setting-text { min-width: 0; }
            .setting-name { font-size: 14px; line-height: 20px; font-weight: 500; }
            .setting-help { color: #5C5853; font-size: 12px; line-height: 16px; font-weight: 500; }
            .switch { position: relative; width: 44px; height: 28px; flex: 0 0 44px; border-radius: 20px; background: #E5E2DD; transition: background-color 120ms ease; }
            .switch::after { content: ''; position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(27,26,24,.08); transition: transform 140ms cubic-bezier(.2,.7,.2,1); }
            .switch[aria-pressed="true"] { background: #1B1A18; }
            .switch[aria-pressed="true"]::after { transform: translateX(16px); }
            .selection-preview { padding: 16px; display: flex;  gap: 12px; border-radius: 16px; background: #F8F6F3; margin-bottom: 16px; }
            .thumb { width: 48px; height: 48px; display: grid; place-items: center; flex: 0 0 48px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E5E2DD; }
            .thumb .icon { width: 22px; height: 22px; }
            .meta { min-width: 0; }
            .meta strong { display: block; font-size: 14px; line-height: 20px; font-weight: 600; }
            .meta span { display: block; color: #5C5853; font-size: 12px; line-height: 16px; font-weight: 500; }
            .actions { display: flex; flex-wrap: wrap; gap: 8px; }
            .actions button { height: 40px; padding: 0 16px; display: inline-flex;  gap: 8px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E5E2DD; font-size: 14px; line-height: 20px; font-weight: 500; }
            .actions button.primary { background: var(--viscue-signal, #5B7593); color: #FFFFFF; border-color: var(--viscue-signal, #5B7593); font-weight: 700; }
            .actions .icon { width: 18px; height: 18px; }
            @media (hover:hover) and (pointer:fine) {
              .menu button:hover { background: #F8F6F3; transform: translateY(-1px); }
              .icon-button:hover, .actions button:hover { transform: translateY(-1px); }
              .actions .primary:hover { transform: translateY(-1px); background: #4A6380; }
            }
            .menu button:active, .icon-button:active, .actions button:active { transform: translateY(0) scale(.985); }
            @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } .popup { max-width: none; } }
            @media (prefers-reduced-motion: reduce) { .menu button, .switch, .switch::after { transition: none; } .menu button:hover, .menu button:active, .icon-button:hover, .icon-button:active, .actions button:hover, .actions button:active { transform: none; } }
          </style>
          <section class="section" aria-labelledby="card-library-title">
            <div class="heading"><h2 id="card-library-title">Cards & small panels</h2><p class="hint">Purpose-based surfaces: 280–320px popups and 320–400px settings/inspector cards.</p></div>
            <div class="grid">
              <article class="card popup">
                <div class="card-head"><div><h3 class="title">Quick actions</h3><p class="copy">Common insert actions.</p></div><button class="icon-button" type="button" aria-label="More quick actions"><span class="icon">${lucide.plus}</span></button></div>
                <div class="menu">
                  <button type="button"><span class="icon">${lucide.image}</span>Add image</button>
                  <button type="button"><span class="icon">${lucide.stickyNote}</span>Add S-Note</button>
                  <button type="button"><span class="icon">${lucide.link2}</span>Paste link</button>
                  <button type="button"><span class="icon">${lucide.fileText}</span>Add document</button>
                </div>
              </article>
              <article class="card">
                <div class="card-head"><div><h3 class="title">Canvas</h3><p class="copy">Quiet defaults for precise work.</p></div><button class="icon-button" type="button" aria-label="Canvas settings"><span class="icon">${lucide.settings2}</span></button></div>
                <div class="setting-list">
                  <div class="setting-row"><div class="setting-text"><div class="setting-name">Snap to guides</div><div class="setting-help">Align nearby objects</div></div><button class="switch" type="button" role="switch" aria-checked="true" aria-pressed="true" aria-label="Snap to guides"></button></div>
                  <div class="setting-row"><div class="setting-text"><div class="setting-name">Show grid</div><div class="setting-help">4px base grid overlay</div></div><button class="switch" type="button" role="switch" aria-checked="false" aria-pressed="false" aria-label="Show grid"></button></div>
                  <div class="setting-row"><div class="setting-text"><div class="setting-name">Show labels</div><div class="setting-help">Keep helper labels visible</div></div><button class="switch" type="button" role="switch" aria-checked="true" aria-pressed="true" aria-label="Show labels"></button></div>
                </div>
              </article>
              <article class="card">
                <div class="card-head"><div><h3 class="title">Selection</h3><p class="copy">Compact object inspector.</p></div><button class="icon-button" type="button" aria-label="Selection settings"><span class="icon">${lucide.slidersHorizontal}</span></button></div>
                <div class="selection-preview"><div class="thumb"><span class="icon">${lucide.image}</span></div><div class="meta"><strong>Reference image</strong><span>1280 × 720 · selected</span></div></div>
                <div class="actions"><button type="button"><span class="icon">${lucide.copy}</span>Duplicate</button><button type="button"><span class="icon">${lucide.lock}</span>Lock</button><button class="primary" type="button"><span class="icon">${lucide.check}</span>Done</button></div>
              </article>
              <article class="card">
                <div class="card-head"><div><h3 class="title">Export</h3><p class="copy">A focused completion panel.</p></div><button class="icon-button" type="button" aria-label="Reset export"><span class="icon">${lucide.rotateCcw}</span></button></div>
                <div class="selection-preview"><div class="thumb"><span class="icon">${lucide.download}</span></div><div class="meta"><strong>PNG · 2×</strong><span>Transparent background off</span></div></div>
                <div class="actions"><button type="button"><span class="icon">${lucide.share2}</span>Share</button><button class="primary" type="button"><span class="icon">${lucide.download}</span>Export</button></div>
              </article>
            </div>
          </section>`;
      }
      connectedCallback() {
        if (this._wired) return; this._wired = true;
        this.shadowRoot.querySelectorAll('.switch').forEach(sw => sw.addEventListener('click', () => {
          const next = sw.getAttribute('aria-pressed') !== 'true';
          sw.setAttribute('aria-pressed', String(next));
          sw.setAttribute('aria-checked', String(next));
        }));
      }
    }

    customElements.define('viscue-reference-empty', VisCueReferenceEmpty);
    customElements.define('viscue-utility-menu', VisCueUtilityMenu);
    customElements.define('viscue-view-switcher', VisCueViewSwitcher);
    customElements.define('viscue-close-button', VisCueCloseButton);
    customElements.define('viscue-platform-pill', VisCuePlatformPill);
    customElements.define('viscue-history-panel', VisCueHistoryPanel);
    customElements.define('viscue-button-library', VisCueButtonLibrary);
    customElements.define('viscue-subbar-library', VisCueSubbarLibrary);
    customElements.define('viscue-card-library', VisCueCardLibrary);
  

class CenterFloatingBar extends HTMLElement {
  static get observedAttributes() { return ['active']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host {
          --cfb-width: 480px;
          --context-bg: var(--viscue-paper, #182838);
          --cfb-shadow: 0 12px 36px rgba(0,0,0,.45);
          --cfb-panel-shadow: 0 -8px 32px rgba(0,0,0,.4);
          --motion-fast: 90ms;
          --motion-ui: 120ms;
          --motion-dominant: 150ms;
          --motion-panel: 200ms;
          --ease-quiet: cubic-bezier(.2,.7,.2,1);
          --toolbar-rail: var(--viscue-toolbar-rail, #20364D);
          display: block;
          width: min(var(--cfb-width), 100%);
          height: var(--cfb-render-height, 76px);
          overflow: visible;
          background: transparent;
          font-family: "Instrument Sans", "Inter", "Noto Sans", system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
          font-synthesis: none;
        }

        * { box-sizing: border-box; }
        :host::-webkit-scrollbar { display: none; }
        .viewport {
          position: relative;
          width: var(--cfb-visual-width, 480px);
          min-width: var(--cfb-visual-width, 480px);
          height: var(--cfb-render-height, 76px);
          overflow: visible;
          background: transparent;
        }

        button {
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          margin: 0;
          padding: 0;
          font: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          text-decoration: none;
        }

        .scale {
          position: relative;
          width: 480px;
          height: var(--cfb-stage-height, 76px);
          transform-origin: top left;
          transform: scale(var(--cfb-scale, 1));
          overflow: visible;
          background: transparent;
        }

        .context-panel {
          position: absolute;
          z-index: 1;
          left: 0;
          width: 480px;
          top: 0;
          bottom: 40px;
          overflow: hidden;
          border: 1px solid var(--viscue-hairline, #2D4358);
          border-radius: 26px;
          background: var(--context-bg, #182838);
          box-shadow: var(--cfb-panel-shadow);
          opacity: 0;
          visibility: hidden;
          transform: translateY(28px);
          transform-origin: bottom center;
          pointer-events: none;
        }

        .context-panel[data-visible="true"] {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }

        .asset-panel { padding: 16px 24px 52px; }
        .text-panel { padding: 16px 28px 52px; }
        .annotate-panel { padding: 16px 24px 52px; }

        .panel-collapse {
          position: absolute;
          top: 14px;
          right: 18px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--viscue-control-soft, #22364A);
          color: var(--viscue-ink, #FFFFFF);
          outline: none;
        }
        .panel-collapse svg { width: 16px; height: 16px; }

        .asset-options, .annotate-options, .text-options {
          display: flex;
          align-items: stretch;
          gap: 8px;
          width: 100%;
          height: 100%;
        }

        .asset-option, .annotate-option, .text-option {
          flex: 1 1 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          background: var(--viscue-control-soft, #22364A);
          color: var(--viscue-ink, #FFFFFF);
          font-size: 13px;
          font-weight: 600;
          outline: none;
          transition: transform 120ms ease, background-color 120ms ease;
        }

        .asset-option {
          flex-direction: column;
          gap: 4px;
          padding: 8px 4px;
          background: transparent;
        }
        .asset-option .tile {
          width: 44px; height: 44px;
          display: grid; place-items: center;
          border-radius: 12px;
          background: var(--viscue-control-soft, #22364A);
          border: 1px solid var(--viscue-hairline, #2D4358);
          color: var(--viscue-ink, #FFFFFF);
        }
        .asset-option .tile svg { width: 22px; height: 22px; stroke-width: 2; }
        .asset-option[data-option="capture"] .tile svg { width: 20px; height: 20px; }
        .asset-option .option-label {
          font-size: 11px; line-height: 14px; font-weight: 500;
          color: var(--viscue-muted, #A59CC8); white-space: nowrap;
        }

        .text-option, .annotate-option {
          gap: 8px; padding: 0 14px;
          background: var(--viscue-control-soft, #22364A);
          color: var(--viscue-ink, #FFFFFF);
        }
        .text-option svg { width: 18px; height: 18px; stroke-width: 2; }
        .text-option span { font-size: 13px; line-height: 16px; font-weight: 500; white-space: nowrap; }

        .annotate-option.is-selected { background: var(--viscue-signal, #5B7593) !important; color: #FFFFFF !important; }
        .annotate-option.is-selected svg { color: #FFFFFF !important; stroke: #FFFFFF !important; }
        .annotate-option svg { width: 18px; height: 18px; flex: 0 0 18px; stroke-width: 2; }
        .annotate-option[data-option="annotate"] svg { width: 20px; height: 20px; flex-basis: 20px; }
        .annotate-option span { font-size: 13px; line-height: 16px; font-weight: 500; white-space: nowrap; }

        .annotate-groups { display: flex; flex-direction: column; gap: 12px; height: 100%; }
        .annotate-section { display: flex; flex-direction: column; gap: 8px; }
        .section-label {
          font-size: 10px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: var(--viscue-muted, #A59CC8);
          margin: 0; padding: 0;
        }
        .section-divider {
          height: 1px; background: var(--viscue-hairline, #2D4358);
          margin: 0 -4px;
        }

        .shell {
          position: absolute;
          z-index: 10;
          left: 0;
          bottom: 0;
          width: 480px;
          height: 76px;
          isolation: isolate;
          filter: drop-shadow(var(--cfb-shadow));
        }

        .shape {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: visible;
          pointer-events: none;
        }

        .tool {
          --tool-icon-size: 21px;
          position: absolute;
          top: 8px;
          width: 48px;
          height: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 2px;
          color: #FFFFFF;
          background: transparent;
          border-radius: 12px;
          outline: none;
          cursor: pointer;
        }

        .tool[data-action="select"]   { left: 32px;  --tool-icon-size: 21px; }
        .tool[data-action="assets"]   { left: 86px;  --tool-icon-size: 22px; }
        .tool[data-action="annotate"] { left: 140px; --tool-icon-size: 22px; }
        .tool[data-action="text"]     { left: 194px; --tool-icon-size: 21px; }

        .tool .icon-wrap {
          position: relative;
          width: 36px; height: 36px;
          display: grid; place-items: center;
          flex: 0 0 36px;
          border-radius: 50%;
        }

        .lucide-icon, .context-panel svg {
          display: block; overflow: visible;
          color: currentColor; fill: none;
          stroke: currentColor; stroke-width: 2;
          stroke-linecap: round; stroke-linejoin: round;
          shape-rendering: geometricPrecision;
        }
        .lucide-icon path, .lucide-icon line, .lucide-icon polyline,
        .lucide-icon circle, .lucide-icon rect,
        .context-panel svg path, .context-panel svg line,
        .context-panel svg polyline, .context-panel svg circle,
        .context-panel svg rect { vector-effect: non-scaling-stroke; }

        .tool .lucide-icon { width: var(--tool-icon-size); height: var(--tool-icon-size); color: #FFFFFF; }

        .tool .label {
          display: block;
          transform: translateY(0);
          opacity: .96;
          font-size: 11px; line-height: 13px; font-weight: 600;
          color: #FFFFFF; white-space: nowrap;
          text-decoration: none !important; border-bottom: 0 !important;
        }
        .tool.is-active .label { text-decoration: none !important; border-bottom: 0 !important; padding-bottom: 0; }
        .tool.is-active .icon-wrap::before {
          content: "";
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 36px; height: 36px;
          border-radius: 50%;
          background: var(--viscue-signal, #5B7593);
          box-shadow: 0 2px 8px rgba(0,0,0,.2);
          z-index: -1;
        }
        .tool[data-action="assets"].is-active .icon-wrap::after {
          content: "";
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 44px; height: 44px;
          border-radius: 50%;
          border: 3.5px solid rgba(91, 117, 147, 0.25);
          z-index: -2;
        }
        .tool.is-active .lucide-icon { color: #FFFFFF !important; stroke: #FFFFFF !important; }

        .divider-left {
          position: absolute; z-index: 2;
          left: 252px; top: 22px;
          width: 1.5px; height: 32px;
          background: rgba(255,255,255,0.16);
          border-radius: 1px;
        }

        .history {
          position: absolute; z-index: 4;
          left: 266px; top: 18px;
          width: 92px; height: 40px;
          display: flex; align-items: center;
          justify-content: center; gap: 6px;
          background: transparent; border: none;
        }
        .history button {
          position: relative; width: 40px; height: 40px;
          display: grid; place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #FFFFFF !important;
          outline: none; cursor: pointer;
          transition: background-color 100ms ease, opacity 100ms ease, border-color 100ms ease, transform 100ms ease;
        }
        .history button:hover:not(:disabled) {
          background: rgba(91,117,147,0.15);
          border-color: rgba(91,117,147,0.35);
          transform: translateY(-1px);
        }
        .history button:disabled { opacity: 0.3; background: transparent; border-color: transparent; cursor: not-allowed; }
        .history .lucide-icon { width: 19px; height: 19px; color: #FFFFFF !important; stroke: #FFFFFF !important; stroke-width: 2.2; }

        .cue {
          position: absolute; z-index: 3;
          right: 0; top: 0;
          width: 74px; height: 76px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; color: #FFFFFF !important;
          border: none; outline: none; cursor: pointer;
        }
        .cue-label {
          position: relative; z-index: 1;
          font-size: 15px; line-height: 1; font-weight: 700;
          letter-spacing: 0.01em; color: #FFFFFF !important;
        }

        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0;
          margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
        }

        @media (hover: hover) and (pointer: fine) {
          .asset-option:hover .tile { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,.15); }
          .asset-option:hover .option-label { transform: translateY(-1px); }
          .text-option:hover { transform: translateY(-1px); background: var(--viscue-control-soft, #22364A); }
          .annotate-option:hover { transform: translateY(-1px); background: var(--viscue-control-soft, #22364A); }
          .annotate-option.is-selected:hover { background: var(--viscue-signal, #5B7593); }
          .panel-collapse:hover { transform: translateY(-1px); background: var(--viscue-control-soft, #22364A); }
          .tool:hover { background: rgba(255,255,255,.055); }
          .tool:hover .lucide-icon { transform: translateY(-1.5px); }
          .tool:hover .label { transform: translateY(-.5px); opacity: 1; }
          .tool.is-active:hover .lucide-icon { transform: translateY(-1px) scale(1.025); }
          .history button:hover .lucide-icon { transform: translateY(-.5px); opacity: .7; }
          .cue:hover .cue-label { transform: translateY(-1px) scale(1.04); }
        }

        .asset-option:active .tile, .text-option:active,
        .annotate-option:active, .panel-collapse:active { transform: translateY(0) scale(.98); }
        .tool:active { transform: translateY(1px); }
        .history button:active .lucide-icon { transform: translateY(.5px) scale(.99); opacity: .78; }
        .cue:active .cue-label { transform: translateY(1.5px) scale(0.96); }

        button:focus-visible { box-shadow: 0 0 0 2px var(--bg-canvas, #0F1822), 0 0 0 4px var(--viscue-signal, #5B7593); }
        .tool:focus-visible { box-shadow: inset 0 0 0 2px #FFFFFF, 0 0 0 3px var(--viscue-signal, #5B7593); }
        .cue:focus-visible { box-shadow: none; outline: none; }
        .cue:focus-visible .cue-label { outline: 2px solid #FFFFFF; outline-offset: 4px; border-radius: 4px; }
        .history button:focus-visible { box-shadow: inset 0 0 0 2px #FFFFFF, 0 0 0 3px var(--viscue-signal, #5B7593); }

        @media (prefers-reduced-motion: no-preference) {
          .context-panel {
            transition: opacity var(--motion-panel) var(--ease-quiet),
                        transform var(--motion-panel) var(--ease-quiet),
                        visibility 0s linear var(--motion-panel);
          }
          .context-panel[data-visible="true"] { transition-delay: 0s; }
          .asset-option .tile, .asset-option .option-label, .text-option,
          .annotate-option, .panel-collapse, .tool, .tool .lucide-icon,
          .history .lucide-icon, .cue, .cue-label {
            transition: transform 120ms cubic-bezier(.2,.8,.2,1), opacity 120ms ease;
          }
          .tool .label { transition: transform var(--motion-ui) var(--ease-quiet), opacity var(--motion-ui) var(--ease-quiet); }
        }
      </style>

      <div class="viewport">
        <div class="scale">

        <section id="cfb-assets-panel" class="context-panel asset-panel" data-panel="assets" data-visible="false" aria-hidden="true" aria-label="Asset tools">
          <button class="panel-collapse" type="button" aria-label="Collapse asset tools">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <div class="asset-options">
            <button class="asset-option" type="button" data-option="screenshot">
              <span class="tile"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/></svg></span>
              <span class="option-label">Screenshot</span>
            </button>
            <button class="asset-option" type="button" data-option="capture">
              <span class="tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/></svg></span>
              <span class="option-label">Capture</span>
            </button>
            <button class="asset-option" type="button" data-option="upload">
              <span class="tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
              <span class="option-label">Upload</span>
            </button>
            <button class="asset-option" type="button" data-option="link">
              <span class="tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
              <span class="option-label">Link</span>
            </button>
          </div>
        </section>

        <section id="cfb-annotate-panel" class="context-panel annotate-panel" data-panel="annotate" data-visible="false" aria-hidden="true" aria-label="Annotation tools">
          <button class="panel-collapse" type="button" aria-label="Collapse annotation tools">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <div class="annotate-groups">
            <div class="annotate-section">
              <h3 class="section-label">Coordinate</h3>
              <div class="annotate-options">
                <button class="annotate-option is-selected" type="button" data-option="annotate" aria-pressed="true">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5c2.1-2.1 5.2-2.1 7.3 0 1.5 1.5 1.5 3.9 0 5.4-1.8 1.8-4.8 1.8-6.6 0-1.2-1.2-1.2-3.1 0-4.3 1.4-1.4 3.7-1.4 5.1 0"/><path d="M12.5 14.5c2.6-2.6 6.4-2.5 8.7.1 2 2.3 1.8 5.9-.5 7.9-2.5 2.2-6.3 1.9-8.4-.7-1.4-1.8-1.4-4.3.2-5.9"/></svg>
                  <span>Annotate</span>
                </button>
                <button class="annotate-option" type="button" data-option="area" aria-pressed="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3H3v2"/><path d="M19 3h2v2"/><path d="M21 19v2h-2"/><path d="M5 21H3v-2"/><path d="M9 3h2"/><path d="M15 3h2"/><path d="M21 9v2"/><path d="M21 15v2"/><path d="M15 21h2"/><path d="M9 21h2"/><path d="M3 15v2"/><path d="M3 9v2"/></svg>
                  <span>Area</span>
                </button>
              </div>
            </div>
            <div class="section-divider" aria-hidden="true"></div>
            <div class="annotate-section">
              <h3 class="section-label">Canvas</h3>
              <div class="annotate-options">
                <button class="annotate-option" type="button" data-option="draw" aria-pressed="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  <span>Draw</span>
                </button>
                <button class="annotate-option" type="button" data-option="erase" aria-pressed="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 21-4-4 10-10 4 4Z"/><path d="m14 6 4-4 4 4-4 4"/><path d="M5 19h14"/></svg>
                  <span>Erase</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="cfb-text-panel" class="context-panel text-panel" data-panel="text" data-visible="false" aria-hidden="true" aria-label="Text tools">
          <button class="panel-collapse" type="button" aria-label="Collapse text tools">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <div class="text-options">
            <button class="text-option" type="button" data-option="text">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M6 15 10 5h4l4 10"/><path d="M8 11h8"/></svg>
              <span>Text</span>
            </button>
            <button class="text-option" type="button" data-option="s-note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M16 3v5h5"/></svg>
              <span>S-Note</span>
            </button>
          </div>
        </section>

        <div class="shell" role="toolbar" aria-label="Creation tools">
          <svg class="shape" viewBox="0 0 480 76" aria-hidden="true">
            <path d="M 0 76 L 0 50 A 12 12 0 0 1 12 38 L 24 38   M 456 38 L 468 38 A 12 12 0 0 1 480 50 L 480 76" fill="none" stroke="var(--viscue-signal, #5B7593)" stroke-width="3"/>
            <rect x="24" y="14" width="340" height="48" rx="24" fill="var(--bg-canvas, #182838)" stroke="var(--viscue-signal, #5B7593)" stroke-width="3"/>
            <line x1="364" y1="38" x2="382" y2="38" stroke="var(--viscue-signal, #5B7593)" stroke-width="3"/>
            <rect x="382" y="14" width="74" height="48" rx="24" fill="var(--viscue-signal, #5B7593)"/>
          </svg>

          <button class="tool" data-action="select" type="button" aria-label="Select">
            <span class="icon-wrap"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l7.07 17 2.51-7.39L21 11.07Z"/><path d="m13.58 13.6 6.42 6.42"/></svg></span>
            <span class="label">Select</span>
          </button>
          <button class="tool" data-action="assets" type="button" aria-label="Assets" aria-controls="cfb-assets-panel" aria-expanded="false">
            <span class="icon-wrap"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></span>
            <span class="label">Assets</span>
          </button>
          <button class="tool" data-action="annotate" type="button" aria-label="Annotate" aria-controls="cfb-annotate-panel" aria-expanded="false">
            <span class="icon-wrap"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18Z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></span>
            <span class="label">Annotate</span>
          </button>
          <button class="tool" data-action="text" type="button" aria-label="Text" aria-controls="cfb-text-panel" aria-expanded="false">
            <span class="icon-wrap"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg></span>
            <span class="label">Text</span>
          </button>

          <span class="divider-left" aria-hidden="true"></span>

          <div class="history" aria-label="History controls">
            <button data-action="undo" type="button" aria-label="Undo"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>
            <button data-action="redo" type="button" aria-label="Redo"><svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>
          </div>

          <button class="cue" data-action="cue" type="button" aria-label="Cue">
            <span class="cue-label">Cue</span>
          </button>
        </div>
        <span class="sr-only" aria-live="polite"></span>
      </div>
      </div>
    `;

    this._resize = () => this._syncLayout();
  }

  connectedCallback() {
    this._syncState();
    this._resize();

    if ('ResizeObserver' in window) {
      this._observer = new ResizeObserver(this._resize);
      this._observer.observe(this);
    }

    if (!this._attached) {
      this._attached = true;

      this.shadowRoot.addEventListener('click', (event) => {
        const collapse = event.target.closest('.panel-collapse');
        if (collapse) {
          this.active = '';
          this.dispatchEvent(new CustomEvent('toolbar-panel-close', { bubbles: true, composed: true }));
          return;
        }

        const option = event.target.closest('[data-option]');
        if (option) {
          if (this.active === 'annotate') {
            this.shadowRoot.querySelectorAll('.annotate-option').forEach(item => {
              item.classList.toggle('is-selected', item === option);
              item.setAttribute('aria-pressed', String(item === option));
            });
          }
          this.dispatchEvent(new CustomEvent('toolbar-option', {
            bubbles: true, composed: true,
            detail: { panel: this.active, option: option.dataset.option }
          }));
          return;
        }

        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;

        if (action === 'assets' || action === 'annotate' || action === 'text') {
          this.active = this.active === action ? '' : action;
        } else if (action === 'select') {
          this.active = '';
        }

        this.dispatchEvent(new CustomEvent('toolbar-action', {
          bubbles: true, composed: true,
          detail: { action }
        }));
      });

      this.shadowRoot.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.active) {
          const returnTo = this.shadowRoot.querySelector(`.tool[data-action="${this.active}"]`);
          this.active = '';
          this.dispatchEvent(new CustomEvent('toolbar-panel-close', { bubbles: true, composed: true }));
          returnTo?.focus();
          event.preventDefault();
          return;
        }

        const current = event.target.closest?.('.shell button[data-action]');
        if (!current) return;
        const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        const buttons = [...this.shadowRoot.querySelectorAll('.shell button[data-action]:not(:disabled)')];
        const index = buttons.indexOf(current);
        if (index < 0) return;
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        buttons[next]?.focus();
        event.preventDefault();
      });
    }
  }

  disconnectedCallback() { this._observer?.disconnect(); }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'active' && oldValue !== newValue) this._syncState();
  }

  get active() { return this.getAttribute('active') || ''; }
  set active(value) {
    if (value === 'assets' || value === 'annotate' || value === 'text') this.setAttribute('active', value);
    else this.removeAttribute('active');
  }

  _syncState() {
    if (!this.shadowRoot) return;
    const active = this.active;
    this.shadowRoot.querySelectorAll('.context-panel').forEach(panel => {
      const visible = panel.dataset.panel === active;
      panel.dataset.visible = String(visible);
      panel.setAttribute('aria-hidden', String(!visible));
      panel.inert = !visible;
    });
    const live = this.shadowRoot.querySelector('.sr-only');
    if (live) live.textContent = active ? `${active} tools opened` : 'Tool panel closed';

    this.shadowRoot.querySelectorAll('.tool').forEach(tool => {
      const isActive = tool.dataset.action === active;
      tool.classList.toggle('is-active', isActive);
      tool.setAttribute('aria-pressed', String(isActive));
      if (tool.dataset.action === 'assets' || tool.dataset.action === 'annotate' || tool.dataset.action === 'text') {
        tool.setAttribute('aria-expanded', String(isActive));
      }
    });
    this._syncLayout();
  }

  _syncLayout() {
    if (!this.shadowRoot) return;
    const baseHeight = this.active === 'assets' ? 220 : this.active === 'annotate' ? 180 : this.active === 'text' ? 180 : 76;
    const width = this.getBoundingClientRect().width || 480;
    const fitScale = width / 480;
    const scale = Math.min(1, Math.max(width < 360 ? 0.66 : fitScale, fitScale));
    const visualWidth = 480 * scale;
    this.style.setProperty('--cfb-stage-height', `${baseHeight}px`);
    this.style.setProperty('--cfb-scale', scale);
    this.style.setProperty('--cfb-visual-width', `${visualWidth}px`);
    this.style.setProperty('--cfb-render-height', `${baseHeight * scale}px`);
  }
}

customElements.define('center-floating-bar', CenterFloatingBar);
  
