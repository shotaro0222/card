import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Send, RefreshCcw, X } from 'lucide-react-native';

export default function ChatTradeScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [myCards, setMyCards] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedOfferCard, setSelectedOfferCard] = useState<any>(null);
  const [requestedCardId, setRequestedCardId] = useState<string>('');
  
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      initChat();

      // リアルタイムリスナーの登録（メッセージが追加されたら即時取得）
      const messageSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
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
      const { data } = await supabase.from('cards').select('*').eq('player_id', user.id);
      if (data) setMyCards(data);
    }
    fetchMessages();
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(player_name), cards(*)')
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) {
      setMessages(data);
      // メッセージ取得時に一番下へスクロール
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // UIを即座にクリアして体感速度を上げる
    const textToSend = inputText;
    setInputText('');
    
    await supabase.from('messages').insert([{ sender_id: user.id, text: textToSend }]);
    // リアルタイムリスナーが反応して自動でfetchMessagesが走ります
  };

  const sendTradeOffer = async () => {
    if (!selectedOfferCard || !requestedCardId) {
      Alert.alert('エラー', '提案するカードと、欲しいカードを選択してください。');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: reqCard } = await supabase.from('cards').select('card_name').eq('id', requestedCardId).single();
    const offerText = `【トレード提案】\n「${selectedOfferCard.card_name}」を出します。\n「${reqCard?.card_name || '指定カード'}」と交換しませんか？`;
    
    await supabase.from('messages').insert([{ sender_id: user.id, text: offerText, card_offer_id: selectedOfferCard.id }]);
    setModalVisible(false);
    setSelectedOfferCard(null);
    setRequestedCardId('');
  };

  const acceptTrade = async (message: any) => {
    if (!myId) return;
    Alert.alert("交換の確認", "この条件でカードを交換しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "交換する", onPress: async () => {
          setLoading(true);
          const { data: success, error } = await supabase.rpc('execute_card_trade', { 
            target_message_id: message.id, 
            buyer_user_id: myId, 
            offered_card_id: message.card_offer_id, 
            requested_card_id: myCards[0]?.id // 必要に応じてロジックを調整
          });
          
          if (error || !success) {
            Alert.alert('失敗', '条件が一致しないか、すでに取引済みです。');
          } else { 
            Alert.alert('成立！', 'カードを交換しました。図鑑を確認してください。'); 
            initChat(); 
          }
          setLoading(false);
      }}
    ]);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === myId;
    return (
      <View style={[styles.msgLine, isMe ? styles.myMsgLine : styles.oppMsgLine]}>
        {!isMe && <Text style={styles.senderName}>{item.profiles?.player_name || 'ゲスト'}</Text>}
        <View style={[styles.msgBox, isMe ? styles.myMsgBox : styles.oppMsgBox, item.card_offer_id && styles.offerBox]}>
          <Text style={[styles.msgText, isMe && styles.myMsgText]}>{item.text}</Text>
          {item.card_offer_id && !isMe && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptTrade(item)}>
              <Text style={styles.acceptBtnText}>交換を受け入れる</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TRADE MARKET</Text>
          <Text style={styles.headerSub}>ユーザー同士の交換広場</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {loading && <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />}

        {/* 入力エリア */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.offerBtn} onPress={() => setModalVisible(true)}>
            <RefreshCcw color="#3B82F6" size={20} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="メッセージを入力..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Send color={inputText.trim() ? "#3B82F6" : "#CBD5E1"} size={24} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* トレード提案モーダル */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>トレードの提案</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#64748B" size={24} /></TouchableOpacity>
            </View>

            <Text style={styles.label}>1. あなたが手放すカードを選択</Text>
            <ScrollView horizontal style={styles.cardSelector} showsHorizontalScrollIndicator={false}>
              {myCards.map(c => (
                <TouchableOpacity 
                  key={c.id} 
                  style={[styles.miniCard, selectedOfferCard?.id === c.id && styles.selectedMiniCard]}
                  onPress={() => setSelectedOfferCard(c)}
                >
                  <Text style={[styles.miniCardText, selectedOfferCard?.id === c.id && styles.selectedMiniCardText]} numberOfLines={1}>{c.card_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>2. 欲しい相手のカードIDを入力</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="UUIDを入力"
              placeholderTextColor="#94A3B8"
              value={requestedCardId}
              onChangeText={setRequestedCardId}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={sendTradeOffer}>
              <Text style={styles.confirmBtnText}>提案を送信する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardAvoid: { flex: 1 },
  header: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },
  
  msgLine: { marginBottom: 16, maxWidth: '80%' },
  myMsgLine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  oppMsgLine: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { color: '#64748B', fontSize: 11, marginBottom: 6, fontWeight: '700', marginLeft: 4 },
  
  msgBox: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, maxWidth: '100%' },
  myMsgBox: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  oppMsgBox: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
  offerBox: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: '#FFFBEB' },
  
  msgText: { fontSize: 15, lineHeight: 22, color: '#0F172A' },
  myMsgText: { color: '#FFFFFF' },
  
  inputArea: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F1F5F9', color: '#0F172A', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16, borderRadius: 24, fontSize: 15, marginHorizontal: 10, maxHeight: 100 },
  offerBtn: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 20, marginBottom: 4 },
  sendBtn: { padding: 10, marginBottom: 4 },
  
  acceptBtn: { backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  loader: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -25}, {translateY: -25}] },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalHeader: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  label: { color: '#475569', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  
  cardSelector: { flexDirection: 'row', marginBottom: 24 },
  miniCard: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 110, alignItems: 'center' },
  selectedMiniCard: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 2 },
  miniCardText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  selectedMiniCardText: { color: '#2563EB', fontWeight: '800' },
  
  modalInput: { backgroundColor: '#F8FAFC', color: '#0F172A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, marginBottom: 24 },
  confirmBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});