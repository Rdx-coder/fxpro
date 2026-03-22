import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { token, isLoading, loadAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inAdminGroup = segments[0] === 'admin';

    if (!token && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/auth/login');
    } else if (token && inAuthGroup) {
      // Redirect to home if authenticated and on auth screen
      router.replace('/home');
    }
  }, [token, isLoading, segments]);

  return <Slot />;
}
