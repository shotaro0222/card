import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';

export default function DeckScreen() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArModalVisible, setArModalVisible] = useState(false);
  const [currentArUrl, setCurrentArUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => { fetchCards(); }, [])
  );

  const fetchCards = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
      
    if (!error && data) setCards(data);
    setLoading(false);
  };

  const setActiveCard = async (cardId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('cards').update({ is_active: false }).eq('player_id', user.id);
    await supabase.from('cards').update({ is_active: true }).eq('id', cardId);
    fetchCards();
  };

  const launchAR = (url: string) => {
    setCurrentArUrl(url);
    setArModalVisible(true);
  };

  const renderCard = ({ item }: { item: any }) => {
    // 1レベルごとに必要な経験値（レベル × 100）
    const nextLevelExp = item.level * 100;
    // 進行バーの割合計算（安全に0〜100%に収める）
    const progressPercent = Math.min(100, Math.max(0, (item.exp / nextLevelExp) * 100));

    return (
      <View style={[styles.card, item.is_active && styles.activeCard, item.is_fixed && styles.sponsorCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.is_fixed ? '🌟 ' : ''}{item.card_name}
          </Text>
          <div style={styles.rarityBadge}>
            <Text style={styles.rarityText}>{item.rarity}</Text>
          </div>
        </View>
        
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />

        {/* 📈 【新規】老若男女対応・ビジュアルレベルメーター */}
        <View style={styles.levelContainer}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelText}>レベル {item.level}</Text>
            <Text style={styles.expText}>あと {nextLevelExp - item.exp} EXP で成長（{item.exp} / {nextLevelExp}）</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        
        <Text style={styles.skillText}>必殺技: {item.skill_name}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statLabel}>HP</Text><Text style={styles.statValue}>{item.status_hp}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>ATK</Text><Text style={styles.statValue}>{item.status_atk}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>DEF</Text><Text style={styles.statValue}>{item.status_def}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>SPD</Text><Text style={styles.statValue}>{item.status_spd}</Text></View>
        </View>

        {item.ar_model_url && (
          <TouchableOpacity style={styles.arBtn} onPress={() => launchAR(item.ar_model_url)}>
            <Text style={styles.arBtnText}>🌐 ARで現実に出現させる</Text>
          </TouchableOpacity>
        )}

        {!item.is_active ? (
          <TouchableOpacity style={styles.equipBtn} onPress={() => setActiveCard(item.id)}>
            <Text style={styles.equipBtnText}>冒険に出撃させる</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeLabel}><Text style={styles.activeLabelText}>出撃中</Text></View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CARD COLLECTION</Text>
        <Text style={styles.headerSub}>あなたのコレクション図鑑</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.emptyText}>カードがありません。「カード化」からカメラを起動しましょう。</Text>}
        />
      )}

      {/* ARモーダル */}
      <Modal visible={isArModalVisible} animationType="slide" onRequestClose={() => setArModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AR Viewer</Text>
            <TouchableOpacity onPress={() => setArModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
          {currentArUrl && (
            <WebView source={{ uri: currentArUrl }} style={{ flex: 1 }} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },
  
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  activeCard: { borderColor: '#3B82F6', borderWidth: 2, shadowColor: '#3B82F6', shadowOpacity: 0.15 },
  sponsorCard: { borderColor: '#F59E0B', borderWidth: 2 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { color: '#0F172A', fontWeight: '800', fontSize: 18, flex: 1 },
  rarityBadge: { backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  rarityText: { color: '#D97706', fontWeight: '800', fontSize: 12 },
  
  cardImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 15, backgroundColor: '#F1F5F9' },
  
  // 📈 レベル・経験値メーターのユニバーサルスタイル
  levelContainer: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  levelText: { color: '#2563EB', fontWeight: '900', fontSize: 14 },
  expText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#3B82F6', borderRadius: 4 },

  skillText: { color: '#475569', fontSize: 14, marginBottom: 16, fontWeight: '700', marginLeft: 4 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { alignItems: 'center', backgroundColor: '#F8FAFC', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  statValue: { color: '#0F172A', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  
  equipBtn: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, alignItems: 'center' },
  equipBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 },
  activeLabel: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  activeLabelText: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  
  arBtn: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  arBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 50, fontWeight: '600', fontSize: 14 },
  
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  closeBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  closeBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 }
});
