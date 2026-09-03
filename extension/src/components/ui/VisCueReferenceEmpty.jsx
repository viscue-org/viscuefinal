import React from 'react';
import './VisCueReferenceEmpty.css';

export const VisCueReferenceEmpty = (props) => {
  return (
    <div className="VisCueReferenceEmpty-host" {...props}>
      <div className="scale">
            <section className="panel" aria-labelledby="history-title">
              <svg className="identity-rail" viewBox="0 0 302 96" preserveAspectRatio="none" ariaHidden="true">
                <path d="M0 0H246C263 0 276 13 276 30V35C276 52 263 65 246 65H220C202 65 188 79 188 96H0Z"/>
              </svg>
              <div className="title-group">
                <h2 className="title" id="history-title">History</h2>
              </div>

              <div className="controls" aria-label="History panel actions">
                <button className="history-action" type="button" aria-label="History tools">
                  <span className="icon">${lucide.historyFocus}</span>
                </button>
                <button className="close" type="button" aria-label="Close history">
                  <span className="icon">${lucide.x}</span>
                </button>
              </div>

              <div className="history-body">
                <div className="empty-state">
                  <div className="empty-kicker">Timeline</div>
                  <p className="message">No history snapshots found.</p>
                  <p className="helper">Snapshots appear here as you make changes, so you can return to an earlier visual state without leaving the canvas.</p>
                  <button className="empty-action" type="button">
                    <span className="icon">${lucide.historyFocus}</span>
                    <span>View current state</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        `;

        this._resize = () => {
          const width = this.getBoundingClientRect().width;
          const scale = Math.min(1, width / 670);
          root.host.style.setProperty('--vhp-scale', scale);
          root.host.style.height = `${500 * scale}px
    </div>
  );
};
