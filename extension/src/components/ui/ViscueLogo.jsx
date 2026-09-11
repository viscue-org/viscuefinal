import React, { useState } from 'react';
import './ViscueLogo.css';

/**
 * ViscueLogo
 * Official Viscue Brand Logo with signature 0.9s one-shot animation:
 * - Inner cue needle rotates exactly 360°.
 * - Near the end of rotation, upper and lower eye curves briefly move inward to create a natural blink.
 * - Settles into its static form (never loops continuously).
 * - Reduced-motion mode displays only the finished static icon.
 *
 * Variants:
 * - 'mark': Standalone stroke mark (transparent background, uses currentColor or theme stroke).
 * - 'tile': App icon squircle with #5B7593 steel-blue background and white mark (matching viscue-app-icon.png).
 */
export function ViscueLogo({
  size = 28,
  variant = 'mark',
  animated = true,
  className = '',
  onClick,
  title = 'Viscue',
  ...props
}) {
  const [animKey, setAnimKey] = useState(0);

  const handleClick = (e) => {
    if (animated) setAnimKey(k => k + 1);
    if (onClick) onClick(e);
  };

  const isTile = variant === 'tile';
  const strokeWidth = isTile ? 8.2 : 8.8;

  return (
    <span
      key={animKey}
      className={`viscue-logo viscue-logo--${variant} ${animated ? 'is-animated' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
      role={onClick ? 'button' : 'img'}
      aria-label={title}
      {...props}
    >
      <svg
        className="viscue-logo__svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {title && <title>{title}</title>}
        {isTile && (
          <rect
            className="viscue-logo__tile-bg"
            x="2"
            y="2"
            width="96"
            height="96"
            rx="22"
            fill="var(--viscue-brand, #5B7593)"
          />
        )}
        <g className="viscue-logo__mark" stroke={isTile ? '#FFFFFF' : 'currentColor'} strokeWidth={strokeWidth} strokeLinecap="round">
          {/* Upper eye curve */}
          <path
            className="viscue-logo__upper"
            d="M 79.5 14 C 58 7.5, 14 26, 14 50"
            fill="none"
          />
          {/* Lower eye curve */}
          <path
            className="viscue-logo__lower"
            d="M 14 50 C 14 74, 46 88, 77.5 78"
            fill="none"
          />
          {/* Inner cue needle */}
          <line
            className="viscue-logo__needle"
            x1="56"
            y1="50"
            x2="84"
            y2="50"
          />
        </g>
      </svg>
    </span>
  );
}

export default ViscueLogo;
