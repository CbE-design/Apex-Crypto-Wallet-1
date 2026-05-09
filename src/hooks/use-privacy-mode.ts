'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'apex_privacy_mode';

export function usePrivacyMode() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setPrivacyMode(true);
  }, []);

  const togglePrivacyMode = () => {
    setPrivacyMode(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return { privacyMode: mounted ? privacyMode : false, togglePrivacyMode };
}
