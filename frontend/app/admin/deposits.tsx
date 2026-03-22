import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { adminAPI } from '../../utils/api';

export default function AdminDepositsScreen() {
  const router = useRouter();
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDeposits();
  }, []);

  const loadDeposits = async () => {
    try {
      const response = await adminAPI.getPendingDeposits();
      setDeposits(response.data);
    } catch (error) {
      console.error('Error loading deposits:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeposits();
    setRefreshing(false);
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedDeposit) return;
    
    setLoading(true);
    try {
      await adminAPI.reviewDeposit({
        depositId: selectedDeposit.id,
        action,
        note: action === 'reject' ? 'Payment verification failed' : 'Payment verified'
      });
      Alert.alert('Success', `Deposit ${action}d successfully${action === 'approve' ? '. Balance added to user wallet.' : ''}`);
      setShowModal(false);
      setSelectedDeposit(null);
      loadDeposits();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || `Failed to ${action} deposit`);
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
        <Text style={styles.title}>Deposit Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {deposits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No pending deposits</Text>
          </View>
        ) : (
          deposits.map((deposit: any) => (
            <TouchableOpacity
              key={deposit.id}
              style={styles.depositCard}
              onPress={() => {
                setSelectedDeposit(deposit);
                setShowModal(true);
              }}
            >
              <View style={styles.depositHeader}>
                <View>
                  <Text style={styles.depositUser}>{deposit.userName}</Text>
                  <Text style={styles.depositEmail}>{deposit.userEmail}</Text>
                </View>
                <Text style={styles.depositAmount}>${deposit.amount.toFixed(2)}</Text>
              </View>
              <View style={styles.depositInfo}>
                <View style={styles.methodBadge}>
                  <Text style={styles.methodText}>{deposit.method.toUpperCase()}</Text>
                </View>
                <Text style={styles.depositDate}>
                  {new Date(deposit.createdAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.depositActions}>
                <Ionicons name="eye" size={20} color={Colors.primary} />
                <Text style={styles.viewText}>Tap to review payment</Text>
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
              <Text style={styles.modalTitle}>Review Deposit</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setSelectedDeposit(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedDeposit && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.userInfo}>
                  <Text style={styles.userInfoLabel}>User:</Text>
                  <Text style={styles.userInfoValue}>{selectedDeposit.userName}</Text>
                  <Text style={styles.userInfoEmail}>{selectedDeposit.userEmail}</Text>
                </View>

                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Deposit Amount</Text>
                  <Text style={styles.amountValue}>${selectedDeposit.amount.toFixed(2)}</Text>
                </View>

                <View style={styles.methodInfo}>
                  <Text style={styles.methodLabel}>Payment Method:</Text>
                  <Text style={styles.methodValue}>{selectedDeposit.method.toUpperCase()}</Text>
                </View>

                <View style={styles.imageContainer}>
                  <Text style={styles.imageLabel}>Payment Screenshot:</Text>
                  <Image
                    source={{ uri: selectedDeposit.screenshot }}
                    style={styles.screenshotImage}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={24} color={Colors.warning} />
                  <Text style={styles.warningText}>
                    Approving will add ${selectedDeposit.amount.toFixed(2)} to user's wallet balance.
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <Button
                    title="Reject"
                    onPress={() => handleReview('reject')}
                    variant="danger"
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Approve & Add Balance"
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
  depositCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  depositHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  depositUser: { fontSize: 18, fontWeight: '600', color: Colors.text },
  depositEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  depositAmount: { fontSize: 24, fontWeight: 'bold', color: Colors.success },
  depositInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  methodBadge: { backgroundColor: Colors.secondary + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  methodText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  depositDate: { fontSize: 12, color: Colors.textSecondary },
  depositActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  amountCard: { marginBottom: 20, padding: 20, backgroundColor: Colors.success + '20', borderRadius: 12, alignItems: 'center' },
  amountLabel: { fontSize: 14, color: Colors.success, marginBottom: 4 },
  amountValue: { fontSize: 32, fontWeight: 'bold', color: Colors.success },
  methodInfo: { marginBottom: 20 },
  methodLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  methodValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  imageContainer: { marginBottom: 20 },
  imageLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  screenshotImage: { width: '100%', height: 300, backgroundColor: Colors.background, borderRadius: 12 },
  warningBox: { flexDirection: 'row', backgroundColor: Colors.warning + '20', padding: 16, borderRadius: 12, gap: 12, marginBottom: 20 },
  warningText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
});