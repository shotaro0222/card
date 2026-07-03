import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const ELEMENT_RELATIONS: Record<string, { strong: string[], weak: string[] }> = {
  '火': { strong: ['木', 'サイバー', 'プラスチック'], weak: ['水', '黄金', '虚無'] },
  '水': { strong: ['火', '黄金', '資本'], weak: ['雷', 'プラスチック', '大気汚染'] },
  '雷': { strong: ['水', 'サイバー', '機械'], weak: ['木', '虚無', '時間'] },
  'サイバー': { strong: ['資本', 'プラスチック', '時間'], weak: ['火', '雷', '混沌'] },
  '資本': { strong: ['社畜', '黄金', '火'], weak: ['サイバー', '光', '虚無'] },
  'カフェイン': { strong: ['社畜', 'サイバー', '雷'], weak: ['水', '虚無', '時間'] },
  '社畜': { strong: ['資本', 'プラスチック', '火'], weak: ['カフェイン', '混沌', '光'] },
  '虚無': { strong: ['火', '雷', '資本'], weak: ['光', '量子', '時間'] },
};

function getDamageMultiplier(attackerEl: string, defenderEl: string): { multiplier: number, label: string } {
  const relation = ELEMENT_RELATIONS[attackerEl];
  if (!relation) return { multiplier: 1.0, label: '' };
  
  if (relation.strong.includes(defenderEl)) {
    return { multiplier: 1.5, label: '💥【有利属性】' };
  }
  if (relation.weak.includes(defenderEl)) {
    return { multiplier: 0.5, label: '🛡️【不利属性】' };
  }
  return { multiplier: 1.0, label: '' };
}

const summarizeDeck = (cards: any[], playerName: string) => {
  const elementBuckets = cards.reduce((acc: Record<string, number>, card: any) => {
    const element = card.element || '無';
    acc[element] = (acc[element] || 0) + (card.status_total || 0);
    return acc;
  }, {});
  const dominantElement = Object.entries(elementBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || '無';

  return {
    playerName,
    cards,
    totalHp: cards.reduce((sum, card) => sum + (card.status_hp || 100), 0),
    totalAtk: cards.reduce((sum, card) => sum + (card.status_atk || 50), 0),
    totalDef: cards.reduce((sum, card) => sum + (card.status_def || 50), 0),
    totalSpd: cards.reduce((sum, card) => sum + (card.status_spd || 50), 0),
    totalPower: cards.reduce((sum, card) => sum + (card.status_total || 0), 0),
    element: dominantElement,
    elementPower: elementBuckets[dominantElement] || 0,
  };
};

export function ArenaPanel({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('opponents');
  const [userId, setUserId] = useState<string | null>(null);
  const [autoSearching, setAutoSearching] = useState(false);

  const [opponents, setOpponents] = useState<any[]>([]);
  const [defenseLogs, setDefenseLogs] = useState<any[]>([]);
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
      const { data } = await supabase
        .from('cards')
        .select('player_id, status_total, status_hp, status_atk, status_def, status_spd, element, profiles!inner(player_name)')
        .neq('player_id', user.id)
        .eq('is_active', true)
        .order('status_total', { ascending: false })
        .limit(100);
      
      const uniqueOpponents = Array.from(
        (data || []).reduce((map: Map<string, any>, item: any) => {
          const existing = map.get(item.player_id) || { player_id: item.player_id, player_name: item.profiles?.player_name || '匿名プレイヤー', cards: [] };
          existing.cards.push(item);
          map.set(item.player_id, existing);
          return map;
        }, new Map<string, any>()).values()
      ).map((entry: any) => ({
        player_id: entry.player_id,
        player_name: entry.player_name,
        summary: summarizeDeck(entry.cards, entry.player_name),
      })).sort((left: any, right: any) => right.summary.totalPower - left.summary.totalPower);
      setOpponents(uniqueOpponents);

    } else if (activeTab === 'defense_logs') {
      const { data } = await supabase
        .from('arena_battles')
        .select('*, challenger:profiles!challenger_id(player_name)')
        .eq('defender_id', user.id)
        .order('created_at', { ascending: false });
      
      setDefenseLogs(data || []);
      
      await supabase.from('arena_battles').update({ is_read: true }).eq('defender_id', user.id).eq('is_read', false);
    }

    setLoading(false);
  };

  const initiateBattle = async (opponent: any) => {
    setLoading(true);
    try {
      const { data: myDeck } = await supabase.from('cards').select('*').eq('player_id', userId).eq('is_active', true);
      const { data: opDeck } = await supabase.from('cards').select('*').eq('player_id', opponent.player_id).eq('is_active', true);

      if (!myDeck || myDeck.length === 0) throw new Error('あなたのデッキが編成されていません。');
      if (!opDeck || opDeck.length === 0) throw new Error('相手のデッキ情報が取得できませんでした。');

      const mySummary = summarizeDeck(myDeck, 'あなた');
      const opSummary = summarizeDeck(opDeck, opponent.player_name || '匿名プレイヤー');

      let myHp = mySummary.totalHp;
      let opHp = opSummary.totalHp;
      const myAtk = mySummary.totalAtk;
      const opAtk = opSummary.totalAtk;
      const myElement = mySummary.element;
      const opElement = opSummary.element;

      const myAttackRes = getDamageMultiplier(myElement, opElement);
      const opAttackRes = getDamageMultiplier(opElement, myElement);

      const logs: string[] = [
        `⚔️ 全国オンライン対戦開始`,
        `あなた: ${mySummary.totalPower} / ${myElement}属性 / 属性値${mySummary.elementPower}`,
        `${opSummary.playerName}: ${opSummary.totalPower} / ${opElement}属性 / 属性値${opSummary.elementPower}`,
      ];
      let turn = 1;
      let winnerId = null;

      while (myHp > 0 && opHp > 0 && turn <= 10) {
        logs.push(`\n--- 第${turn}ターン ---`);
        
        const myBaseDmg = Math.floor(myAtk * (0.8 + Math.random() * 0.4));
        const myFinalDmg = Math.floor(myBaseDmg * myAttackRes.multiplier);
        opHp = Math.max(0, opHp - myFinalDmg);
        
        let myLog = `💥 あなたの部隊の総攻撃！`;
        if (myAttackRes.label) myLog += `\n${myAttackRes.label}効果が発動！`;
        myLog += `\n相手に ${myFinalDmg} のダメージ！ (相手残りHP: ${opHp})`;
        logs.push(myLog);

        if (opHp <= 0) {
          winnerId = userId;
          logs.push(`🎉 決着！ 相手の防衛線を突破しました！`);
          break;
        }

        const opBaseDmg = Math.floor(opAtk * (0.8 + Math.random() * 0.4));
        const opFinalDmg = Math.floor(opBaseDmg * opAttackRes.multiplier);
        myHp = Math.max(0, myHp - opFinalDmg);
        
        let opLog = `🛡️ ${opSummary.playerName}の防衛システムが反撃！`;
        if (opAttackRes.label) opLog += `\n${opAttackRes.label}効果が発動！`;
        opLog += `\nあなたに ${opFinalDmg} のダメージ！ (あなたの残りHP: ${myHp})`;
        logs.push(opLog);

        if (myHp <= 0) {
          winnerId = opponent.player_id;
          logs.push(`☠️ 決着... あなたの部隊は全滅しました。`);
          break;
        }
        turn++;
      }

      if (!winnerId) {
        winnerId = opponent.player_id;
        logs.push(`⏱️ タイムアップ！ 防衛側（${opSummary.playerName}）が耐え切りました。`);
      }

      const isWin = winnerId === userId;
      setBattleResultTitle(isWin ? '🏆 VICTORY' : '💀 DEFEAT');
      setCurrentBattleLog(logs);

      await supabase.from('arena_battles').insert([{
        challenger_id: userId,
        defender_id: opponent.player_id,
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

  const startAutoSearch = async () => {
    setAutoSearching(true);
    try {
      if (opponents.length === 0) {
        await fetchArenaData();
      }

      const { data: myDeck } = await supabase.from('cards').select('*').eq('player_id', userId).eq('is_active', true);
      if (!myDeck || myDeck.length === 0) throw new Error('あなたのデッキが編成されていません。');

      const mySummary = summarizeDeck(myDeck, 'あなた');
      const match = [...opponents]
        .sort((left: any, right: any) => Math.abs(left.summary.totalPower - mySummary.totalPower) - Math.abs(right.summary.totalPower - mySummary.totalPower))[0];

      if (!match) throw new Error('現在、同格の対戦相手が見つかりません。');

      await initiateBattle(match);
    } catch (error: any) {
      Alert.alert('自動検索', error.message);
    } finally {
      setAutoSearching(false);
    }
  };

  const viewLog = (logData: any) => {
    const isWin = logData.winner_id === userId;
    setBattleResultTitle(isWin ? '🛡️ 防衛成功' : '💥 防衛失敗');
    setCurrentBattleLog(logData.battle_log);
    setBattleResultVisible(true);
  };

  const content = (
    <>
      {!embedded && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GLOBAL ARENA</Text>
          <Text style={styles.headerSub}>他プレイヤーとの遠隔非同期バトル</Text>
        </View>
      )}

      <View style={[styles.tabContainer, embedded && styles.embeddedTabContainer]}>
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
              ListHeaderComponent={
                <View style={styles.autoPanel}>
                  <Text style={styles.autoPanelTitle}>自動検索を押すと即時マッチングし、そのまま最後まで戦闘処理を完了します。</Text>
                  <TouchableOpacity style={[styles.autoSearchBtn, autoSearching && { opacity: 0.6 }]} onPress={startAutoSearch} disabled={autoSearching}>
                    <Text style={styles.autoSearchBtnText}>{autoSearching ? '検索中...' : '自動検索を開始'}</Text>
                  </TouchableOpacity>
                </View>
              }
              ListEmptyComponent={<Text style={styles.emptyText}>現在、アリーナに他のプレイヤーがいません。</Text>}
              renderItem={({ item }) => (
                <View style={styles.opponentCard}>
                  <View style={styles.opInfo}>
                    <Text style={styles.opName}>{item.player_name || '謎のプレイヤー'}</Text>
                    <Text style={styles.opStats}>属性: {item.summary.element} / 属性値: {item.summary.elementPower}</Text>
                    <Text style={styles.opPower}>総戦力: {item.summary.totalPower}</Text>
                  </View>
                  <TouchableOpacity style={styles.attackBtn} onPress={() => initiateBattle(item)}>
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
    </>
  );

  if (embedded) {
    return <View style={styles.embeddedContainer}>{content}</View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {content}
    </SafeAreaView>
  );
}

export default function ArenaScreen() {
  return <ArenaPanel />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  embeddedContainer: { backgroundColor: '#0F172A', borderRadius: 20, overflow: 'hidden', minHeight: 520, borderWidth: 1, borderColor: '#334155' },
  header: { padding: 16, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1 },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  embeddedTabContainer: { borderTopWidth: 0 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#E11D48' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 12 },
  activeTabText: { color: '#E11D48', fontWeight: '900' },
  autoPanel: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 14, marginBottom: 14 },
  autoPanelTitle: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, fontWeight: '700', marginBottom: 12 },
  autoSearchBtn: { backgroundColor: '#E11D48', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  autoSearchBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  
  opponentCard: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
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
