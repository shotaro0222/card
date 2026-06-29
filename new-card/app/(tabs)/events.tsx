import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, ScrollView, SafeAreaView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';

export default function EventsScreen() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ページネーション用のステート
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // モーダル（詳細表示）用のステート
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const fetchEvents = async () => {
    setLoading(true);
    setCurrentPage(1); // データ再取得時に1ページ目に戻す

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, location')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('お知らせの取得に失敗しました:', error);
        return;
      }

      if (data) {
        const filteredData = data.filter((ann: any) => {
          if (!profile) {
            return ann.target_gender === 'ALL' && ann.target_age === 'ALL' && (!ann.target_location || ann.target_location === '');
          }
          if (ann.target_gender && ann.target_gender !== 'ALL') {
            const isMale = profile.gender === 'male' || profile.gender === '男性';
            const isFemale = profile.gender === 'female' || profile.gender === '女性';
            if (ann.target_gender === 'MALE' && !isMale) return false;
            if (ann.target_gender === 'FEMALE' && !isFemale) return false;
          }
          if (ann.target_age && ann.target_age !== 'ALL') {
            const age = parseInt(profile.age) || 0;
            if (ann.target_age === 'TEENS' && !(age > 0 && age < 20)) return false;
            if (ann.target_age === 'TWENTIES' && !(age >= 20 && age < 30)) return false;
            if (ann.target_age === 'THIRTIES' && !(age >= 30)) return false;
          }
          if (ann.target_location && ann.target_location !== '') {
            if (!profile.location || !profile.location.includes(ann.target_location)) return false;
          }
          return true;
        });
        setAllEvents(filteredData);
      }
    } catch (err) {
      console.log('お知らせ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventPress = (item: any) => {
    setSelectedEvent(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedEvent(null);
  };

  const renderEvent = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => handleEventPress(item)} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('ja-JP')}</Text>
      </View>
    </TouchableOpacity>
  );

  const displayEvents = allEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(allEvents.length / ITEMS_PER_PAGE) || 1;

  const renderPagination = () => {
    if (allEvents.length <= ITEMS_PER_PAGE) return null;
    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
          disabled={currentPage === 1}
          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        >
          <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>前へ</Text>
        </TouchableOpacity>
        
        <Text style={styles.pageInfo}>{currentPage} / {totalPages}</Text>
        
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
          disabled={currentPage === totalPages}
          onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        >
          <Text style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}>次へ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#f87171" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            style={{ flex: 1 }} // 💡追加: リスト自体を伸縮させてスクロール領域を確保
            data={displayEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderEvent}
            contentContainerStyle={{ padding: 15, paddingBottom: 40 }} // 💡変更: 下部の余白を増やして最下部まで見やすく
            ListEmptyComponent={<Text style={styles.emptyText}>現在届いているお知らせはありません。</Text>}
            ListFooterComponent={renderPagination}
          />
        )}

        {/* お知らせ詳細モーダル */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <X color="#94a3b8" size={28} />
              </TouchableOpacity>
              
              {selectedEvent && (
                // 💡追加: flexShrinkを加えることでModal内に収め、ScrollViewを機能させる
                <View style={{ flexShrink: 1 }}>
                  <ScrollView 
                    showsVerticalScrollIndicator={true} // 💡変更: スクロール可能なことを視覚的にわかりやすくする
                    contentContainerStyle={{ paddingBottom: 30 }} // 💡追加: 最後までスクロールした時の余白を確保
                  >
                    <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                    <Text style={styles.modalDate}>{new Date(selectedEvent.created_at).toLocaleDateString('ja-JP')}</Text>
                    
                    {selectedEvent.image_url && (
                      <Image source={{ uri: selectedEvent.image_url }} style={styles.modalImage} />
                    )}
                    
                    <Text style={styles.modalBody}>{selectedEvent.body}</Text>
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  eventCard: { 
    backgroundColor: '#0f172a', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#1e293b' 
  },
  header: { flexDirection: 'column', justifyContent: 'center' },
  title: { color: '#f87171', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  date: { color: '#64748b', fontSize: 12 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 50 },
  
  // ページネーション用スタイル
  paginationContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 20 
  },
  pageButton: { 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginHorizontal: 16 
  },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 14 },
  pageButtonTextDisabled: { color: '#64748b' },
  pageInfo: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold' },

  // モーダル用スタイル
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.75)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  modalContent: { 
    backgroundColor: '#0f172a', 
    borderRadius: 16, 
    padding: 20, 
    width: '100%', 
    maxHeight: '85%', 
    flexShrink: 1, // 💡追加: 中身が溢れた際に縮むことを許可し、ScrollViewを動かす
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  closeButton: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  modalTitle: { color: '#f87171', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalDate: { color: '#64748b', fontSize: 13, marginBottom: 20 },
  modalImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 20, resizeMode: 'cover', backgroundColor: '#000' },
  modalBody: { color: '#cbd5e1', fontSize: 15, lineHeight: 26, paddingBottom: 20 }
});
