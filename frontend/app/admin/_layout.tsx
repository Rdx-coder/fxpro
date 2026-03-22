import { Stack } from 'expo-router';
import React from 'react';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="users" />
      <Stack.Screen name="deposits" />
      <Stack.Screen name="withdrawals" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="trades" />
      <Stack.Screen name="payment-settings" />
    </Stack>
  );
}
