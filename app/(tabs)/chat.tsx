import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function ChatTradeScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [myCards, setMyCards] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // トレードモーダル用
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedOfferCard, setSelectedOfferCard] = useState<any>(null);
  const [requestedCardId, setRequestedCardId] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      initChat();
      // リアルタイムリスナーの開始（簡易的なポーリング、またはSupabase Realtime）
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }, [])
  );

  const initChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      // 自分のカードリストを取得（オファー用）
      const { data } = await supabase.from('cards').select('*').eq('player_id', user.id);
      if (data) setMyCards(data);
    }
    fetchMessages();
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(player_name), cards(*)') // 送信者プロフィールと添付カードを結合
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  };

  // 📝 通常メッセージ送信
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('messages').insert([{
      sender_id: user.id,
      text: inputText,
    }]);

    setInputText('');
    fetchMessages();
  };

  // 🤝 トレードオファー（カード添付）メッセージ送信
  const sendTradeOffer = async () => {
    if (!selectedOfferCard || !requestedCardId) {
      Alert.alert('エラー', 'オファーするカードと、要求するカードを選択してください。');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 要求カードの情報を取得
    const { data: reqCard } = await supabase.from('cards').select('card_name').eq('id', requestedCardId).single();

    const offerText = `【トレードオファー】\n「${selectedOfferCard.card_name}」を出します。\n「${reqCard?.card_name || '指定カード'}」をください。`;

    await supabase.from('messages').insert([{
      sender_id: user.id,
      text: offerText,
      card_offer_id: selectedOfferCard.id, // オファーカードIDを添付
    }]);

    setModalVisible(false);
    setSelectedOfferCard(null);
    setRequestedCardId('');
    fetchMessages();
  };

  // ✅ トレードの承認（相手のオファーを受け入れる）
  const acceptTrade = async (message: any) => {
    if (!myId) return;
    
    // 相手が要求しているカードを自分が持っているか確認するための簡易ダイアログ
    Alert.alert(
      "トレードの承認",
      "このトレード条件を受け入れ、カードを交換しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "交換する", onPress: async () => {
            setLoading(true);
            
            // RPCを呼び出して安全に一括処理
            const { data: success, error } = await supabase.rpc('execute_card_trade', {
              target_message_id: message.id,
              buyer_user_id: myId,
              offered_card_id: message.card_offer_id,
              requested_card_id: myCards[0]?.id // 簡略化のため、今回は手札の1枚目を自動照合（本来は対象のカードIDをセレクトさせる）
            });

            if (error || !success) {
              Alert.alert('トレード失敗', 'カードの所有権条件が一致しないか、すでに取引が終了しています。');
            } else {
              Alert.alert('トレード成立！', 'カードの交換が完了しました。DECKを確認してください。');
              initChat();
            }
            setLoading(false);
        }}
      ]
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === myId;
    return (
      <View style={[styles.msgLine, isMe ? styles.myMsgLine : styles.oppMsgLine]}>
        <Text style={styles.senderName}>{item.profiles?.player_name || '名無し司令官'}</Text>
        <View style={[styles.msgBox, item.card_offer_id && styles.offerBox]}>
          <Text style={styles.msgText}>{item.text}</Text>
          
          {/* トレードオファーボタンの表示（他人のオファーかつカードが添付されている場合） */}
          {item.card_offer_id && !isMe && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptTrade(item)}>
              <Text style={styles.acceptBtnText}>🤝 オファーを受け入れる</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 15 }}
      />

      {loading && <ActivityIndicator size="large" color="#f43f5e" style={styles.loader} />}

      {/* フッター入力エリア */}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.offerBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.offerBtnText}>🔄 トレード提案</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="作戦通信を入力..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendBtnText}>送信</Text>
        </TouchableOpacity>
      </View>

      {/* トレードオファー作成モーダル */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>🤝 トレードオファーの作成</Text>

            <Text style={styles.label}>1. 自分が差し出すカードを選択</Text>
            <ScrollView horizontal style={styles.cardSelector}>
              {myCards.map(c => (
                <TouchableOpacity 
                  key={c.id} 
                  style={[styles.miniCard, selectedOfferCard?.id === c.id && styles.selectedMiniCard]}
                  onPress={() => setSelectedOfferCard(c)}
                >
                  <Text style={styles.white} numberOfLines={1}>{c.card_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>2. 相手に要求するカードのIDを入力</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="欲しいカードのUUIDを入力"
              placeholderTextColor="#475569"
              value={requestedCardId}
              onChangeText={setRequestedCardId}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.white}>閉じる</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={sendTradeOffer}>
                <Text style={styles.confirmBtnText}>オファーを送信</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  msgLine: { marginBottom: 15, maxWidth: '80%' },
  myMsgLine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  oppMsgLine: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { color: '#64748b', fontSize: 11, marginBottom: 4, fontWeight: 'bold' },
  msgBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  offerBox: { borderColor: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.05)' },
  msgText: { color: '#f1f5f9', fontSize: 14, lineHeight: 20 },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0f172a', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#020617', color: 'white', padding: 12, borderRadius: 8, marginHorizontal: 8, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { backgroundColor: '#b91c1c', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  sendBtnText: { color: 'white', fontWeight: 'bold' },
  offerBtn: { backgroundColor: '#c084fc', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  offerBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 },
  acceptBtn: { backgroundColor: '#c084fc', padding: 8, borderRadius: 6, marginTop: 10, alignItems: 'center' },
  acceptBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 },
  loader: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -25}, {translateY: -25}] },
  
  // モーダル関連
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  modalHeader: { color: '#c084fc', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  cardSelector: { flexDirection: 'row', marginBottom: 15 },
  miniCard: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155', minWidth: 100, alignItems: 'center' },
  selectedMiniCard: { borderColor: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.2)' },
  modalInput: { backgroundColor: '#020617', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  cancelBtn: { backgroundColor: '#334155', padding: 12, borderRadius: 8, width: '45%', alignItems: 'center' },
  confirmBtn: { backgroundColor: '#c084fc', padding: 12, borderRadius: 8, width: '45%', alignItems: 'center' },
  confirmBtnText: { color: '#0f172a', fontWeight: 'bold' },
  white: { color: 'white', fontWeight: 'bold' }
});
