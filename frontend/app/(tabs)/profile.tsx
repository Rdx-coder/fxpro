import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { profileAPI, kycAPI } from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore();
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState('pending');

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadKYCStatus();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const response = await profileAPI.get();
      setUser(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadKYCStatus = async () => {
    try {
      const response = await kycAPI.getStatus();
      setKycStatus(response.data.kycStatus);
    } catch (error) {
      console.error('Error loading KYC status:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const getKYCColor = () => {
    switch (kycStatus) {
      case 'approved':
        return Colors.success;
      case 'rejected':
        return Colors.danger;
      default:
        return Colors.warning;
    }
  };

  const menuItems = [
    {
      icon: 'person',
      title: 'Edit Profile',
      onPress: () => router.push('/account/edit'),
    },
    {
      icon: 'document-text',
      title: 'KYC Verification',
      subtitle: kycStatus.toUpperCase(),
      subtitleColor: getKYCColor(),
      onPress: () => router.push('/account/kyc'),
    },
    {
      icon: 'card',
      title: 'Bank Accounts',
      onPress: () => router.push('/account/bank-accounts'),
    },
    {
      icon: 'list',
      title: 'Transaction History',
      onPress: () => router.push('/account/transactions'),
    },
    {
      icon: 'arrow-up',
      title: 'Withdraw Funds',
      onPress: () => router.push('/withdraw'),
    },
  ];

  if (user?.role === 'admin') {
    menuItems.push({
      icon: 'settings',
      title: 'Admin Dashboard',
      onPress: () => router.push('/admin/dashboard'),
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceAmount}>${user?.walletBalance?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={24} color={Colors.primary} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={[styles.menuSubtitle, { color: item.subtitleColor }]}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color={Colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: Colors.background,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  menu: {
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger + '20',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
});
