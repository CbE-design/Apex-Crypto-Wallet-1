'use client';

interface EyeWatermarkProps {
  className?: string;
  opacity?: number;
}

export function EyeWatermark({ className = '', opacity = 0.035 }: EyeWatermarkProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Outer triangle (pyramid) */}
      <path
        d="M160 18 L302 274 L18 274 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />

      {/* Inner triangle halo */}
      <path
        d="M160 42 L284 258 L36 258 Z"
        stroke="currentColor"
        strokeWidth="0.5"
        fill="none"
        strokeLinejoin="round"
        opacity={0.4}
      />

      {/* Almond / eye-lid shape */}
      <path
        d="M92 155 C105 118, 215 118, 228 155 C215 192, 105 192, 92 155 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />

      {/* Iris circle */}
      <circle cx="160" cy="155" r="26" stroke="currentColor" strokeWidth="1.1" fill="none" />

      {/* Iris inner ring */}
      <circle cx="160" cy="155" r="16" stroke="currentColor" strokeWidth="0.6" fill="none" opacity={0.6} />

      {/* Pupil */}
      <circle cx="160" cy="155" r="8" fill="currentColor" opacity={0.18} />

      {/* Radiant rays from eye outward */}
      {/* Top */}
      <line x1="160" y1="128" x2="160" y2="50"  stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Top-right */}
      <line x1="183" y1="135" x2="250" y2="82"  stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Right */}
      <line x1="228" y1="155" x2="298" y2="155" stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Bottom-right */}
      <line x1="210" y1="177" x2="265" y2="230" stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Bottom */}
      <line x1="160" y1="182" x2="160" y2="258" stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Bottom-left */}
      <line x1="110" y1="177" x2="55"  y2="230" stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Left */}
      <line x1="92"  y1="155" x2="22"  y2="155" stroke="currentColor" strokeWidth="0.5" opacity={0.5} />
      {/* Top-left */}
      <line x1="137" y1="135" x2="70"  y2="82"  stroke="currentColor" strokeWidth="0.5" opacity={0.5} />

      {/* Corner dots — subtle anchor nodes */}
      <circle cx="160" cy="18"  r="1.5" fill="currentColor" opacity={0.5} />
      <circle cx="302" cy="274" r="1.5" fill="currentColor" opacity={0.5} />
      <circle cx="18"  cy="274" r="1.5" fill="currentColor" opacity={0.5} />
    </svg>
  );
}
