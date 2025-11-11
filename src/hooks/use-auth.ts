"use client";

import { useUser, type UserHookResult } from '@/firebase';

export const useAuth = (): UserHookResult => {
  const { user, isUserLoading: loading } = useUser();
  
  // Adapt the returned object to match the old AuthContextType structure if needed,
  // but it's better to update components to use the new hook's return shape directly.
  // For now, let's keep it compatible.
  const legacyUser = user ? { ...user, isAdmin: (user as any).isAdmin } : null;

  return { user: legacyUser, loading };
};
