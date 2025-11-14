'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';

const VERSION_STORAGE_KEY = 'apex-app-version';

export function VersionCheck() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const checkVersion = async () => {
      try {
        // Appending a timestamp to prevent caching of the version file
        const response = await fetch(`/version.json?t=${new Date().getTime()}`);
        if (!response.ok) {
          throw new Error('Could not fetch version file');
        }
        const { version: latestVersion } = await response.json();
        const currentVersion = localStorage.getItem(VERSION_STORAGE_KEY);

        if (latestVersion && currentVersion !== latestVersion) {
          toast({
            title: '🎉 New Version Available!',
            description: 'A new version of the app has been released. Please refresh to get the latest features.',
            duration: Infinity, // Keep the toast open until dismissed
            action: (
              <Button
                onClick={() => {
                  localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
                  window.location.reload();
                }}
              >
                Refresh Now
              </Button>
            ),
          });
          // We don't set the new version here, we set it when the user clicks refresh.
          // This ensures they see the message again if they dismiss it without refreshing.
        } else if (!currentVersion) {
            // If it's the user's first time, just set the version without a notification.
            localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
        }
      } catch (error) {
        console.error('Failed to check for new version:', error);
      }
    };

    checkVersion();
  }, [isClient, toast]);

  return null; // This component does not render anything
}
