import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { adminAPI } from '../../utils/api';

export default function AdminWithdrawalsScreen() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      const response = await adminAPI.getPendingWithdrawals();
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWithdrawals();
    setRefreshing(false);
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedWithdrawal) return;
    
    setLoading(true);
    try {
      await adminAPI.reviewWithdrawal({
        withdrawalId: selectedWithdrawal.id,
        action,
        note: action === 'reject' ? 'Cannot process withdrawal' : 'Withdrawal processed successfully'
      });
      Alert.alert('Success', `Withdrawal ${action}d successfully${action === 'reject' ? '. Balance refunded to user.' : ''}`);
      setShowModal(false);
      setSelectedWithdrawal(null);
      loadWithdrawals();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || `Failed to ${action} withdrawal`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawal Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {withdrawals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="arrow-up-circle-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No pending withdrawals</Text>
          </View>
        ) : (
          withdrawals.map((withdrawal: any) => (
            <TouchableOpacity
              key={withdrawal.id}
              style={styles.withdrawalCard}
              onPress={() => {
                setSelectedWithdrawal(withdrawal);
                setShowModal(true);
              }}
            >
              <View style={styles.withdrawalHeader}>
                <View>
                  <Text style={styles.withdrawalUser}>{withdrawal.userName}</Text>
                  <Text style={styles.withdrawalEmail}>{withdrawal.userEmail}</Text>
                </View>
                <Text style={styles.withdrawalAmount}>${withdrawal.amount.toFixed(2)}</Text>
              </View>
              <View style={styles.bankInfo}>
                <Ionicons name="card" size={16} color={Colors.textSecondary} />
                <Text style={styles.bankName}>{withdrawal.bankDetails?.bankName || 'Bank details'}</Text>
              </View>
              <Text style={styles.withdrawalDate}>
                {new Date(withdrawal.createdAt).toLocaleString()}
              </Text>
              <View style={styles.withdrawalActions}>
                <Ionicons name="eye" size={20} color={Colors.primary} />
                <Text style={styles.viewText}>Tap to review & process</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Withdrawal</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setSelectedWithdrawal(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedWithdrawal && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.userInfo}>
                  <Text style={styles.userInfoLabel}>User:</Text>
                  <Text style={styles.userInfoValue}>{selectedWithdrawal.userName}</Text>
                  <Text style={styles.userInfoEmail}>{selectedWithdrawal.userEmail}</Text>
                </View>

                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Withdrawal Amount</Text>
                  <Text style={styles.amountValue}>${selectedWithdrawal.amount.toFixed(2)}</Text>
                  <Text style={styles.amountNote}>Already deducted from user wallet</Text>
                </View>

                {selectedWithdrawal.bankDetails && (
                  <View style={styles.bankDetailsCard}>
                    <Text style={styles.bankDetailsTitle}>Bank Account Details:</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Account Holder:</Text>
                      <Text style={styles.detailValue}>{selectedWithdrawal.bankDetails.accountName}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Account Number:</Text>
                      <Text style={styles.detailValue}>{selectedWithdrawal.bankDetails.accountNumber}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bank Name:</Text>
                      <Text style={styles.detailValue}>{selectedWithdrawal.bankDetails.bankName}</Text>
                    </View>
                    {selectedWithdrawal.bankDetails.iban && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>IBAN:</Text>
                        <Text style={styles.detailValue}>{selectedWithdrawal.bankDetails.iban}</Text>
                      </View>
                    )}
                    {selectedWithdrawal.bankDetails.swiftCode && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>SWIFT/BIC:</Text>
                        <Text style={styles.detailValue}>{selectedWithdrawal.bankDetails.swiftCode}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={24} color={Colors.danger} />
                  <Text style={styles.warningText}>
                    Rejecting will refund ${selectedWithdrawal.amount.toFixed(2)} back to user's wallet.
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <Button
                    title="Reject & Refund"
                    onPress={() => handleReview('reject')}
                    variant="danger"
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Approve & Complete"
                    onPress={() => handleReview('approve')}
                    variant="success"
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
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
  withdrawalCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  withdrawalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  withdrawalUser: { fontSize: 18, fontWeight: '600', color: Colors.text },
  withdrawalEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  withdrawalAmount: { fontSize: 24, fontWeight: 'bold', color: Colors.danger },
  bankInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  bankName: { fontSize: 14, color: Colors.textSecondary },
  withdrawalDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  withdrawalActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  modalBody: { padding: 20 },
  userInfo: { marginBottom: 20, padding: 16, backgroundColor: Colors.background, borderRadius: 12 },
  userInfoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  userInfoValue: { fontSize: 18, fontWeight: '600', color: Colors.text },
  userInfoEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  amountCard: { marginBottom: 20, padding: 20, backgroundColor: Colors.danger + '20', borderRadius: 12, alignItems: 'center' },
  amountLabel: { fontSize: 14, color: Colors.danger, marginBottom: 4 },
  amountValue: { fontSize: 32, fontWeight: 'bold', color: Colors.danger },
  amountNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  bankDetailsCard: { marginBottom: 20, padding: 16, backgroundColor: Colors.background, borderRadius: 12 },
  bankDetailsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right' },
  warningBox: { flexDirection: 'row', backgroundColor: Colors.danger + '20', padding: 16, borderRadius: 12, gap: 12, marginBottom: 20 },
  warningText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
});