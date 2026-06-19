import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, SafeAreaView, Alert, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
// 💡 Xシェア用にLinkingを追加（Twitterアイコンのインポートはエラー原因のため削除）
import * as Linking from 'expo-linking';

// デッキの最大枚数
const MAX_DECK_SIZE = 5;

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
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setCards(data);
    } else {
      console.error("図鑑取得エラー:", error);
    }
    setLoading(false);
  };

  // 複数枚デッキの編成ロジック
  const toggleDeckCard = async (card: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 現在デッキに入っている枚数をカウント
    const currentDeckCount = cards.filter(c => c.is_active).length;

    if (!card.is_active) {
      // 追加しようとした時、すでに5枚なら弾く
      if (currentDeckCount >= MAX_DECK_SIZE) {
        Alert.alert('デッキ上限', `出撃できるカードは最大${MAX_DECK_SIZE}枚までです。別のカードを外してください。`);
        return;
      }
      // 出撃状態にする
      await supabase.from('cards').update({ is_active: true }).eq('id', card.id);
    } else {
      // 既に出撃中なら外す
      await supabase.from('cards').update({ is_active: false }).eq('id', card.id);
    }
    
    // リロードして画面に反映
    fetchCards();
  };

  const launchAR = (url: string) => {
    setCurrentArUrl(url);
    setArModalVisible(true);
  };

  // 💡 X（Twitter）へのシェア機能
  const shareToX = async (card: any) => {
    const text = `「${card.card_name || '名称不明'}」を図鑑に登録中！\n属性: ${card.element || '無'} | レア: ${card.rarity || 'N'}\n#SnapCard`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(card.image_url || '')}`;
    
    try {
      await Linking.openURL(url);
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('エラー: Xを開けませんでした。');
      } else {
        Alert.alert('エラー', 'Xを開けませんでした。');
      }
    }
  };

  // デッキに編成されているカードを抽出し、5枠の配列を生成
  const deckCards = cards.filter(c => c.is_active);
  const deckSlots = Array(MAX_DECK_SIZE).fill(null).map((_, index) => deckCards[index] || null);

  const renderCard = ({ item }: { item: any }) => {
    const safeLevel = item.level || 1;
    const safeExp = item.exp || 0;
    const nextLevelExp = safeLevel * 100;
    const progressPercent = Math.min(100, Math.max(0, (safeExp / nextLevelExp) * 100));
    const isSupport = item.card_role === 'support';

    let customDesign: any = {};
    try {
      if (item.custom_design) {
        customDesign = JSON.parse(item.custom_design);
      }
    } catch (e) {
      console.warn('カスタムデザインの読み込みに失敗しました', e);
    }

    return (
      <View style={[
        styles.card, 
        item.is_active && styles.activeCard, 
        item.is_fixed && styles.sponsorCard,
        customDesign.frameColor && { borderColor: customDesign.frameColor, borderWidth: 4 },
        customDesign.backgroundColor && { backgroundColor: customDesign.backgroundColor }
      ]}>
        
        {customDesign.effect === 'sparkle' && (
          <View style={styles.sparkleOverlay} pointerEvents="none" />
        )}
        {customDesign.theme === 'dark' && (
          <View style={styles.darkOverlay} pointerEvents="none" />
        )}

        <View style={styles.cardHeader}>
          <Text style={[
            styles.cardName, 
            customDesign.textColor && { color: customDesign.textColor }
          ]} numberOfLines={1}>
            {item.is_fixed ? '🌟 ' : ''}{item.card_name || '名称不明'}
          </Text>
          <View style={[
            styles.rarityBadge,
            customDesign.rarityBgColor && { backgroundColor: customDesign.rarityBgColor }
          ]}>
            <Text style={styles.rarityText}>{item.rarity || 'N'}</Text>
          </View>
        </View>
        
        <Image 
          source={{ uri: item.image_url || 'https://via.placeholder.com/400' }} 
          style={styles.cardImage} 
        />

        <View style={styles.levelContainer}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelText}>レベル {safeLevel}</Text>
            <Text style={styles.expText}>あと {nextLevelExp - safeExp} EXP</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={[styles.roleBadge, isSupport ? styles.roleSupport : styles.roleAttacker]}>
            <Text style={styles.roleText}>{isSupport ? '🛡️ サポート' : '⚔️ アタッカー'}</Text>
          </View>
          <Text style={[
            styles.skillText,
            customDesign.textColor && { color: customDesign.textColor }
          ]}> 技: {item.skill_name || '通常攻撃'}</Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statLabel}>HP</Text><Text style={styles.statValue}>{item.status_hp || 100}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>ATK</Text><Text style={styles.statValue}>{item.status_atk || 10}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>DEF</Text><Text style={styles.statValue}>{item.status_def || 10}</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>SPD</Text><Text style={styles.statValue}>{item.status_spd || 10}</Text></View>
        </View>

        {item.ar_model_url && (
          <TouchableOpacity style={styles.arBtn} onPress={() => launchAR(item.ar_model_url)}>
            <Text style={styles.arBtnText}>🌐 ARで現実に出現させる</Text>
          </TouchableOpacity>
        )}

        {/* 💡 アイコンの代わりに「𝕏」の文字を使用しエラーを回避 */}
        <TouchableOpacity style={styles.xShareBtn} onPress={() => shareToX(item)} activeOpacity={0.8}>
          <Text style={styles.xIconText}>𝕏</Text>
          <Text style={styles.xShareBtnText}>でシェアする</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.equipBtn, item.is_active && styles.equippedBtn]} 
          onPress={() => toggleDeckCard(item)}
        >
          <Text style={[styles.equipBtnText, item.is_active && styles.equippedBtnText]}>
            {item.is_active ? '✅ デッキから外す' : '➕ デッキに編成する'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CARD DECK</Text>
        <Text style={styles.headerSub}>バトルデッキ編成</Text>
      </View>

      <View style={styles.deckSlotsWrapper}>
        <View style={styles.deckSlotsHeader}>
          <Text style={styles.deckSlotsTitle}>現在の部隊</Text>
          <Text style={styles.deckSlotsCount}>{deckCards.length} / {MAX_DECK_SIZE}</Text>
        </View>
        
        <View style={styles.slotsContainer}>
          {deckSlots.map((card, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.slot, card ? styles.slotFilled : styles.slotEmpty]}
              onPress={() => card && toggleDeckCard(card)}
              disabled={!card}
              activeOpacity={0.7}
            >
              {card ? (
                <>
                  <Image source={{ uri: card.image_url }} style={styles.slotImage} />
                  <View style={styles.slotRemoveBadge}>
                    <Text style={styles.slotRemoveText}>−</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.slotEmptyText}>空き</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id.toString()}
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
            /* 💡 Web環境でのクラッシュ対策としてiframeにフォールバック */
            Platform.OS === 'web' ? (
              <iframe 
                src={currentArUrl} 
                style={{ flex: 1, width: '100%', height: '100%', border: 'none' }} 
                allow="camera; microphone"
              />
            ) : (
              <WebView source={{ uri: currentArUrl }} style={{ flex: 1 }} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} />
            )
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '700' },
  
  deckSlotsWrapper: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, zIndex: 10 },
  deckSlotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deckSlotsTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  deckSlotsCount: { fontSize: 14, fontWeight: '800', color: '#3B82F6' },
  slotsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: 56, height: 80, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  slotEmpty: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderStyle: 'dashed' },
  slotFilled: { backgroundColor: '#0F172A', borderColor: '#3B82F6' },
  slotEmptyText: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  slotImage: { width: '100%', height: '100%', borderRadius: 6, resizeMode: 'cover' },
  slotRemoveBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFFFFF' },
  slotRemoveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', lineHeight: 14 },

  card: { position: 'relative', overflow: 'hidden', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  activeCard: { borderColor: '#3B82F6', borderWidth: 2, shadowColor: '#3B82F6', shadowOpacity: 0.15 },
  sponsorCard: { borderColor: '#F59E0B', borderWidth: 2 },
  
  sparkleOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 215, 0, 0.1)', zIndex: 0 },
  darkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 0 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 1 },
  cardName: { color: '#0F172A', fontWeight: '800', fontSize: 18, flex: 1 },
  rarityBadge: { backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  rarityText: { color: '#D97706', fontWeight: '800', fontSize: 12 },
  
  cardImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 15, backgroundColor: '#F1F5F9', zIndex: 1 },
  
  levelContainer: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, zIndex: 1 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  levelText: { color: '#2563EB', fontWeight: '900', fontSize: 14 },
  expText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#3B82F6', borderRadius: 4 },

  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roleAttacker: { backgroundColor: '#FEE2E2' },
  roleSupport: { backgroundColor: '#DCFCE7' },
  roleText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  
  skillText: { color: '#475569', fontSize: 13, fontWeight: '700', marginLeft: 8, zIndex: 1 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, zIndex: 1 },
  statBox: { alignItems: 'center', backgroundColor: '#F8FAFC', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', flex: 1, marginHorizontal: 2 },
  statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  statValue: { color: '#0F172A', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  
  arBtn: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, zIndex: 1 },
  arBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  xShareBtn: { flexDirection: 'row', backgroundColor: '#0F1419', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333333', marginBottom: 12, zIndex: 1 },
  xIconText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  xShareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  
  equipBtn: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, alignItems: 'center', zIndex: 1 },
  equipBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 },
  equippedBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 },
  equippedBtnText: { color: '#2563EB' },
  
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 50, fontWeight: '600', fontSize: 14 },
  
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  closeBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  closeBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 }
});