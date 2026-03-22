import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { adminAPI } from '../../utils/api';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [walletAction, setWalletAction] = useState<'add' | 'deduct'>('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleToggleBlock = async (userId: string, isBlocked: boolean) => {
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      isBlocked ? 'Are you sure you want to unblock this user?' : 'Are you sure you want to block this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminAPI.manageUser({
                userId,
                action: isBlocked ? 'unblock' : 'block'
              });
              Alert.alert('Success', `User ${isBlocked ? 'unblocked' : 'blocked'} successfully`);
              loadUsers();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to update user');
            }
          }
        }
      ]
    );
  };

  const openWalletModal = (user: any, action: 'add' | 'deduct') => {
    setSelectedUser(user);
    setWalletAction(action);
    setWalletAmount('');
    setWalletNote('');
    setShowWalletModal(true);
  };

  const handleWalletUpdate = async () => {
    if (!walletAmount || parseFloat(walletAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.updateWallet({
        userId: selectedUser.id,
        action: walletAction,
        amount: parseFloat(walletAmount),
        note: walletNote
      });
      Alert.alert('Success', response.data.message);
      setShowWalletModal(false);
      loadUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update wallet');
    } finally {
      setLoading(false);
    }
  };

  const getKYCColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.danger;
      default: return Colors.warning;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>User Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          users.map((user: any) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={32} color={Colors.primary} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.userBadges}>
                    <View style={[styles.kycBadge, { backgroundColor: getKYCColor(user.kycStatus) + '20' }]}>
                      <Text style={[styles.kycText, { color: getKYCColor(user.kycStatus) }]}>
                        KYC: {user.kycStatus.toUpperCase()}
                      </Text>
                    </View>
                    {user.isBlocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedText}>BLOCKED</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.userStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Balance</Text>
                  <Text style={styles.statValue}>${user.walletBalance?.toFixed(2) || '0.00'}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Joined</Text>
                  <Text style={styles.statValue}>{new Date(user.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>

              {/* Wallet Control Buttons */}
              <View style={styles.walletActions}>
                <TouchableOpacity
                  style={[styles.walletButton, styles.addButton]}
                  onPress={() => openWalletModal(user, 'add')}
                >
                  <Ionicons name="add-circle" size={20} color={Colors.success} />
                  <Text style={[styles.walletButtonText, { color: Colors.success }]}>Add Balance</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.walletButton, styles.deductButton]}
                  onPress={() => openWalletModal(user, 'deduct')}
                >
                  <Ionicons name="remove-circle" size={20} color={Colors.danger} />
                  <Text style={[styles.walletButtonText, { color: Colors.danger }]}>Deduct</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.userActions}>
                <Button
                  title={user.isBlocked ? 'Unblock User' : 'Block User'}
                  onPress={() => handleToggleBlock(user.id, user.isBlocked)}
                  variant={user.isBlocked ? 'success' : 'danger'}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Wallet Update Modal */}
      <Modal visible={showWalletModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {walletAction === 'add' ? 'Add Balance' : 'Deduct Balance'}
              </Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.modalBody}>
                <View style={styles.userSummary}>
                  <Text style={styles.summaryLabel}>User:</Text>
                  <Text style={styles.summaryValue}>{selectedUser.name}</Text>
                  <Text style={styles.summaryLabel}>Current Balance:</Text>
                  <Text style={styles.summaryBalance}>${selectedUser.walletBalance?.toFixed(2) || '0.00'}</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={walletAmount}
                    onChangeText={setWalletAmount}
                    placeholder="Enter amount"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Note (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.noteInput]}
                    value={walletNote}
                    onChangeText={setWalletNote}
                    placeholder="Reason for adjustment"
                    placeholderTextColor={Colors.textSecondary}
                    multiline
                  />
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => setShowWalletModal(false)}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={walletAction === 'add' ? 'Add Balance' : 'Deduct Balance'}
                    onPress={handleWalletUpdate}
                    variant={walletAction === 'add' ? 'success' : 'danger'}
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
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },
  userCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  userHeader: { flexDirection: 'row', marginBottom: 16 },
  userAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  userBadges: { flexDirection: 'row', gap: 8 },
  kycBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  kycText: { fontSize: 11, fontWeight: '600' },
  blockedBadge: { backgroundColor: Colors.danger + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  blockedText: { fontSize: 11, fontWeight: '600', color: Colors.danger },
  userStats: { flexDirection: 'row', marginBottom: 12, gap: 16 },
  statItem: { flex: 1, padding: 12, backgroundColor: Colors.background, borderRadius: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  walletActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  walletButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  addButton: { backgroundColor: Colors.success + '15', borderWidth: 1, borderColor: Colors.success + '30' },
  deductButton: { backgroundColor: Colors.danger + '15', borderWidth: 1, borderColor: Colors.danger + '30' },
  walletButtonText: { fontSize: 14, fontWeight: '600' },
  userActions: { flexDirection: 'row', gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  modalBody: { padding: 20 },
  userSummary: { backgroundColor: Colors.background, padding: 16, borderRadius: 12, marginBottom: 20 },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  summaryBalance: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontSize: 16 },
  noteInput: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});