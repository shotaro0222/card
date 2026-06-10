import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, Alert, Modal, Share } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function TradeScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market'); // market, my_trades
  const [userId, setUserId] = useState<string | null>(null);

  // データ
  const [marketListings, setMarketListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myDeck, setMyDeck] = useState<any[]>([]); // オファー用に自分のカード一覧を保持

  // オファー用モーダル状態
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);

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

    if (activeTab === 'market') {
      // 他人の出品一覧を取得（自分以外、かつステータスがopen）
      const { data } = await supabase
        .from('trade_listings')
        .select(`id, status, cards (id, card_name, image_url, rarity, status_total)`)
        .neq('player_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (data) setMarketListings(data);
    } else {
      // 自分の出品と、それに紐づくオファーを取得
      const { data } = await supabase
        .from('trade_listings')
        .select(`
          id, status, 
          cards (id, card_name, image_url),
          trade_offers (id, status, cards (id, card_name, image_url, rarity, player_id))
        `)
        .eq('player_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (data) setMyListings(data);
    }

    // 自分の手持ちカードを取得（オファーや出品に使うため）
    const { data: myCards } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', false);
    if (myCards) setMyDeck(myCards);

    setLoading(false);
  };

  // 1. 他人のカードに対して、自分のカードを選んでオファー（交換提案）を出す
  const submitOffer = async (myCardId: string) => {
    if (!selectedListing || !userId) return;
    
    const { error } = await supabase.from('trade_offers').insert([
      { listing_id: selectedListing.id, offerer_player_id: userId, offered_card_id: myCardId }
    ]);

    if (!error) {
      Alert.alert('オファー完了', '相手に交換を提案しました。承認されるのをお待ちください！');
      setOfferModalVisible(false);
    } else {
      Alert.alert('エラー', 'オファーに失敗しました。');
    }
  };

  // 2. 届いたオファーを「承認」して、カードの所有権を入れ替える（取引成立）
  const acceptOffer = async (listing: any, offer: any) => {
    Alert.alert(
      "トレード承認",
      `${offer.cards.card_name} と交換しますか？この操作は取り消せません。`,
      [
        { text: "キャンセル", style: "cancel" },
        { text: "交換する", onPress: async () => {
            setLoading(true);
            // 所有権の交換（アトミックな処理の簡易版）
            await supabase.from('cards').update({ player_id: offer.cards.player_id }).eq('id', listing.cards.id); // 自分のカードを相手へ
            await supabase.from('cards').update({ player_id: userId }).eq('id', offer.cards.id); // 相手のカードを自分へ
            
            // 取引ステータスを完了に
            await supabase.from('trade_listings').update({ status: 'completed' }).eq('id', listing.id);
            await supabase.from('trade_offers').update({ status: 'accepted' }).eq('id', offer.id);
            
            Alert.alert('トレード成立！', 'カードの交換が完了しました。図鑑を確認してください。');
            fetchTradeData();
          }
        }
      ]
    );
  };

  // 3. SNS共有機能（ネイティブのShare APIを使用）
  const shareToSNS = async (cardName: string) => {
    try {
      await Share.share({
        message: `激レアカード「${cardName}」を取引所に出品中！誰か交換しませんか？ #SnapCard #RealPhotoTCG #ストリートスナップTCG`,
      });
    } catch (error: any) {
      console.log(error.message);
    }
  };

  const renderMarketItem = ({ item }: { item: any }) => (
    <View style={styles.tradeCard}>
      <Image source={{ uri: item.cards.image_url }} style={styles.cardPreview} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.cards.card_name}</Text>
        <Text style={styles.cardStats}>レアリティ: {item.cards.rarity} | 総合力: {item.cards.status_total}</Text>
        <TouchableOpacity 
          style={styles.offerBtn} 
          onPress={() => { setSelectedListing(item); setOfferModalVisible(true); }}
        >
          <Text style={styles.offerBtnText}>🔄 交換を提案する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={() => shareToSNS(item.cards.card_name)}>
          <Text style={styles.shareBtnText}>📤 SNSで募集する</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMyListing = ({ item }: { item: any }) => {
    const pendingOffers = item.trade_offers?.filter((o: any) => o.status === 'pending') || [];
    
    return (
      <View style={styles.myListingCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: item.cards.image_url }} style={styles.myCardPreview} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.myCardName}>出品中: {item.cards.card_name}</Text>
            <Text style={styles.offerCountText}>届いたオファー: {pendingOffers.length}件</Text>
          </View>
        </View>

        {pendingOffers.length > 0 && (
          <View style={styles.offersContainer}>
            <Text style={styles.offersTitle}>▼ 提案されているカード</Text>
            {pendingOffers.map((offer: any) => (
              <View key={offer.id} style={styles.offerItem}>
                <Image source={{ uri: offer.cards.image_url }} style={styles.offerCardPreview} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerCardName}>{offer.cards.card_name}</Text>
                  <Text style={styles.offerStats}>{offer.cards.rarity}</Text>
                </View>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptOffer(item, offer)}>
                  <Text style={styles.acceptBtnText}>承認</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GLOBAL TRADE</Text>
        <Text style={styles.headerSub}>プレイヤー間カード取引所</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'market' && styles.activeTab]} onPress={() => setActiveTab('market')}>
          <Text style={[styles.tabText, activeTab === 'market' && styles.activeTabText]}>マーケット（他人の出品）</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'my_trades' && styles.activeTab]} onPress={() => setActiveTab('my_trades')}>
          <Text style={[styles.tabText, activeTab === 'my_trades' && styles.activeTabText]}>自分の出品とオファー</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : activeTab === 'market' ? (
        <FlatList
          data={marketListings}
          keyExtractor={(item) => item.id}
          renderItem={renderMarketItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>現在、取引所にカードはありません。</Text>}
        />
      ) : (
        <FlatList
          data={myListings}
          keyExtractor={(item) => item.id}
          renderItem={renderMyListing}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>現在出品しているカードはありません。</Text>}
        />
      )}

      {/* オファーするカードを選択するモーダル */}
      <Modal visible={offerModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>どのカードを交換に出しますか？</Text>
            <Text style={styles.modalSub}>※デッキに編成中のカードは選べません</Text>
            <FlatList
              data={myDeck}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalCardBtn} onPress={() => submitOffer(item.id)}>
                  <Image source={{ uri: item.image_url }} style={styles.modalCardImg} />
                  <Text style={styles.modalCardName} numberOfLines={1}>{item.card_name}</Text>
                  <Text style={styles.modalCardSelectText}>これを選ぶ</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOfferModalVisible(false)}>
              <Text style={styles.closeBtnText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#3B82F6', fontWeight: '900' },
  
  tradeCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  cardPreview: { width: 80, height: 110, borderRadius: 8, backgroundColor: '#F1F5F9' },
  cardInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  cardStats: { fontSize: 12, color: '#64748B', marginBottom: 12, fontWeight: '600' },
  
  offerBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  offerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  shareBtn: { backgroundColor: '#F1F5F9', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  shareBtnText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  
  myListingCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  myCardPreview: { width: 60, height: 80, borderRadius: 6 },
  myCardName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  offerCountText: { fontSize: 13, color: '#10B981', fontWeight: '800' },
  
  offersContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  offersTitle: { fontSize: 12, color: '#64748B', fontWeight: '800', marginBottom: 12 },
  offerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 8 },
  offerCardPreview: { width: 40, height: 55, borderRadius: 4, marginRight: 10 },
  offerCardName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  offerStats: { fontSize: 11, color: '#64748B' },
  acceptBtn: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontWeight: '600', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, minHeight: 350 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
  modalSub: { fontSize: 12, color: '#F43F5E', fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  
  modalCardBtn: { width: 100, marginRight: 16, alignItems: 'center' },
  modalCardImg: { width: 100, height: 140, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  modalCardName: { fontSize: 11, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalCardSelectText: { color: '#3B82F6', fontWeight: '800', fontSize: 13 },
  
  closeBtn: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 }
});