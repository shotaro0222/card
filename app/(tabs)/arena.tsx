import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function ArenaScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('opponents'); // opponents, defense_logs
  const [userId, setUserId] = useState<string | null>(null);

  const [opponents, setOpponents] = useState<any[]>([]);
  const [defenseLogs, setDefenseLogs] = useState<any[]>([]);
  
  // バトル結果表示用モーダル
  const [battleResultVisible, setBattleResultVisible] = useState(false);
  const [currentBattleLog, setCurrentBattleLog] = useState<string[]>([]);
  const [battleResultTitle, setBattleResultTitle] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchArenaData();
    }, [activeTab])
  );

  const fetchArenaData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    if (activeTab === 'opponents') {
      // 1. 全国のライバル（自分以外のユーザーの、出撃中のカード代表1枚）を取得
      const { data } = await supabase
        .from('cards')
        .select('player_id, card_name, image_url, rarity, status_total, profiles!inner(player_name)')
        .neq('player_id', user.id)
        .eq('is_active', true)
        .order('status_total', { ascending: false })
        .limit(20);
      
      // 同じプレイヤーが複数出ないように一意にする
      const uniqueOpponents = Array.from(new Map(data?.map(item => [item.player_id, item])).values());
      setOpponents(uniqueOpponents);

    } else if (activeTab === 'defense_logs') {
      // 2. 自分が「防衛側（defender_id）」になった戦闘履歴を取得
      const { data } = await supabase
        .from('arena_battles')
        .select('*, challenger:profiles!challenger_id(player_name)')
        .eq('defender_id', user.id)
        .order('created_at', { ascending: false });
      
      setDefenseLogs(data || []);
      
      // 未読ログを既読にする
      await supabase.from('arena_battles').update({ is_read: true }).eq('defender_id', user.id).eq('is_read', false);
    }

    setLoading(false);
  };

  // 💡【非同期PvPの自動戦闘シミュレーションロジック】
  const initiateBattle = async (opponentId: string, opponentName: string) => {
    setLoading(true);
    try {
      // 自分のデッキを取得
      const { data: myDeck } = await supabase.from('cards').select('*').eq('player_id', userId).eq('is_active', true);
      // 相手のデッキを取得
      const { data: opDeck } = await supabase.from('cards').select('*').eq('player_id', opponentId).eq('is_active', true);

      if (!myDeck || myDeck.length === 0) throw new Error('あなたのデッキが編成されていません。');
      if (!opDeck || opDeck.length === 0) throw new Error('相手のデッキ情報が取得できませんでした。');

      let myHp = myDeck.reduce((sum, c) => sum + (c.status_hp || 100), 0);
      let opHp = opDeck.reduce((sum, c) => sum + (c.status_hp || 100), 0);
      const myAtk = myDeck.reduce((sum, c) => sum + (c.status_atk || 50), 0);
      const opAtk = opDeck.reduce((sum, c) => sum + (c.status_atk || 50), 0);

      const logs: string[] = [`⚔️ アリーナバトル開始：あなた vs ${opponentName}`];
      let turn = 1;
      let winnerId = null;

      // 高速シミュレーション（最大10ターン）
      while (myHp > 0 && opHp > 0 && turn <= 10) {
        logs.push(`\n--- 第${turn}ターン ---`);
        
        // 自分の攻撃
        const myDmg = Math.floor(myAtk * (0.8 + Math.random() * 0.4));
        opHp = Math.max(0, opHp - myDmg);
        logs.push(`💥 あなたの総攻撃！ 相手に ${myDmg} のダメージ！ (相手残りHP: ${opHp})`);

        if (opHp <= 0) {
          winnerId = userId;
          logs.push(`🎉 決着！ 相手の防衛線を突破しました！`);
          break;
        }

        // 相手の反撃
        const opDmg = Math.floor(opAtk * (0.8 + Math.random() * 0.4));
        myHp = Math.max(0, myHp - opDmg);
        logs.push(`🛡️ ${opponentName}の防衛システムが反撃！ あなたに ${opDmg} のダメージ！ (あなたの残りHP: ${myHp})`);

        if (myHp <= 0) {
          winnerId = opponentId;
          logs.push(`☠️ 決着... あなたの部隊は全滅しました。`);
          break;
        }
        turn++;
      }

      // 引き分けの場合は防衛側（相手）の勝ちとする
      if (!winnerId) {
        winnerId = opponentId;
        logs.push(`⏱️ タイムアップ！ 防衛側（${opponentName}）が耐え切りました。`);
      }

      const isWin = winnerId === userId;
      setBattleResultTitle(isWin ? '🏆 VICTORY' : '💀 DEFEAT');
      setCurrentBattleLog(logs);

      // 結果をデータベースに保存（相手への通知用）
      await supabase.from('arena_battles').insert([{
        challenger_id: userId,
        defender_id: opponentId,
        winner_id: winnerId,
        battle_log: logs
      }]);

      setBattleResultVisible(true);

    } catch (error: any) {
      Alert.alert('通信エラー', error.message);
    } finally {
      setLoading(false);
    }
  };

  const viewLog = (logData: any) => {
    const isWin = logData.winner_id === userId;
    setBattleResultTitle(isWin ? '🛡️ 防衛成功' : '💥 防衛失敗');
    setCurrentBattleLog(logData.battle_log);
    setBattleResultVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GLOBAL ARENA</Text>
        <Text style={styles.headerSub}>他プレイヤーとの遠隔非同期バトル</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'opponents' && styles.activeTab]} onPress={() => setActiveTab('opponents')}>
          <Text style={[styles.tabText, activeTab === 'opponents' && styles.activeTabText]}>ターゲット検索</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'defense_logs' && styles.activeTab]} onPress={() => setActiveTab('defense_logs')}>
          <Text style={[styles.tabText, activeTab === 'defense_logs' && styles.activeTabText]}>防衛レポート</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E11D48" style={{ marginTop: 50 }} />
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'opponents' && (
            <FlatList
              data={opponents}
              keyExtractor={(item) => item.player_id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>現在、アリーナに他のプレイヤーがいません。</Text>}
              renderItem={({ item }) => (
                <View style={styles.opponentCard}>
                  <Image source={{ uri: item.image_url }} style={styles.opPreview} />
                  <View style={styles.opInfo}>
                    <Text style={styles.opName}>{item.profiles?.player_name || '謎のプレイヤー'}</Text>
                    <Text style={styles.opStats}>エース: {item.card_name} ({item.rarity})</Text>
                    <Text style={styles.opPower}>推定戦力: {item.status_total}</Text>
                  </View>
                  <TouchableOpacity style={styles.attackBtn} onPress={() => initiateBattle(item.player_id, item.profiles?.player_name)}>
                    <Text style={styles.attackBtnText}>襲撃</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {activeTab === 'defense_logs' && (
            <FlatList
              data={defenseLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>まだ防衛記録はありません。</Text>}
              renderItem={({ item }) => {
                const isWin = item.winner_id === userId;
                return (
                  <TouchableOpacity style={[styles.logCard, isWin ? styles.logWin : styles.logLose]} onPress={() => viewLog(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.logTitle, isWin ? {color: '#10B981'} : {color: '#E11D48'}]}>
                        {isWin ? '🛡️ 防衛成功' : '💥 拠点が陥落しました'}
                      </Text>
                      <Text style={styles.logSub}>襲撃者: {item.challenger?.player_name || '不明'}</Text>
                      <Text style={styles.logDate}>{new Date(item.created_at).toLocaleString()}</Text>
                    </View>
                    {!item.is_read && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
                    <Text style={styles.viewLogText}>詳細 ＞</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* バトル結果・ログ表示モーダル */}
      <Modal visible={battleResultVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, battleResultTitle.includes('VICTORY') || battleResultTitle.includes('成功') ? {color: '#10B981'} : {color: '#E11D48'}]}>
              {battleResultTitle}
            </Text>
            
            <View style={styles.logScrollContainer}>
              <ScrollView showsVerticalScrollIndicator={true}>
                {currentBattleLog.map((log, index) => (
                  <Text key={index} style={styles.logLine}>{log}</Text>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setBattleResultVisible(false)}>
              <Text style={styles.closeBtnText}>戦域から離脱する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 16, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1 },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#E11D48' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 12 },
  activeTabText: { color: '#E11D48', fontWeight: '900' },
  
  opponentCard: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  opPreview: { width: 50, height: 70, borderRadius: 6, borderWidth: 1, borderColor: '#475569' },
  opInfo: { flex: 1, marginLeft: 12 },
  opName: { fontSize: 15, fontWeight: '900', color: '#F8FAFC', marginBottom: 2 },
  opStats: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  opPower: { fontSize: 12, color: '#F59E0B', fontWeight: '800' },
  attackBtn: { backgroundColor: '#E11D48', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  attackBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },

  logCard: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, alignItems: 'center' },
  logWin: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' },
  logLose: { backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: '#E11D48' },
  logTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  logSub: { fontSize: 12, color: '#CBD5E1', marginBottom: 4 },
  logDate: { fontSize: 10, color: '#64748B' },
  newBadge: { backgroundColor: '#E11D48', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  newBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  viewLogText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E293B', width: '100%', borderRadius: 16, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 5 },
  logScrollContainer: { backgroundColor: '#0F172A', padding: 12, borderRadius: 8, maxHeight: 400 },
  logLine: { color: '#38BDF8', fontSize: 13, marginBottom: 8, lineHeight: 20, fontFamily: 'monospace' },
  
  closeBtn: { backgroundColor: '#475569', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#F8FAFC', fontWeight: '800', fontSize: 14 },
  
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 40, fontWeight: '600' }
});