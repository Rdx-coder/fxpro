import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { adminAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check if user is admin, but don't navigate immediately
    if (user && user.role !== 'admin') {
      // Use setTimeout to allow layout to mount
      setTimeout(() => {
        router.replace('/home');
      }, 100);
      return;
    }
    
    if (user?.role === 'admin') {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const StatCard = ({ icon, title, value, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const ActionCard = ({ icon, title, badge, color, onPress }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage your trading platform</Text>
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {stats && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                icon="people"
                title="Total Users"
                value={stats.totalUsers}
                color={Colors.primary}
              />
              <StatCard
                icon="cash"
                title="Total Deposits"
                value={`$${stats.totalDeposits.toFixed(2)}`}
                color={Colors.success}
              />
              <StatCard
                icon="trending-up"
                title="Total Withdrawals"
                value={`$${stats.totalWithdrawals.toFixed(2)}`}
                color={Colors.danger}
              />
              <StatCard
                icon="pulse"
                title="Total Trades"
                value={stats.totalTrades}
                color={Colors.secondary}
              />
            </View>

            {/* Pending Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Actions</Text>
              <View style={styles.actionsGrid}>
                <ActionCard
                  icon="document-text"
                  title="KYC Review"
                  badge={stats.pendingKYC}
                  color={Colors.warning}
                  onPress={() => router.push('/admin/kyc')}
                />
                <ActionCard
                  icon="arrow-down-circle"
                  title="Deposits"
                  badge={stats.pendingDeposits}
                  color={Colors.success}
                  onPress={() => router.push('/admin/deposits')}
                />
                <ActionCard
                  icon="arrow-up-circle"
                  title="Withdrawals"
                  badge={stats.pendingWithdrawals}
                  color={Colors.danger}
                  onPress={() => router.push('/admin/withdrawals')}
                />
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Management</Text>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/admin/users')}
              >
                <Ionicons name="people" size={24} color={Colors.primary} />
                <Text style={styles.quickActionText}>User Management</Text>
                <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/admin/trades')}
              >
                <Ionicons name="pulse" size={24} color={Colors.secondary} />
                <Text style={styles.quickActionText}>Trade Monitoring</Text>
                <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/admin/payment-settings')}
              >
                <Ionicons name="settings" size={24} color={Colors.warning} />
                <Text style={styles.quickActionText}>Payment Settings</Text>
                <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
});
