
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/firebase/auth';
import { getUserProfile } from '@/lib/firebase/firestore';
import { Loader2 } from 'lucide-react';
import { firebaseApp } from '@/lib/firebase/config';

interface AuthContextType {
  user: User | null;
  userProfile: any | null; // Consider defining a type for the user profile
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if Firebase config is available
const isFirebaseConfigured = !!firebaseApp;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only subscribe to auth state changes if Firebase is configured
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChange(async (user) => {
        setUser(user);
        if (user) {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // If not configured, stop loading and proceed with no user
      setLoading(false);
    }
  }, []);

  // Show a loading spinner only if Firebase is configured and we are waiting for auth state
  if (loading && isFirebaseConfigured) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
