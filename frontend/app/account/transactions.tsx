import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { walletAPI } from '../../utils/api';
import { format } from 'date-fns';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await walletAPI.getTransactions();
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'arrow-down-circle';
      case 'withdraw':
        return 'arrow-up-circle';
      case 'trade_profit':
        return 'trending-up';
      case 'trade_loss':
        return 'trending-down';
      default:
        return 'cash';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'trade_profit':
        return Colors.success;
      case 'withdraw':
      case 'trade_loss':
        return Colors.danger;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return Colors.success;
      case 'rejected':
        return Colors.danger;
      case 'pending':
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.map((tx: any) => (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txIcon}>
                <Ionicons name={getTypeIcon(tx.type) as any} size={24} color={getTypeColor(tx.type)} />
              </View>
              <View style={styles.txContent}>
                <Text style={styles.txDescription}>{tx.description}</Text>
                <Text style={styles.txDate}>{format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(tx.status) + '20' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: getStatusColor(tx.status) }]}>
                    {tx.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color:
                      tx.type === 'deposit' || tx.type === 'trade_profit'
                        ? Colors.success
                        : Colors.danger,
                  },
                ]}
              >
                {tx.type === 'deposit' || tx.type === 'trade_profit' ? '+' : '-'}$
                {tx.amount.toFixed(2)}
              </Text>
            </View>
          ))
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
    padding: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  txCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  txIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txContent: {
    flex: 1,
  },
  txDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  txAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});
