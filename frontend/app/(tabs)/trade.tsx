import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { marketAPI, tradeAPI, walletAPI } from '../../utils/api';
import { Button } from '../../components/Button';

export default function TradeScreen() {
  const [activeTab, setActiveTab] = useState<'quotes' | 'trades' | 'history'>('quotes');
  const [quotes, setQuotes] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [balance, setBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [tradeModal, setTradeModal] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('0.01');
  const [leverage, setLeverage] = useState('1');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [quotesRes, tradesRes, historyRes, balanceRes] = await Promise.all([
        marketAPI.getQuotes(),
        tradeAPI.getOpen(),
        tradeAPI.getHistory(),
        walletAPI.getBalance(),
      ]);
      setQuotes(quotesRes.data);
      setOpenTrades(tradesRes.data);
      setTradeHistory(historyRes.data);
      setBalance(balanceRes.data.balance);
    } catch (error) {
      console.error('Error loading trade data:', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenTradeModal = (symbol: any) => {
    setSelectedSymbol(symbol);
    setTradeModal(true);
  };

  const handleExecuteTrade = async () => {
    if (!selectedSymbol || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    setLoading(true);
    try {
      await tradeAPI.execute({
        symbol: selectedSymbol.symbol,
        type: tradeType,
        quantity: parseFloat(quantity),
        leverage: parseFloat(leverage),
      });
      Alert.alert('Success', 'Trade executed successfully');
      setTradeModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to execute trade');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    Alert.alert(
      'Close Trade',
      'Are you sure you want to close this trade?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          onPress: async () => {
            try {
              const response = await tradeAPI.close(tradeId);
              Alert.alert('Success', `Trade closed. P&L: $${response.data.profitLoss.toFixed(2)}`);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to close trade');
            }
          },
        },
      ]
    );
  };

  const renderQuotes = () => (
    <ScrollView>
      {quotes.map((quote) => (
        <TouchableOpacity
          key={quote.symbol}
          style={styles.quoteCard}
          onPress={() => handleOpenTradeModal(quote)}
        >
          <View style={styles.quoteHeader}>
            <Text style={styles.quoteSymbol}>{quote.symbol}</Text>
            <View
              style={[
                styles.changeChip,
                {
                  backgroundColor:
                    quote.changePercent24h >= 0 ? Colors.success + '20' : Colors.danger + '20',
                },
              ]}
            >
              <Ionicons
                name={quote.changePercent24h >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={quote.changePercent24h >= 0 ? Colors.success : Colors.danger}
              />
              <Text
                style={[
                  styles.changeText,
                  { color: quote.changePercent24h >= 0 ? Colors.success : Colors.danger },
                ]}
              >
                {quote.changePercent24h.toFixed(2)}%
              </Text>
            </View>
          </View>
          <Text style={styles.quotePrice}>${quote.price.toFixed(2)}</Text>
          <View style={styles.quoteStats}>
            <View style={styles.quoteStat}>
              <Text style={styles.quoteStatLabel}>24h High</Text>
              <Text style={styles.quoteStatValue}>${quote.high24h.toFixed(2)}</Text>
            </View>
            <View style={styles.quoteStat}>
              <Text style={styles.quoteStatLabel}>24h Low</Text>
              <Text style={styles.quoteStatValue}>${quote.low24h.toFixed(2)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderOpenTrades = () => (
    <ScrollView>
      {openTrades.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trending-up-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No open trades</Text>
        </View>
      ) : (
        openTrades.map((trade) => (
          <View key={trade.id} style={styles.tradeCard}>
            <View style={styles.tradeHeader}>
              <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
              <View
                style={[
                  styles.tradeType,
                  { backgroundColor: trade.type === 'buy' ? Colors.success + '20' : Colors.danger + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.tradeTypeText,
                    { color: trade.type === 'buy' ? Colors.success : Colors.danger },
                  ]}
                >
                  {trade.type.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.tradeDetails}>
              <View style={styles.tradeDetail}>
                <Text style={styles.tradeDetailLabel}>Entry Price</Text>
                <Text style={styles.tradeDetailValue}>${trade.entryPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.tradeDetail}>
                <Text style={styles.tradeDetailLabel}>Current Price</Text>
                <Text style={styles.tradeDetailValue}>${trade.currentPrice?.toFixed(2) || '-'}</Text>
              </View>
              <View style={styles.tradeDetail}>
                <Text style={styles.tradeDetailLabel}>Quantity</Text>
                <Text style={styles.tradeDetailValue}>{trade.quantity}</Text>
              </View>
              <View style={styles.tradeDetail}>
                <Text style={styles.tradeDetailLabel}>P&L</Text>
                <Text
                  style={[
                    styles.tradePnL,
                    { color: trade.profitLoss >= 0 ? Colors.success : Colors.danger },
                  ]}
                >
                  ${trade.profitLoss.toFixed(2)}
                </Text>
              </View>
            </View>
            <Button
              title="Close Trade"
              onPress={() => handleCloseTrade(trade.id)}
              variant="danger"
              style={styles.closeButton}
            />
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView>
      {tradeHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No trade history</Text>
        </View>
      ) : (
        tradeHistory.map((trade) => (
          <View key={trade.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historySymbol}>{trade.symbol}</Text>
              <Text
                style={[
                  styles.historyPnL,
                  { color: trade.profitLoss >= 0 ? Colors.success : Colors.danger },
                ]}
              >
                ${trade.profitLoss.toFixed(2)}
              </Text>
            </View>
            <View style={styles.historyDetails}>
              <Text style={styles.historyDetail}>
                {trade.type.toUpperCase()} • {trade.quantity} units
              </Text>
              <Text style={styles.historyDetail}>
                Entry: ${trade.entryPrice.toFixed(2)} → Exit: ${trade.exitPrice?.toFixed(2)}
              </Text>
              <Text style={styles.historyDate}>
                {new Date(trade.closeTime).toLocaleString()}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.balanceText}>Balance: ${balance.toFixed(2)}</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'quotes' && styles.activeTab]}
          onPress={() => setActiveTab('quotes')}
        >
          <Text style={[styles.tabText, activeTab === 'quotes' && styles.activeTabText]}>
            Quotes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trades' && styles.activeTab]}
          onPress={() => setActiveTab('trades')}
        >
          <Text style={[styles.tabText, activeTab === 'trades' && styles.activeTabText]}>
            Trades
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'quotes' && renderQuotes()}
        {activeTab === 'trades' && renderOpenTrades()}
        {activeTab === 'history' && renderHistory()}
      </View>

      {/* Trade Modal */}
      <Modal visible={tradeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trade {selectedSymbol?.symbol}</Text>
              <TouchableOpacity onPress={() => setTradeModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalPrice}>
                Current Price: ${selectedSymbol?.price.toFixed(2)}
              </Text>

              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    tradeType === 'buy' && { backgroundColor: Colors.success },
                  ]}
                  onPress={() => setTradeType('buy')}
                >
                  <Text style={styles.typeButtonText}>BUY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    tradeType === 'sell' && { backgroundColor: Colors.danger },
                  ]}
                  onPress={() => setTradeType('sell')}
                >
                  <Text style={styles.typeButtonText}>SELL</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="0.01"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Leverage (1x - 100x)</Text>
                <TextInput
                  style={styles.input}
                  value={leverage}
                  onChangeText={setLeverage}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setTradeModal(false)}
                  variant="secondary"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Execute Trade"
                  onPress={handleExecuteTrade}
                  loading={loading}
                  variant={tradeType === 'buy' ? 'success' : 'danger'}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  quoteCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quotePrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  quoteStats: {
    flexDirection: 'row',
    gap: 16,
  },
  quoteStat: {},
  quoteStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  quoteStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  tradeCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tradeSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  tradeType: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tradeTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tradeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  tradeDetail: {
    flex: 1,
    minWidth: '45%',
  },
  tradeDetailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tradeDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  tradePnL: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 8,
  },
  historyCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  historyPnL: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyDetails: {
    gap: 4,
  },
  historyDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {},
  modalPrice: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
});
