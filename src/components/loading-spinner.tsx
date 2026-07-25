
import React from 'react';

export const AllSeeingEye = ({ className = '', size = 64 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="eye-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B8EF3" />
        <stop offset="100%" stopColor="#16C780" />
      </linearGradient>
      <radialGradient id="pupil-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#16C780" />
        <stop offset="100%" stopColor="#3B8EF3" />
      </radialGradient>
      <filter id="eye-glow">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* Eye outline — almond shape */}
    <path
      d="M 64 256 C 64 256 160 128 256 128 C 352 128 448 256 448 256 C 448 256 352 384 256 384 C 160 384 64 256 64 256 Z"
      stroke="url(#eye-grad)"
      strokeWidth="22"
      fill="none"
      strokeLinejoin="round"
      filter="url(#eye-glow)"
    />
    {/* Iris ring */}
    <circle cx="256" cy="256" r="80" stroke="url(#eye-grad)" strokeWidth="20" fill="none" />
    {/* Pupil */}
    <circle cx="256" cy="256" r="36" fill="url(#pupil-grad)" />
    {/* Highlight */}
    <circle cx="232" cy="232" r="12" fill="white" fillOpacity="0.55" />
  </svg>
);

export const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="relative w-32 h-32">
        {/* Spinning gradient arc */}
        <svg
          className="animate-spin absolute inset-0 w-32 h-32"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B8EF3" />
              <stop offset="75%" stopColor="#16C780" />
              <stop offset="100%" stopColor="#3B8EF3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke="url(#ring-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="300"
            strokeDashoffset="75"
          />
        </svg>
        {/* Centered eye with pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AllSeeingEye size={72} className="animate-pulse" />
        </div>
      </div>
    </div>
  );
};
