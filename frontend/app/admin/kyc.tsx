import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { adminAPI } from '../../utils/api';

export default function AdminKYCScreen() {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await adminAPI.getPendingKYC();
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading KYC documents:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedDoc) return;
    
    setLoading(true);
    try {
      await adminAPI.reviewKYC({
        documentId: selectedDoc.id,
        action,
        note: action === 'reject' ? 'Document not clear or invalid' : 'Verified successfully'
      });
      Alert.alert('Success', `Document ${action}d successfully`);
      setShowModal(false);
      setSelectedDoc(null);
      loadDocuments();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || `Failed to ${action} document`);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pan': return 'PAN Card';
      case 'idproof': return 'ID Proof';
      default: return type.toUpperCase();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>KYC Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No pending KYC documents</Text>
          </View>
        ) : (
          documents.map((doc: any) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docCard}
              onPress={() => {
                setSelectedDoc(doc);
                setShowModal(true);
              }}
            >
              <View style={styles.docHeader}>
                <View>
                  <Text style={styles.docUser}>{doc.userName}</Text>
                  <Text style={styles.docEmail}>{doc.userEmail}</Text>
                </View>
                <View style={styles.docTypeBadge}>
                  <Text style={styles.docTypeText}>{getTypeLabel(doc.type)}</Text>
                </View>
              </View>
              <Text style={styles.docDate}>
                Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
              </Text>
              <View style={styles.docActions}>
                <Ionicons name="eye" size={20} color={Colors.primary} />
                <Text style={styles.viewText}>Tap to review</Text>
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
              <Text style={styles.modalTitle}>Review Document</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setSelectedDoc(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedDoc && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.userInfo}>
                  <Text style={styles.userInfoLabel}>User:</Text>
                  <Text style={styles.userInfoValue}>{selectedDoc.userName}</Text>
                  <Text style={styles.userInfoEmail}>{selectedDoc.userEmail}</Text>
                </View>

                <View style={styles.docInfo}>
                  <Text style={styles.docInfoLabel}>Document Type:</Text>
                  <Text style={styles.docInfoValue}>{getTypeLabel(selectedDoc.type)}</Text>
                </View>

                <View style={styles.imageContainer}>
                  <Text style={styles.imageLabel}>Document Image:</Text>
                  <Image
                    source={{ uri: selectedDoc.fileData }}
                    style={styles.docImage}
                    resizeMode="contain"
                  />
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
                    title="Approve"
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
  docCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  docUser: { fontSize: 18, fontWeight: '600', color: Colors.text },
  docEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  docTypeBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  docTypeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  docDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  docInfo: { marginBottom: 20 },
  docInfoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  docInfoValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  imageContainer: { marginBottom: 20 },
  imageLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  docImage: { width: '100%', height: 300, backgroundColor: Colors.background, borderRadius: 12 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
});