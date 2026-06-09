import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function BattleScreen() {
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isBattling, setIsBattling] = useState(false);

  const startBattle = async () => {
    setIsBattling(true);
    setBattleLog([]);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 自分のアクティブカードを取得
    const { data: myCardData } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .eq('is_active', true)
      .single();

    if (!myCardData) {
      Alert.alert('エラー', '出撃中のカードがありません。DECKで設定してください。');
      setIsBattling(false);
      return;
    }

    // 相手のアクティブカードをランダムに1件取得 (PostgreSQLの関数かクライアントフィルタで擬似的に)
    // ※今回は簡易的に全アクティブカードから自分以外を1件引く処理
    const { data: oppCards } = await supabase
      .from('cards')
      .select('*, profiles(player_name)')
      .neq('player_id', user.id)
      .eq('is_active', true)
      .limit(50); // ランダム性を持たせるため多めに取得

    if (!oppCards || oppCards.length === 0) {
      Alert.alert('アリーナは静寂に包まれている', '現在、対戦相手が見つかりません。');
      setIsBattling(false);
      return;
    }

    const oppCardData = oppCards[Math.floor(Math.random() * oppCards.length)];

    // バトルシミュレーション
    simulateBattle(myCardData, oppCardData);
  };

  const simulateBattle = (p1: any, p2: any) => {
    let log = [];
    log.push(`【BATTLE START】\n${p1.card_name} VS ${p2.card_name}`);

    let first = p1.status_spd >= p2.status_spd ? p1 : p2;
    let second = p1.status_spd >= p2.status_spd ? p2 : p1;
    let winner = null;

    for (let turn = 1; turn <= 5; turn++) {
      let dmg1 = Math.max(1, first.status_atk - Math.floor(second.status_def / 2) + Math.floor(Math.random() * 20 - 10));
      second.status_hp -= dmg1;
      log.push(`[TURN ${turn}] ${first.card_name}の『${first.skill_name}』！\n${second.card_name}に ${dmg1} のダメージ！ (残りHP: ${second.status_hp})`);
      
      if (second.status_hp <= 0) { winner = first; break; }

      let dmg2 = Math.max(1, second.status_atk - Math.floor(first.status_def / 2) + Math.floor(Math.random() * 20 - 10));
      first.status_hp -= dmg2;
      log.push(`[TURN ${turn}] ${second.card_name}の反撃！『${second.skill_name}』！\n${first.card_name}に ${dmg2} のダメージ！ (残りHP: ${first.status_hp})`);
      
      if (first.status_hp <= 0) { winner = second; break; }
    }

    if (!winner) {
      log.push("⏳ 5ターン経過。両者消耗し引き分けに終わった。");
    } else {
      log.push(`🏆 勝者：${winner.card_name}！`);
      // TODO: ここに勝者の報酬や強奪（アンティ）処理のDBアップデートを追加する
    }

    // ログを少しずつ表示する演出
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < log.length) {
        setBattleLog(prev => [...prev, log[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsBattling(false);
      }
    }, 800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>BATTLE ARENA</Text>
        <TouchableOpacity 
          style={[styles.battleBtn, isBattling && styles.battleBtnDisabled]} 
          onPress={startBattle}
          disabled={isBattling}
        >
          <Text style={styles.battleBtnText}>{isBattling ? '戦闘中...' : '対戦相手を探す'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logArea} contentContainerStyle={{ padding: 15 }}>
        {battleLog.map((log, index) => (
          <View key={index} style={styles.logBox}>
            <Text style={styles.logText}>{log}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  headerArea: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: 'rgba(15, 23, 42, 0.8)' },
  title: { fontSize: 24, fontWeight: '900', color: '#f87171', marginBottom: 15, letterSpacing: 2 },
  battleBtn: { backgroundColor: '#b91c1c', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 10 },
  battleBtnDisabled: { backgroundColor: '#475569', shadowOpacity: 0 },
  battleBtnText: { color: 'white', fontWeight: '900', fontSize: 16 },
  logArea: { flex: 1 },
  logBox: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', padding: 15, borderRadius: 10, marginBottom: 10 },
  logText: { color: '#e2e8f0', fontFamily: 'monospace', lineHeight: 20 }
});
