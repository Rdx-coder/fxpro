import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { adminAPI, marketAPI } from '../../utils/api';
import { Button } from '../../components/Button';

export default function AdminTradesScreen() {
  const router = useRouter();
  const [trades, setTrades] = useState([]);
  const [users, setUsers] = useState([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  
  // Create Trade Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [leverage, setLeverage] = useState('1');
  const [loading, setLoading] = useState(false);
  
  // Close Trade Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [exitPrice, setExitPrice] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tradesRes, usersRes, symbolsRes] = await Promise.all([
        adminAPI.getTrades(),
        adminAPI.getUsers(),
        marketAPI.getSymbols()
      ]);
      setTrades(tradesRes.data);
      setUsers(usersRes.data);
      setSymbols(symbolsRes.data.symbols || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateTrade = async () => {
    if (!selectedUserId || !selectedSymbol || !entryPrice || parseFloat(entryPrice) <= 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await adminAPI.createTrade({
        userId: selectedUserId,
        symbol: selectedSymbol,
        type: tradeType,
        entryPrice: parseFloat(entryPrice),
        quantity: parseFloat(quantity),
        leverage: parseFloat(leverage)
      });
      Alert.alert('Success', 'Trade created successfully');
      setShowCreateModal(false);
      resetCreateForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create trade');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTrade = async () => {
    if (!selectedTrade) return;
    
    setLoading(true);
    try {
      const closeData: any = {};
      if (exitPrice && parseFloat(exitPrice) > 0) {
        closeData.exitPrice = parseFloat(exitPrice);
      }
      
      const response = await adminAPI.closeTrade(selectedTrade.id, closeData);
      Alert.alert('Success', `Trade closed. P&L: $${response.data.profitLoss.toFixed(2)}`);
      setShowCloseModal(false);
      setSelectedTrade(null);
      setExitPrice('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to close trade');
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedUserId('');
    setSelectedSymbol('');
    setTradeType('buy');
    setEntryPrice('');
    setQuantity('1');
    setLeverage('1');
  };

  const openCloseModal = (trade: any) => {
    setSelectedTrade(trade);
    setExitPrice(trade.entryPrice?.toString() || '');
    setShowCloseModal(true);
  };

  const filteredTrades = trades.filter((trade: any) => {
    if (filter === 'open') return trade.status === 'open';
    if (filter === 'closed') return trade.status === 'closed';
    return true;
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Trade Management</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {['all', 'open', 'closed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {filteredTrades.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pulse-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No {filter !== 'all' && filter} trades found</Text>
          </View>
        ) : (
          filteredTrades.map((trade: any) => (
            <View key={trade.id} style={styles.tradeCard}>
              <View style={styles.tradeHeader}>
                <View>
                  <Text style={styles.tradeUser}>{trade.userName}</Text>
                  <Text style={styles.tradeEmail}>{trade.userEmail}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: trade.status === 'open' ? Colors.warning + '20' : Colors.success + '20' }]}>
                  <Text style={[styles.statusText, { color: trade.status === 'open' ? Colors.warning : Colors.success }]}>
                    {trade.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.tradeInfo}>
                <View style={styles.tradeSymbol}>
                  <Ionicons name="trending-up" size={20} color={Colors.primary} />
                  <Text style={styles.symbolText}>{trade.symbol}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: trade.type === 'buy' ? Colors.success + '20' : Colors.danger + '20' }]}>
                    <Text style={[styles.typeText, { color: trade.type === 'buy' ? Colors.success : Colors.danger }]}>
                      {trade.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.tradeDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entry Price:</Text>
                  <Text style={styles.detailValue}>${trade.entryPrice?.toFixed(2) || '0.00'}</Text>
                </View>
                {trade.exitPrice && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Exit Price:</Text>
                    <Text style={styles.detailValue}>${trade.exitPrice?.toFixed(2) || '0.00'}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity:</Text>
                  <Text style={styles.detailValue}>{trade.quantity}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Leverage:</Text>
                  <Text style={styles.detailValue}>{trade.leverage}x</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Margin:</Text>
                  <Text style={styles.detailValue}>${trade.margin?.toFixed(2) || '0.00'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>P&L:</Text>
                  <Text style={[styles.pnlValue, { color: (trade.profitLoss || 0) >= 0 ? Colors.success : Colors.danger }]}>
                    ${(trade.profitLoss || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.tradeFooter}>
                <Text style={styles.tradeDate}>
                  Opened: {formatDate(trade.openTime)}
                </Text>
                {trade.closeTime && (
                  <Text style={styles.tradeDate}>
                    Closed: {formatDate(trade.closeTime)}
                  </Text>
                )}
              </View>

              {trade.status === 'open' && (
                <Button
                  title="Close Trade"
                  onPress={() => openCloseModal(trade)}
                  variant="danger"
                  style={styles.closeTradeButton}
                />
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Trade Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Trade</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select User *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                  {users.map((user: any) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.chip, selectedUserId === user.id && styles.chipActive]}
                      onPress={() => setSelectedUserId(user.id)}
                    >
                      <Text style={[styles.chipText, selectedUserId === user.id && styles.chipTextActive]}>
                        {user.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Symbol *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                  {symbols.map((symbol: string) => (
                    <TouchableOpacity
                      key={symbol}
                      style={[styles.chip, selectedSymbol === symbol && styles.chipActive]}
                      onPress={() => setSelectedSymbol(symbol)}
                    >
                      <Text style={[styles.chipText, selectedSymbol === symbol && styles.chipTextActive]}>
                        {symbol}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trade Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeButton, tradeType === 'buy' && styles.buyButtonActive]}
                    onPress={() => setTradeType('buy')}
                  >
                    <Text style={[styles.typeButtonText, tradeType === 'buy' && { color: '#fff' }]}>BUY</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, tradeType === 'sell' && styles.sellButtonActive]}
                    onPress={() => setTradeType('sell')}
                  >
                    <Text style={[styles.typeButtonText, tradeType === 'sell' && { color: '#fff' }]}>SELL</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Entry Price *</Text>
                <TextInput
                  style={styles.input}
                  value={entryPrice}
                  onChangeText={setEntryPrice}
                  placeholder="Enter price"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Leverage</Text>
                  <TextInput
                    style={styles.input}
                    value={leverage}
                    onChangeText={setLeverage}
                    placeholder="1"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
                  variant="secondary"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Create Trade"
                  onPress={handleCreateTrade}
                  loading={loading}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Close Trade Modal */}
      <Modal visible={showCloseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Close Trade</Text>
              <TouchableOpacity onPress={() => { setShowCloseModal(false); setSelectedTrade(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedTrade && (
              <View style={styles.modalBody}>
                <View style={styles.tradeSummary}>
                  <Text style={styles.summaryLabel}>Symbol: <Text style={styles.summaryValue}>{selectedTrade.symbol}</Text></Text>
                  <Text style={styles.summaryLabel}>Type: <Text style={styles.summaryValue}>{selectedTrade.type.toUpperCase()}</Text></Text>
                  <Text style={styles.summaryLabel}>Entry Price: <Text style={styles.summaryValue}>${selectedTrade.entryPrice?.toFixed(2)}</Text></Text>
                  <Text style={styles.summaryLabel}>Quantity: <Text style={styles.summaryValue}>{selectedTrade.quantity}</Text></Text>
                  <Text style={styles.summaryLabel}>Leverage: <Text style={styles.summaryValue}>{selectedTrade.leverage}x</Text></Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Exit Price (leave empty for market price)</Text>
                  <TextInput
                    style={styles.input}
                    value={exitPrice}
                    onChangeText={setExitPrice}
                    placeholder="Enter exit price or leave empty"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => { setShowCloseModal(false); setSelectedTrade(null); }}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Close Trade"
                    onPress={handleCloseTrade}
                    variant="danger"
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '20', borderRadius: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  filterBar: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: Colors.background },
  filterButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  filterButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.text },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },
  tradeCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  tradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tradeUser: { fontSize: 16, fontWeight: '600', color: Colors.text },
  tradeEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  tradeInfo: { marginBottom: 12 },
  tradeSymbol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbolText: { fontSize: 18, fontWeight: '600', color: Colors.text },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 11, fontWeight: '600' },
  tradeDetails: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pnlValue: { fontSize: 16, fontWeight: 'bold' },
  tradeFooter: { gap: 4, marginBottom: 12 },
  tradeDate: { fontSize: 12, color: Colors.textSecondary },
  closeTradeButton: { marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  modalBody: { padding: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontSize: 16 },
  chipContainer: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.text },
  typeSelector: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  buyButtonActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  sellButtonActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  typeButtonText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  row: { flexDirection: 'row', gap: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  tradeSummary: { backgroundColor: Colors.background, padding: 16, borderRadius: 12, marginBottom: 20 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  summaryValue: { fontWeight: '600', color: Colors.text },
});
