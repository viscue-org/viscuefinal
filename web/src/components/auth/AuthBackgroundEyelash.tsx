'use client';

import React from 'react';
import { EYELASH_PATHS } from './eyelash-data';
import './AuthBackgroundEyelash.css';

/**
 * AuthBackgroundEyelash
 * Large atmospheric secondary visual in the background of login/signup pages.
 * Animates with the signature airflow breathing cycle:
 * "air coming in (inhale lift) -> closing (eyelid closure) -> animating up (airy flutter rise)".
 * Uses Viscue main steel-blue as background environment and warm secondary color for the eyelashes.
 */
export function AuthBackgroundEyelash() {
  return (
    <div className="auth-background-canvas" aria-hidden="true">
      {/* Ambient background light orbs */}
      <div className="auth-bg-ambient-orb auth-bg-ambient-orb--main" />
      <div className="auth-bg-ambient-orb auth-bg-ambient-orb--secondary" />

      {/* Stage holding the large background eyelash */}
      <div className="auth-eyelash-stage">
        <svg
          className="auth-eyelash-svg is-breathing"
          viewBox="0 0 800 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Secondary Color Gradients (Viscue Coral / Orange to Luminous Soft Sky) */}
            <linearGradient id="viscueSecondaryGradFront" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF7D54" />
              <stop offset="45%" stopColor="#FF5A36" />
              <stop offset="85%" stopColor="#FF9671" />
              <stop offset="100%" stopColor="#A5C2DE" />
            </linearGradient>

            <linearGradient id="viscueSecondaryGradMid" x1="15%" y1="100%" x2="85%" y2="0%">
              <stop offset="0%" stopColor="#E04D2D" />
              <stop offset="50%" stopColor="#FF6B47" />
              <stop offset="100%" stopColor="#8EACC7" />
            </linearGradient>

            <linearGradient id="viscueSecondaryGradBack" x1="30%" y1="100%" x2="70%" y2="0%">
              <stop offset="0%" stopColor="#B83A20" />
              <stop offset="50%" stopColor="#D95332" />
              <stop offset="100%" stopColor="#6C88A8" />
            </linearGradient>
          </defs>

          {/* Eyelash strokes layered from back to front */}
          <g className="eyelash-strokes-back">
            {EYELASH_PATHS.filter(l => l.layer === 2).map((lash, idx) => (
              <path
                key={`b-${idx}`}
                className="lash-layer-2"
                d={lash.d}
                strokeWidth={lash.strokeWidth}
                strokeOpacity={lash.opacity}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="eyelash-strokes-mid">
            {EYELASH_PATHS.filter(l => l.layer === 1).map((lash, idx) => (
              <path
                key={`m-${idx}`}
                className="lash-layer-1"
                d={lash.d}
                strokeWidth={lash.strokeWidth}
                strokeOpacity={lash.opacity}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="eyelash-strokes-front">
            {EYELASH_PATHS.filter(l => l.layer === 0).map((lash, idx) => (
              <path
                key={`f-${idx}`}
                className="lash-layer-0"
                d={lash.d}
                strokeWidth={lash.strokeWidth}
                strokeOpacity={lash.opacity}
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Eyelid base contour line */}
          <path
            className="eyelid-base-line"
            d="M 80 290 Q 400 155, 720 290"
            strokeWidth="3.2"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

export default AuthBackgroundEyelash;
