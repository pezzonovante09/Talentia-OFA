import React from 'react';
import { Redirect } from 'expo-router';

import { useAuth } from '../context/AuthContext';

type ConsentGateProps = {
  children: React.ReactNode;
};

/**
 * Blocks deep-linked screens until the user is signed in and parental consent
 * is recorded on the child profile (see AuthContext.isProfileCompleted).
 */
export function ConsentGate({ children }: ConsentGateProps) {
  const session = useAuth((s) => s.session);
  const profileCompleted = useAuth((s) => s.profileCompleted);
  const loading = useAuth((s) => s.loading);

  if (!loading && !session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!loading && session && !profileCompleted) {
    return <Redirect href="/(auth)/parent-setup" />;
  }

  return <>{children}</>;
}
