import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { walletAPI, tradeAPI, marketAPI } from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [openTrades, setOpenTrades] = useState([]);
  const [topSymbols, setTopSymbols] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [balanceRes, tradesRes, quotesRes] = await Promise.all([
        walletAPI.getBalance(),
        tradeAPI.getOpen(),
        marketAPI.getQuotes(),
      ]);
      setBalance(balanceRes.data.balance);
      setOpenTrades(tradesRes.data);
      setTopSymbols(quotesRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error loading home data:', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const calculateTotalPnL = () => {
    return openTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name || 'Trader'}</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={24} color={Colors.primary} />
            <Text style={styles.balanceLabel}>Account Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/fund')}
            >
              <Ionicons name="add-circle" size={20} color={Colors.primary} />
              <Text style={styles.actionText}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/withdraw')}
            >
              <Ionicons name="arrow-up-circle" size={20} color={Colors.secondary} />
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Open Trades Summary */}
        {openTrades.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Open Positions</Text>
              <TouchableOpacity onPress={() => router.push('/trade')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tradesCard}>
              <View style={styles.tradesSummary}>
                <View style={styles.tradeStat}>
                  <Text style={styles.tradeStatLabel}>Positions</Text>
                  <Text style={styles.tradeStatValue}>{openTrades.length}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.tradeStat}>
                  <Text style={styles.tradeStatLabel}>Total P&L</Text>
                  <Text
                    style={[
                      styles.tradeStatValue,
                      { color: calculateTotalPnL() >= 0 ? Colors.success : Colors.danger },
                    ]}
                  >
                    ${calculateTotalPnL().toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Market Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Overview</Text>
          {topSymbols.map((symbol) => (
            <TouchableOpacity
              key={symbol.symbol}
              style={styles.marketItem}
              onPress={() => router.push('/trade')}
            >
              <View style={styles.marketLeft}>
                <Text style={styles.marketSymbol}>{symbol.symbol}</Text>
                <Text style={styles.marketPrice}>${symbol.price.toFixed(2)}</Text>
              </View>
              <View
                style={[
                  styles.marketChange,
                  {
                    backgroundColor:
                      symbol.changePercent24h >= 0
                        ? Colors.success + '20'
                        : Colors.danger + '20',
                  },
                ]}
              >
                <Ionicons
                  name={symbol.changePercent24h >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={symbol.changePercent24h >= 0 ? Colors.success : Colors.danger}
                />
                <Text
                  style={[
                    styles.marketChangeText,
                    { color: symbol.changePercent24h >= 0 ? Colors.success : Colors.danger },
                  ]}
                >
                  {symbol.changePercent24h.toFixed(2)}%
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/trade')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="trending-up" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionText}>Trade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/account/kyc')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="document-text" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.quickActionText}>KYC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/calendar')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="calendar" size={28} color={Colors.warning} />
              </View>
              <Text style={styles.quickActionText}>Calendar</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  seeAll: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  tradesCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tradesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tradeStat: {
    alignItems: 'center',
    flex: 1,
  },
  tradeStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tradeStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  marketLeft: {
    flex: 1,
  },
  marketSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  marketPrice: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  marketChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  marketChangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
});
