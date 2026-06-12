import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Send, RefreshCcw, X, ArrowRightLeft } from 'lucide-react-native';

export default function ChatTradeScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [myCards, setMyCards] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // トレード用ステート
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedOfferCard, setSelectedOfferCard] = useState<any>(null);
  const [requestedCardName, setRequestedCardName] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      initChat();

      // ⚡️ リアルタイム通信の確立（新しいメッセージが来たら即時反映）
      const messageSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          fetchMessages();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messageSubscription);
      };
    }, [])
  );

  const initChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      // 自分が現在アクティブに所持しているカードを取得
      const { data } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true);
      if (data) setMyCards(data);
    }
    fetchMessages();
  };

  const fetchMessages = async () => {
    // invertedを使用するため、最新のものを一番上（配列の最初）に取得する
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(player_name), offered_card:card_offer_id(*)')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const textToSend = inputText;
    setInputText(''); // UIを即座にクリアして体感速度を上げる
    
    const { error } = await supabase.from('messages').insert([{ sender_id: user.id, text: textToSend }]);
    if (error) Alert.alert('送信エラー', error.message);
  };

  const sendTradeOffer = async () => {
    if (!selectedOfferCard || !requestedCardName.trim()) {
      Alert.alert('エラー', '提案するカードと、欲しいカードの名前を入力してください。');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const offerText = `【トレード募集】\n出: ${selectedOfferCard.card_name}\n求: ${requestedCardName}\n\n条件が合う方、交換お願いします！`;
    
    await supabase.from('messages').insert([{ 
      sender_id: user.id, 
      text: offerText, 
      card_offer_id: selectedOfferCard.id 
    }]);
    
    setModalVisible(false);
    setSelectedOfferCard(null);
    setRequestedCardName('');
  };

  // 相手のトレード提案を受け入れる処理
  const acceptTrade = async (message: any) => {
    if (!myId) return;
    
    // 自分が相手が求めているカード（または代替カード）を持っているか選択させるUIが理想ですが、
    // ここではシンプルに「自分の手持ちの先頭のカード」を差し出すロジックにしています。
    const myOfferCard = myCards[0]; 
    if (!myOfferCard) {
      Alert.alert('エラー', '交換に出せるカードを持っていません。');
      return;
    }

    Alert.alert(
      "交換の最終確認", 
      `あなたの「${myOfferCard.card_name}」と\n相手の「${message.offered_card.card_name}」を交換しますか？\n※この操作は取り消せません。`, 
      [
        { text: "キャンセル", style: "cancel" },
        { text: "交換を確定する", onPress: async () => {
            setLoading(true);
            
            // 💡【重要】本来はRPC（バックエンド関数）でトランザクション処理を行いますが、
            // ここではフロントエンドから2つのカードの所有者を入れ替える処理を書きます。
            try {
              // 1. 相手のカードを自分に
              await supabase.from('cards').update({ player_id: myId }).eq('id', message.card_offer_id);
              // 2. 自分のカードを相手に
              await supabase.from('cards').update({ player_id: message.sender_id }).eq('id', myOfferCard.id);
              // 3. トレード完了としてメッセージを削除（またはステータス更新）
              await supabase.from('messages').delete().eq('id', message.id);

              Alert.alert('🎉 トレード成立！', 'カードの交換が完了しました。図鑑を確認してください。'); 
              initChat(); 
            } catch (err) {
              Alert.alert('エラー', '通信に失敗しました。');
            }
            setLoading(false);
        }}
      ]
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === myId;
    const hasOffer = item.offered_card != null;

    return (
      <View style={[styles.msgLine, isMe ? styles.myMsgLine : styles.oppMsgLine]}>
        {!isMe && <Text style={styles.senderName}>{item.profiles?.player_name || '名もなきエージェント'}</Text>}
        
        <View style={[styles.msgBox, isMe ? styles.myMsgBox : styles.oppMsgBox, hasOffer && styles.offerBox]}>
          <Text style={[styles.msgText, isMe && styles.myMsgText, hasOffer && !isMe && {color: '#0F172A'}]}>{item.text}</Text>
          
          {/* トレード提案カードの表示 */}
          {hasOffer && (
            <View style={styles.offerCardPreview}>
              {item.offered_card.image_url ? (
                <Image source={{ uri: item.offered_card.image_url }} style={styles.offerCardImg} />
              ) : (
                <View style={styles.offerCardImgPlaceholder}><Text>No Image</Text></View>
              )}
              <View style={styles.offerCardInfo}>
                <Text style={styles.offerCardName}>{item.offered_card.card_name}</Text>
                <Text style={styles.offerCardStats}>総合力: {item.offered_card.status_total}</Text>
              </View>
            </View>
          )}

          {hasOffer && !isMe && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptTrade(item)}>
              <ArrowRightLeft color="#FFFFFF" size={16} style={{marginRight: 8}} />
              <Text style={styles.acceptBtnText}>この条件でトレード</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GLOBAL TRADE HUB</Text>
          <Text style={styles.headerSub}>世界中のエージェントとカードを交換</Text>
        </View>

        {/* inverted={true} を使うことで、LINEのように下から上にメッセージが積み上がります */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted={true} 
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        />
        
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{color:'#FFF', marginTop: 10, fontWeight:'800'}}>トレード処理中...</Text>
          </View>
        )}

        {/* 入力エリア */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.offerBtn} onPress={() => setModalVisible(true)}>
            <RefreshCcw color="#3B82F6" size={22} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="メッセージを送信..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
          />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && {opacity: 0.5}]} onPress={sendMessage} disabled={!inputText.trim()}>
            <Send color={inputText.trim() ? "#3B82F6" : "#94A3B8"} size={26} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* トレード提案モーダル */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>トレード募集を作成</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#64748B" size={28} /></TouchableOpacity>
            </View>

            <Text style={styles.label}>1. 交換に出すカードを選択</Text>
            {myCards.length === 0 ? (
              <Text style={{color: '#E11D48', marginBottom: 20}}>交換に出せるカードがありません。</Text>
            ) : (
              <ScrollView horizontal style={styles.cardSelector} showsHorizontalScrollIndicator={false}>
                {myCards.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.miniCard, selectedOfferCard?.id === c.id && styles.selectedMiniCard]}
                    onPress={() => setSelectedOfferCard(c)}
                  >
                    {c.image_url && <Image source={{uri: c.image_url}} style={styles.miniCardImg} />}
                    <Text style={[styles.miniCardText, selectedOfferCard?.id === c.id && styles.selectedMiniCardText]} numberOfLines={1}>{c.card_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>2. 欲しいカードの条件や名前</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="例: 火属性のアタッカー、〇〇というカード等"
              placeholderTextColor="#94A3B8"
              value={requestedCardName}
              onChangeText={setRequestedCardName}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={sendTradeOffer}>
              <Text style={styles.confirmBtnText}>募集をマーケットに送信する</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardAvoid: { flex: 1 },
  header: { padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 40 : 16 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '700' },
  
  msgLine: { marginBottom: 20, maxWidth: '85%' },
  myMsgLine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  oppMsgLine: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { color: '#64748B', fontSize: 11, marginBottom: 6, fontWeight: '800', marginLeft: 4 },
  
  msgBox: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, maxWidth: '100%' },
  myMsgBox: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  oppMsgBox: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  offerBox: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: '#FFFBEB' },
  
  msgText: { fontSize: 15, lineHeight: 22, color: '#0F172A', fontWeight: '500' },
  myMsgText: { color: '#FFFFFF' },

  offerCardPreview: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  offerCardImg: { width: 50, height: 70, borderRadius: 6, resizeMode: 'cover' },
  offerCardImgPlaceholder: { width: 50, height: 70, borderRadius: 6, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  offerCardInfo: { marginLeft: 12, justifyContent: 'center', flex: 1 },
  offerCardName: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  offerCardStats: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  
  inputArea: { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F1F5F9', color: '#0F172A', paddingTop: 14, paddingBottom: 14, paddingHorizontal: 18, borderRadius: 24, fontSize: 15, marginHorizontal: 10, maxHeight: 120 },
  offerBtn: { padding: 12, backgroundColor: '#EFF6FF', borderRadius: 24, marginBottom: 4 },
  sendBtn: { padding: 10, marginBottom: 4 },
  
  acceptBtn: { flexDirection: 'row', backgroundColor: '#F59E0B', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalHeader: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  label: { color: '#475569', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  
  cardSelector: { flexDirection: 'row', marginBottom: 24 },
  miniCard: { backgroundColor: '#F8FAFC', padding: 8, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', width: 100, alignItems: 'center' },
  selectedMiniCard: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 2 },
  miniCardImg: { width: '100%', height: 80, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' },
  miniCardText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  selectedMiniCardText: { color: '#2563EB' },
  
  modalInput: { backgroundColor: '#F8FAFC', color: '#0F172A', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, marginBottom: 24 },
  confirmBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 }
});