import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Image, Keyboard } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Send, RefreshCcw, X, ArrowRightLeft, Globe, Users, Plus, ShieldCheck, LogOut, Info, Crown, UserMinus } from 'lucide-react-native';

export default function ChatTradeScreen() {
  const [myId, setMyId] = useState<string | null>(null);
  const [myCards, setMyCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'team'>('global');

  // グローバルチャット用ステート
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  // チーム用ステート
  const [myTeamStatus, setMyTeamStatus] = useState<'pending' | 'approved' | null>(null);
  const [myTeamRole, setMyTeamRole] = useState<'leader' | 'member' | null>(null);
  const [myTeamDetails, setMyTeamDetails] = useState<any>(null);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [teamMessages, setTeamMessages] = useState<any[]>([]);
  
  // チーム管理用ステート
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<any[]>([]);

  // モーダル制御
  const [isTradeModalVisible, setTradeModalVisible] = useState(false);
  const [isCreateTeamModalVisible, setCreateTeamModalVisible] = useState(false);
  const [isTeamManageModalVisible, setTeamManageModalVisible] = useState(false);

  // トレード・作成用入力ステート
  const [selectedOfferCard, setSelectedOfferCard] = useState<any>(null);
  const [requestedCardName, setRequestedCardName] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  useFocusEffect(
    useCallback(() => {
      initAllData();

      // グローバルチャットのリアルタイム購読
      const globalSub = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          fetchGlobalMessages();
        })
        .subscribe();

      // チームチャットのリアルタイム購読
      const teamSub = supabase
        .channel('public:team_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, () => {
          if (myTeamDetails?.id) fetchTeamMessages(myTeamDetails.id);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(globalSub);
        supabase.removeChannel(teamSub);
      };
    }, [myTeamDetails?.id])
  );

  const initAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      const { data: cards } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true);
      if (cards) setMyCards(cards);
      
      await initTeamData(user.id);
    }
    fetchGlobalMessages();
  };

  // --- グローバルチャット関連 ---
  const fetchGlobalMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(player_name), offered_card:card_offer_id(*)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setMessages(data);
  };

  // --- チームデータ関連 ---
  const initTeamData = async (userId: string) => {
    // 💡 0件の場合に406エラーが出ないよう .single() を .maybeSingle() に修正
    const { data: memberData } = await supabase
      .from('team_members')
      .select('*, teams(*)')
      .eq('player_id', userId)
      .maybeSingle();

    if (memberData) {
      setMyTeamStatus(memberData.status);
      setMyTeamRole(memberData.role);
      setMyTeamDetails(memberData.teams);
      if (memberData.status === 'approved') {
        fetchTeamMessages(memberData.teams.id);
      }
    } else {
      setMyTeamStatus(null);
      setMyTeamRole(null);
      setMyTeamDetails(null);
      loadAvailableTeams();
    }
  };

  const loadAvailableTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    if (data) setAvailableTeams(data);
  };

  const fetchTeamMessages = async (teamId: string) => {
    const { data } = await supabase
      .from('team_messages')
      .select('*, profiles:sender_id(player_name), offered_card:card_offer_id(*)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setTeamMessages(data);
  };

  // --- チーム状況確認 / 管理用データロード ---
  const loadPendingRequests = async (teamId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles:player_id(player_name)')
      .eq('team_id', teamId)
      .eq('status', 'pending');

    if (error) {
      console.log('JOIN fetch error (pending):', error);
      const { data: fallbackData } = await supabase.from('team_members').select('*').eq('team_id', teamId).eq('status', 'pending');
      
      if (fallbackData && fallbackData.length > 0) {
        const playerIds = fallbackData.map(d => d.player_id);
        const { data: profs } = await supabase.from('profiles').select('id, player_name').in('id', playerIds);
        
        const mergedData = fallbackData.map(d => ({
          ...d,
          profiles: profs?.find(p => p.id === d.player_id) || null
        }));
        setPendingRequests(mergedData);
      } else {
        setPendingRequests([]);
      }
    } else if (data) {
      setPendingRequests(data);
    }
  };

  const loadApprovedMembers = async (teamId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles:player_id(player_name)')
      .eq('team_id', teamId)
      .eq('status', 'approved');

    if (error) {
      console.log('JOIN fetch error (approved):', error);
      const { data: fallbackData } = await supabase.from('team_members').select('*').eq('team_id', teamId).eq('status', 'approved');
      
      if (fallbackData && fallbackData.length > 0) {
        const playerIds = fallbackData.map(d => d.player_id);
        const { data: profs } = await supabase.from('profiles').select('id, player_name').in('id', playerIds);
        
        const mergedData = fallbackData.map(d => ({
          ...d,
          profiles: profs?.find(p => p.id === d.player_id) || null
        }));
        setApprovedMembers(mergedData);
      } else {
        setApprovedMembers([]);
      }
    } else if (data) {
      setApprovedMembers(data);
    }
  };

  const openTeamManageModal = () => {
    if (myTeamDetails) {
      loadApprovedMembers(myTeamDetails.id);
      if (myTeamRole === 'leader') {
        loadPendingRequests(myTeamDetails.id);
      }
      setTeamManageModalVisible(true);
    }
  };

  // --- メッセージ・トレード送信 ---
  const sendMessage = async () => {
    if (!inputText.trim() || !myId) return;
    const textToSend = inputText;
    setInputText(''); 

    if (activeTab === 'global') {
      await supabase.from('messages').insert([{ sender_id: myId, text: textToSend }]);
    } else if (activeTab === 'team' && myTeamDetails) {
      await supabase.from('team_messages').insert([{ team_id: myTeamDetails.id, sender_id: myId, text: textToSend }]);
    }
  };

  const sendTradeOffer = async () => {
    if (!selectedOfferCard || !requestedCardName.trim()) {
      Alert.alert('エラー', '提案するカードと、欲しいカードの名前を入力してください。');
      return;
    }
    
    Keyboard.dismiss();
    setLoading(true);
    
    try {
      const offerText = `【トレード募集】\n出: ${selectedOfferCard.card_name}\n求: ${requestedCardName}\n\n条件が合う方、交換お願いします！`;
      
      if (activeTab === 'global') {
        const { error } = await supabase.from('messages').insert([{ sender_id: myId, text: offerText, card_offer_id: selectedOfferCard.id }]);
        if (error) throw error;
      } else if (activeTab === 'team' && myTeamDetails) {
        const { error } = await supabase.from('team_messages').insert([{ team_id: myTeamDetails.id, sender_id: myId, text: offerText, card_offer_id: selectedOfferCard.id }]);
        if (error) throw error;
      }
      
      setTradeModalVisible(false);
      setSelectedOfferCard(null);
      setRequestedCardName('');
    } catch (err: any) {
      Alert.alert('エラー', `送信に失敗しました\n${err.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const acceptTrade = async (message: any) => {
    if (!myId) return;
    const myOfferCard = myCards[0]; 
    if (!myOfferCard) {
      Alert.alert('エラー', '交換に出せるカードを持っていません。');
      return;
    }

    Alert.alert(
      "交換の最終確認", 
      `あなたの「${myOfferCard.card_name}」と\n相手の「${message.offered_card.card_name}」を交換しますか？`, 
      [
        { text: "キャンセル", style: "cancel" },
        { text: "交換を確定する", onPress: async () => {
            setLoading(true);
            try {
              // カード所有権の交換
              await supabase.from('cards').update({ player_id: myId }).eq('id', message.card_offer_id);
              await supabase.from('cards').update({ player_id: message.sender_id }).eq('id', myOfferCard.id);
              
              // トレードメッセージの削除
              if (activeTab === 'global') {
                await supabase.from('messages').delete().eq('id', message.id);
              } else {
                await supabase.from('team_messages').delete().eq('id', message.id);
              }

              Alert.alert('🎉 トレード成立！', 'カードの交換が完了しました。'); 
              initAllData(); 
            } catch (err) {
              Alert.alert('エラー', '通信に失敗しました。');
            }
            setLoading(false);
        }}
      ]
    );
  };

  // --- チームカラー生成 ---
  const generateUniqueColor = (existingColors: string[]) => {
    let newColor = '';
    let attempts = 0;
    while (attempts < 1000) {
      const h = Math.floor(Math.random() * 360);
      const s = Math.floor(Math.random() * 40) + 60;
      const l = Math.floor(Math.random() * 30) + 40;
      newColor = `hsl(${h}, ${s}%, ${l}%)`;
      if (!existingColors.includes(newColor)) {
        return newColor;
      }
      attempts++;
    }
    const fallbackH = Math.floor(Math.random() * 360);
    return `hsl(${fallbackH}, 70%, 50%)`;
  };

  // --- チーム管理アクション ---
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    if (!myId) {
      Alert.alert('エラー', 'ユーザー情報が取得できません。');
      return;
    }
    
    Keyboard.dismiss();
    setLoading(true);
    
    try {
      const existingColors = availableTeams.map(t => t.team_color).filter(Boolean);
      if (myTeamDetails?.team_color) existingColors.push(myTeamDetails.team_color);
      const newTeamColor = generateUniqueColor(existingColors);

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
          name: newTeamName, 
          description: newTeamDesc,
          team_color: newTeamColor,
          leader_id: myId
        }])
        .select()
        .single();
      
      if (teamError) throw teamError;

      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{ team_id: teamData.id, player_id: myId, role: 'leader', status: 'approved' }]);

      if (memberError) throw memberError;

      Alert.alert('成功', 'チームを設立しました！');
      setCreateTeamModalVisible(false);
      setNewTeamName('');
      setNewTeamDesc('');
      initAllData();
    } catch (err: any) {
      Alert.alert('エラー', `チーム作成に失敗しました\n${err.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const requestJoinTeam = async (teamId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('team_members')
      .insert([{ team_id: teamId, player_id: myId, status: 'pending', role: 'member' }]);
      
    if (error) {
      Alert.alert('申請エラー', error.message);
    } else {
      Alert.alert('申請完了', 'リーダーの承認をお待ちください。');
    }
    initAllData();
    setLoading(false);
  };

  const cancelJoinRequest = async () => {
    setLoading(true);
    await supabase.from('team_members').delete().eq('player_id', myId);
    initAllData();
    setLoading(false);
  };

  const leaveTeam = async () => {
    Alert.alert("チーム脱退", "本当にチームを脱退しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "脱退する", style: "destructive", onPress: async () => {
          setLoading(true);
          await supabase.from('team_members').delete().eq('player_id', myId);
          setTeamManageModalVisible(false);
          initAllData();
          setLoading(false);
      }}
    ]);
  };

  const handleRequest = async (memberId: string, isApprove: boolean) => {
    setLoading(true);
    if (isApprove) {
      const { error } = await supabase.from('team_members').update({ status: 'approved', role: 'member' }).eq('id', memberId);
      if (error) Alert.alert('エラー', error.message);
    } else {
      await supabase.from('team_members').delete().eq('id', memberId);
    }
    await loadPendingRequests(myTeamDetails.id);
    await loadApprovedMembers(myTeamDetails.id);
    setLoading(false);
  };

  const kickMember = async (memberId: string, memberName: string) => {
    Alert.alert("強制脱退", `本当に「${memberName}」をチームから強制脱退させますか？`, [
      { text: "キャンセル", style: "cancel" },
      { text: "脱退させる", style: "destructive", onPress: async () => {
          setLoading(true);
          await supabase.from('team_members').delete().eq('id', memberId);
          await loadApprovedMembers(myTeamDetails.id);
          setLoading(false);
      }}
    ]);
  };

  // --- UI レンダリング ---
  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === myId;
    const hasOffer = item.offered_card != null;

    return (
      <View style={[styles.msgLine, isMe ? styles.myMsgLine : styles.oppMsgLine]}>
        {!isMe && <Text style={styles.senderName}>{item.profiles?.player_name || '匿名エージェント'}</Text>}
        
        <View style={[styles.msgBox, isMe ? styles.myMsgBox : styles.oppMsgBox, hasOffer && styles.offerBox]}>
          <Text style={[styles.msgText, isMe && styles.myMsgText, hasOffer && !isMe && {color: '#0F172A'}]}>{item.text}</Text>
          
          {hasOffer && (
            <View style={styles.offerCardPreview}>
              {item.offered_card.image_url ? (
                <Image source={{ uri: item.offered_card.image_url }} style={styles.offerCardImg} />
              ) : (
                <View style={styles.offerCardImgPlaceholder}><Text style={{fontSize:10}}>No Img</Text></View>
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

  const renderTeamSection = () => {
    if (myTeamStatus === null) {
      return (
        <View style={styles.teamDiscoveryContainer}>
          <TouchableOpacity style={styles.createTeamBtn} onPress={() => setCreateTeamModalVisible(true)}>
            <Plus color="#FFF" size={24} />
            <Text style={styles.createTeamBtnText}>新しくチームを設立する</Text>
          </TouchableOpacity>
          <Text style={styles.sectionLabel}>募集中のチーム一覧</Text>
          <FlatList
            data={availableTeams}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.teamCard}>
                <View style={[styles.teamColorCircle, { backgroundColor: item.team_color || '#CBD5E1' }]}>
                  <Text style={styles.teamColorInitials}>{item.name ? item.name.substring(0, 1) : '?'}</Text>
                </View>
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={styles.teamCardName}>{item.name}</Text>
                  <Text style={styles.teamCardDesc}>{item.description || '説明なし'}</Text>
                </View>

                {item.leader_id === myId ? (
                  <View style={styles.myTeamBadge}>
                    <Text style={styles.myTeamBadgeText}>あなたのチーム</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.joinBtn} onPress={() => requestJoinTeam(item.id)}>
                    <Text style={styles.joinBtnText}>加入申請</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>現在募集中のチームはありません。</Text>}
          />
        </View>
      );
    }

    if (myTeamStatus === 'pending') {
      return (
        <View style={styles.pendingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" style={{marginBottom: 20}} />
          <Text style={styles.pendingTitle}>チーム加入承認待ち</Text>
          <Text style={styles.pendingDesc}>「{myTeamDetails?.name}」のリーダーからの承認を待っています。</Text>
          <TouchableOpacity style={styles.cancelReqBtn} onPress={cancelJoinRequest}>
            <Text style={styles.cancelReqBtnText}>申請を取り消す</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (myTeamStatus === 'approved') {
      return (
        <>
          <View style={styles.teamHeaderBar}>
            <View style={styles.teamHeaderLeftArea}>
              <View style={[styles.teamHeaderColorCircle, { backgroundColor: myTeamDetails?.team_color || '#CBD5E1' }]} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.teamHeaderName}>{myTeamDetails?.name}</Text>
                <Text style={styles.teamHeaderRole}>{myTeamRole === 'leader' ? '👑 リーダー' : '👤 メンバー'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.teamManageBtn} onPress={openTeamManageModal}>
              <Info color="#475569" size={24} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={teamMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted={true}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          />
        </>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>COMMUNICATIONS</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, activeTab === 'global' && styles.activeTab]} onPress={() => setActiveTab('global')}>
              <Globe size={18} color={activeTab === 'global' ? '#FFFFFF' : '#64748B'}/>
              <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>GLOBAL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'team' && styles.activeTab]} onPress={() => setActiveTab('team')}>
              <Users size={18} color={activeTab === 'team' ? '#FFFFFF' : '#64748B'}/>
              <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>TEAM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'global' ? (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted={true} 
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          renderTeamSection()
        )}
        
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{color:'#FFF', marginTop: 10, fontWeight:'800'}}>通信中...</Text>
          </View>
        )}

        {/* チャット入力欄 */}
        {(activeTab === 'global' || (activeTab === 'team' && myTeamStatus === 'approved')) && (
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.offerBtn} onPress={() => setTradeModalVisible(true)}>
              <RefreshCcw color="#3B82F6" size={22} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={activeTab === 'global' ? "世界に向けて送信..." : "チームへ送信..."}
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
        )}
      </KeyboardAvoidingView>

      {/* --- トレード提案モーダル --- */}
      <Modal visible={isTradeModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>トレード募集を作成</Text>
              <TouchableOpacity onPress={() => setTradeModalVisible(false)}><X color="#64748B" size={28} /></TouchableOpacity>
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
              placeholder="例: 火属性のアタッカー等"
              placeholderTextColor="#94A3B8"
              value={requestedCardName}
              onChangeText={setRequestedCardName}
            />
            <TouchableOpacity 
              style={[styles.confirmBtn, (!selectedOfferCard || !requestedCardName.trim() || loading) && {backgroundColor: '#94A3B8'}]} 
              onPress={sendTradeOffer}
              disabled={!selectedOfferCard || !requestedCardName.trim() || loading}
            >
              <Text style={styles.confirmBtnText}>{loading ? '送信中...' : '募集をマーケットに送信する'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- チーム作成モーダル --- */}
      <Modal visible={isCreateTeamModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>新規チーム設立</Text>
              <TouchableOpacity onPress={() => setCreateTeamModalVisible(false)}><X color="#64748B" size={28} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>チーム名</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="最強のチーム名を入力"
              placeholderTextColor="#94A3B8"
              value={newTeamName}
              onChangeText={setNewTeamName}
              maxLength={20}
            />
            <Text style={styles.label}>活動方針・募集条件など (任意)</Text>
            <TextInput
              style={[styles.modalInput, {height: 80}]}
              placeholder="例: 毎日ログインできる方募集！情報交換メインです。"
              placeholderTextColor="#94A3B8"
              value={newTeamDesc}
              onChangeText={setNewTeamDesc}
              multiline
              maxLength={100}
            />
            <TouchableOpacity 
              style={[styles.confirmBtn, (!newTeamName.trim() || loading) && {backgroundColor: '#94A3B8'}]} 
              onPress={handleCreateTeam} 
              disabled={!newTeamName.trim() || loading}
            >
              <Text style={styles.confirmBtnText}>{loading ? '設立中...' : 'この名前で設立する'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- チーム管理・状況確認モーダル --- */}
      <Modal visible={isTeamManageModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>{myTeamRole === 'leader' ? 'チーム管理' : 'チーム状況確認'}</Text>
              <TouchableOpacity onPress={() => setTeamManageModalVisible(false)}><X color="#64748B" size={28} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>
              
              {/* 💡 メンバー一覧 (全メンバーが閲覧可能) */}
              <View style={styles.manageSection}>
                <Text style={styles.label}>チームメンバー一覧</Text>
                {approvedMembers.length === 0 ? (
                  <Text style={styles.emptyText}>メンバーがいません。</Text>
                ) : (
                  approvedMembers.map(member => (
                    <View key={member.id} style={styles.reqCard}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        {member.role === 'leader' ? <Crown color="#F59E0B" size={16} style={{marginRight: 6}}/> : <Users color="#94A3B8" size={16} style={{marginRight: 6}}/>}
                        <Text style={[styles.reqName, member.role === 'leader' && {color: '#D97706'}]}>{member.profiles?.player_name || '匿名'}</Text>
                      </View>
                      
                      {myTeamRole === 'leader' && member.role !== 'leader' && (
                        <TouchableOpacity style={styles.kickBtn} onPress={() => kickMember(member.id, member.profiles?.player_name)}>
                          <UserMinus color="#EF4444" size={16} />
                          <Text style={styles.kickBtnText}>強制脱退</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* 💡 加入申請の承認・拒否 (リーダーのみ) */}
              {myTeamRole === 'leader' && (
                <View style={styles.manageSection}>
                  <Text style={styles.label}>加入申請一覧</Text>
                  {pendingRequests.length === 0 ? (
                    <Text style={styles.emptyText}>現在申請はありません。</Text>
                  ) : (
                    pendingRequests.map(req => (
                      <View key={req.id} style={styles.reqCard}>
                        <Text style={styles.reqName}>{req.profiles?.player_name || '匿名'}</Text>
                        <View style={{flexDirection: 'row'}}>
                          <TouchableOpacity style={[styles.reqBtn, {backgroundColor: '#10B981'}]} onPress={() => handleRequest(req.id, true)}>
                            <Text style={styles.reqBtnText}>承認</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.reqBtn, {backgroundColor: '#EF4444', marginLeft: 8}]} onPress={() => handleRequest(req.id, false)}>
                            <Text style={styles.reqBtnText}>拒否</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.leaveBtn} onPress={leaveTeam}>
                <LogOut color="#EF4444" size={20} />
                <Text style={styles.leaveBtnText}>チームを脱退する</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingBottom: 85 },
  keyboardAvoid: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 40 : 16 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: 1, marginBottom: 12 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 16, width: '90%' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  activeTab: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4 },
  tabText: { fontSize: 13, fontWeight: '800', color: '#64748B', marginLeft: 6 },
  activeTabText: { color: '#FFFFFF' },

  msgLine: { marginBottom: 20, maxWidth: '85%' },
  myMsgLine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  oppMsgLine: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { color: '#64748B', fontSize: 11, marginBottom: 6, fontWeight: '800', marginLeft: 4 },
  msgBox: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, maxWidth: '100%' },
  myMsgBox: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  oppMsgBox: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  offerBox: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: '#FFFBEB' },
  msgText: { fontSize: 15, lineHeight: 22, color: '#0F172A', fontWeight: '500' },
  myMsgText: { color: '#FFFFFF' },

  offerCardPreview: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  offerCardImg: { width: 50, height: 70, borderRadius: 6, resizeMode: 'cover' },
  offerCardImgPlaceholder: { width: 50, height: 70, borderRadius: 6, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  offerCardInfo: { marginLeft: 12, justifyContent: 'center', flex: 1 },
  offerCardName: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  offerCardStats: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  
  inputArea: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F1F5F9', color: '#0F172A', paddingTop: 14, paddingBottom: 14, paddingHorizontal: 18, borderRadius: 24, fontSize: 15, marginHorizontal: 10, maxHeight: 120 },
  offerBtn: { padding: 12, backgroundColor: '#EFF6FF', borderRadius: 24, marginBottom: 4 },
  sendBtn: { padding: 10, marginBottom: 4 },
  acceptBtn: { flexDirection: 'row', backgroundColor: '#F59E0B', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  
  teamDiscoveryContainer: { flex: 1, padding: 16 },
  createTeamBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  createTeamBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', marginLeft: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#475569', marginBottom: 12 },
  
  teamCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  teamColorCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  teamColorInitials: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  teamCardName: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  teamCardDesc: { fontSize: 12, color: '#64748B' },
  
  joinBtn: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  joinBtnText: { color: '#3B82F6', fontWeight: '800', fontSize: 13 },
  myTeamBadge: { backgroundColor: '#FEE2E2', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  myTeamBadgeText: { color: '#EF4444', fontWeight: '800', fontSize: 11 },
  
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 20 },

  pendingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  pendingTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  pendingDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 30 },
  cancelReqBtn: { backgroundColor: '#FEE2E2', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  cancelReqBtnText: { color: '#EF4444', fontWeight: '800' },

  teamHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  teamHeaderLeftArea: { flexDirection: 'row', alignItems: 'center' },
  teamHeaderColorCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: '#F1F5F9' },
  teamHeaderName: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  teamHeaderRole: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 2 },
  teamManageBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },

  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, maxHeight: '90%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalHeader: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  label: { color: '#475569', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  modalInput: { backgroundColor: '#F8FAFC', color: '#0F172A', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, marginBottom: 24 },
  confirmBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },

  cardSelector: { flexDirection: 'row', marginBottom: 24 },
  miniCard: { backgroundColor: '#F8FAFC', padding: 8, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', width: 100, alignItems: 'center' },
  selectedMiniCard: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 2 },
  miniCardImg: { width: '100%', height: 80, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' },
  miniCardText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  selectedMiniCardText: { color: '#2563EB' },

  manageSection: { marginBottom: 30 },
  reqCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 8 },
  reqName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  reqBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  reqBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  
  kickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  kickBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 11, marginLeft: 4 },

  leaveBtn: { flexDirection: 'row', backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  leaveBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '900', marginLeft: 8 }
});