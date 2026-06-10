import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function TradeScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market'); // market, my_trades, matches
  const [userId, setUserId] = useState<string | null>(null);

  // データ状態
  const [marketListings, setMarketListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [myDeck, setMyDeck] = useState<any[]>([]);

  // 出品フォーム用モーダル
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedCardForTrade, setSelectedCardForTrade] = useState<any>(null);
  const [desiredRarity, setDesiredRarity] = useState('SR');
  const [desiredRole, setDesiredRole] = useState('attacker');

  useFocusEffect(
    useCallback(() => {
      fetchTradeData();
    }, [activeTab])
  );

  const fetchTradeData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // 自分の控えカード取得
    const { data: myCards } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', false);
    if (myCards) setMyDeck(myCards);

    if (activeTab === 'market') {
      // 市場の出品取得
      const { data } = await supabase
        .from('trade_listings')
        .select(`id, desired_rarity, desired_role, cards (id, card_name, image_url, rarity, card_role, status_total)`)
        .neq('player_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (data) setMarketListings(data);

    } else if (activeTab === 'my_trades') {
      // 自分の出品取得
      const { data } = await supabase
        .from('trade_listings')
        .select(`id, status, desired_rarity, desired_role, cards (id, card_name, image_url, rarity)`)
        .eq('player_id', user.id)
        .eq('status', 'open');
      if (data) setMyListings(data);

    } else if (activeTab === 'matches') {
      // 💡【新規：自動マッチング通知の取得】
      // 自分がプレイヤーA、またはプレイヤーBとして関わっている成立中のマッチを取得
      const { data } = await supabase
        .from('trade_matches')
        .select(`
          id, status, player_a_id, player_b_id,
          listing_a:listing_a_id ( id, cards (id, card_name, image_url, rarity) ),
          listing_b:listing_b_id ( id, cards (id, card_name, image_url, rarity) )
        `)
        .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`)
        .eq('status', 'matching');
      if (data) setActiveMatches(data);
    }

    setLoading(false);
  };

  // 💡【新規：出品 ＆ 同質カードの自動マッチング検出ロジック】
  const handleCreateListing = async () => {
    if (!selectedCardForTrade || !userId) return;

    setLoading(true);
    // 1. 市場に出品を登録
    const { data: newListing, error: listError } = await supabase
      .from('trade_listings')
      .insert([{
        player_id: userId,
        card_id: selectedCardForTrade.id,
        desired_rarity: desiredRarity,
        desired_role: desiredRole,
        status: 'open'
      }])
      .select()
      .single();

    if (listError || !newListing) {
      Alert.alert('出品失敗', listError?.message);
      setLoading(false);
      return;
    }

    // 2. 自動マッチングのアルゴリズム走査
    // 「相手が出品したカード」が「自分の希望条件」に合い、かつ「相手の希望条件」が「自分のカード」に合うものを探す
    const { data: matchTarget } = await supabase
      .from('trade_listings')
      .select('id, player_id, cards(rarity, card_role)')
      .neq('player_id', userId)
      .eq('status', 'open')
      .eq('desired_rarity', selectedCardForTrade.rarity) // 相手の希望が私のカードのレアリティ
      .eq('desired_role', selectedCardForTrade.card_role)   // 相手の希望が私のカードのロール
      .eq('cards.rarity', desiredRarity)                 // 私の希望が相手のカードのレアリティ
      .eq('cards.card_role', desiredRole)                 // 私の希望が相手のカードのロール
      .limit(1)
      .maybeSingle();

    if (matchTarget) {
      // 相互の条件が完全一致する「同質カード」を発見！マッチングテーブルに登録
      await supabase.from('trade_matches').insert([{
        listing_a_id: newListing.id,
        listing_b_id: matchTarget.id,
        player_a_id: userId,
        player_b_id: matchTarget.player_id,
        status: 'matching'
      }]);
      Alert.alert('⚡マッチング即時検知！', 'あなたの希望条件と完全に一致するトレード出品が自動検出されました！「マッチング通知」タブを確認してください。');
    } else {
      Alert.alert('出品完了', '掲示板への登録が完了しました。条件に合うカードが出品されると自動マッチングされます。');
    }

    setCreateModalVisible(false);
    setSelectedCardForTrade(null);
    fetchTradeData();
  };

  // 💡【新規：マッチングの可否判断（承認・拒否）フロー】
  const handleResolveMatch = async (matchId: string, action: 'approved' | 'rejected', matchData: any) => {
    if (action === 'rejected') {
      await supabase.from('trade_matches').update({ status: 'rejected' }).eq('id', matchId);
      Alert.alert('拒否完了', 'このマッチング提案を破棄しました。');
      fetchTradeData();
      return;
    }

    // 承認時のカード所有権入れ替え処理
    setLoading(true);
    const cardA = matchData.listing_a.cards;
    const cardB = matchData.listing_b.cards;
    const playerA = matchData.player_a_id;
    const playerB = matchData.player_b_id;

    // AのカードをBへ、BのカードをAへトレード
    await supabase.from('cards').update({ player_id: playerB }).eq('id', cardA.id);
    await supabase.from('cards').update({ player_id: playerA }).eq('id', cardB.id);

    // 出品とマッチングのステータスをクローズ
    await supabase.from('trade_listings').update({ status: 'completed' }).in('id', [matchData.listing_a.id, matchData.listing_b.id]);
    await supabase.from('trade_matches').update({ status: 'approved' }).eq('id', matchId);

    Alert.alert('🎉 トレード成立！', '自動マッチングの承認が完了し、カードがあなたに転送されました！');
    fetchTradeData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MATCHING TRADE</Text>
        <Text style={styles.headerSub}>条件一致で自動通知される取引所</Text>
      </View>

      {/* タブ */}
      <View style={styles.tabContainer}>
        {['market', 'my_trades', 'matches'].map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t === 'market' ? '公開市場' : t === 'my_trades' ? '自分の出品' : '⚡ マッチング通知'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'market' && (
            <FlatList
              data={marketListings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModalVisible(true)}>
                  <Text style={styles.createBtnText}>➕ 条件を指定して新しく出品する</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <View style={styles.tradeCard}>
                  <Image source={{ uri: item.cards?.image_url }} style={styles.cardPreview} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.cards?.card_name}</Text>
                    <Text style={styles.cardStats}>保有カード: {item.cards?.rarity} ({item.cards?.card_role})</Text>
                    <View style={styles.desireTag}>
                      <Text style={styles.desireText}>求: {item.desired_rarity} / {item.desired_role}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
          )}

          {activeTab === 'my_trades' && (
            <FlatList
              data={myListings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={styles.tradeCard}>
                  <Image source={{ uri: item.cards?.image_url }} style={styles.cardPreview} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.cards?.card_name}</Text>
                    <Text style={styles.cardStats}>あなたの出品: {item.cards?.rarity}</Text>
                    <Text style={styles.matchConditionText}>自動マッチ設定 ➔ 求: {item.desired_rarity} ({item.desired_role})</Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* 💡【新規：マッチング通知ビュー】 */}
          {activeTab === 'matches' && (
            <FlatList
              data={activeMatches}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>現在、条件が合致した自動マッチング提案はありません。</Text>}
              renderItem={({ item }) => {
                const isAmIPlayerA = item.player_a_id === userId;
                const myMatchedCard = isAmIPlayerA ? item.listing_a.cards : item.listing_b.cards;
                const opponentCard = isAmIPlayerA ? item.listing_b.cards : item.listing_a.cards;

                return (
                  <View style={styles.matchNotificationCard}>
                    <Text style={styles.matchAlertTitle}>⚡ 同質カード自動マッチング検知！</Text>
                    <View style={styles.matchSwapRow}>
                      <View style={styles.matchHalf}>
                        <Text style={styles.swapLabel}>あなたの出すカード</Text>
                        <Image source={{ uri: myMatchedCard?.image_url }} style={styles.miniCardImg} />
                        <Text style={styles.miniCardName}>{myMatchedCard?.card_name}</Text>
                      </View>
                      <View style={styles.swapIconContainer}><Text style={styles.swapIcon}>🔄</Text></View>
                      <View style={styles.matchHalf}>
                        <Text style={styles.swapLabel}>あなたに届くカード</Text>
                        <Image source={{ uri: opponentCard?.image_url }} style={styles.miniCardImg} />
                        <Text style={styles.miniCardName}>{opponentCard?.card_name}</Text>
                      </View>
                    </View>
                    <View style={styles.matchActionRow}>
                      <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleResolveMatch(item.id, 'rejected', item)}>
                        <Text style={styles.actionBtnText}>断る</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleResolveMatch(item.id, 'approved', item)}>
                        <Text style={styles.actionBtnText}>交換を承認する</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* 出品条件設定用モーダル */}
      <Modal visible={createModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.modalMainTitle}>トレード出品・自動マッチング条件設定</Text>
            
            <Text style={styles.label}>1. 放出するカードを選択（タップして決定）</Text>
            <FlatList
              data={myDeck}
              keyExtractor={(item) => item.id}
              horizontal
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.choiceCard, selectedCardForTrade?.id === item.id && styles.activeChoice]} onPress={() => setSelectedCardForTrade(item)}>
                  <Image source={{ uri: item.image_url }} style={styles.choiceImg} />
                  <Text style={styles.choiceName} numberOfLines={1}>{item.card_name}</Text>
                </TouchableOpacity>
              )}
            />

            {selectedCardForTrade && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.selectedConfirmText}>選択中: 【{selectedCardForTrade.card_name}】</Text>
                
                <Text style={styles.label}>2. 自動交換を希望するレアリティ（同質条件）</Text>
                <View style={styles.rowGap}>
                  {['R', 'SR', 'SSR', 'UR'].map((r) => (
                    <TouchableOpacity key={r} style={[styles.chip, desiredRarity === r && styles.activeChip]} onPress={() => setDesiredRarity(r)}>
                      <Text style={styles.chipText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>3. 自動交換を希望するカード役割</Text>
                <View style={styles.rowGap}>
                  {['attacker', 'support'].map((role) => (
                    <TouchableOpacity key={role} style={[styles.chip, desiredRole === role && styles.activeChip]} onPress={() => setDesiredRole(role)}>
                      <Text style={styles.chipText}>{role === 'attacker' ? '⚔️ アタッカー' : '🛡️ サポート'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.finalSubmitBtn} onPress={handleCreateListing}>
                  <Text style={styles.finalSubmitBtnText}>この条件で自動検索・出品</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.closeModalBtnText}>閉じる</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 12 },
  activeTabText: { color: '#3B82F6', fontWeight: '900' },
  
  createBtn: { backgroundColor: '#0F172A', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  createBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  
  tradeCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardPreview: { width: 65, height: 90, borderRadius: 8 },
  cardInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 2 },
  cardStats: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  desireTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BFDBFE' },
  desireText: { color: '#2563EB', fontSize: 11, fontWeight: '800' },
  matchConditionText: { fontSize: 11, color: '#0EA5E9', fontWeight: '700' },

  matchNotificationCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.1, shadowRadius: 10 },
  matchAlertTitle: { color: '#10B981', fontWeight: '900', fontSize: 14, marginBottom: 14, textAlign: 'center' },
  matchSwapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12 },
  matchHalf: { width: '42%', alignItems: 'center' },
  swapLabel: { fontSize: 10, color: '#475569', fontWeight: '700', marginBottom: 6 },
  miniCardImg: { width: 70, height: 95, borderRadius: 6 },
  miniCardName: { fontSize: 11, fontWeight: '800', color: '#0F172A', marginTop: 4, textAlign: 'center' },
  swapIconContainer: { width: '10%', alignItems: 'center' },
  swapIcon: { fontSize: 18 },
  matchActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  actionBtn: { width: '48%', padding: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#F1F5F9' },
  approveBtn: { backgroundColor: '#10B981' },
  actionBtnText: { fontWeight: '800', fontSize: 13, color: '#475569' },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalMainTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: '#475569', marginTop: 16, marginBottom: 10 },
  choiceCard: { width: 80, marginRight: 10, alignItems: 'center', padding: 4, borderRadius: 8 },
  activeChoice: { borderWidth: 2, borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  choiceImg: { width: 70, height: 95, borderRadius: 6 },
  choiceName: { fontSize: 10, color: '#0F172A', marginTop: 4 },
  selectedConfirmText: { color: '#2563EB', fontWeight: '900', fontSize: 14, textAlign: 'center', marginVertical: 10 },
  rowGap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: '#F1F5F9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  activeChip: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  finalSubmitBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  finalSubmitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  closeModalBtn: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 40 },
  closeModalBtnText: { color: '#475569', fontWeight: '700' },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontWeight: '600' }
});