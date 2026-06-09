import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';

export default function BattleScreen() {
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isBattling, setIsBattling] = useState(false);
  const [loadingBoss, setLoadingBoss] = useState(false);
  
  // 周辺のボス情報
  const [detectedBoss, setDetectedBoss] = useState<any>(null);
  
  // AR演出用モーダル
  const [isArModalVisible, setArModalVisible] = useState(false);
  const [arUrl, setArUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkNearbyBoss();
    }, [])
  );

  // 🌍 GPSを感知し、周辺の店舗や観光地に紐づくNPCボスがいないかチェック
  const checkNearbyBoss = async () => {
    setLoadingBoss(true);
    try {
      const locationPerm = await Location.requestForegroundPermissionsAsync();
      if (!locationPerm.granted) return;

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;

      // 1. まず現在アクティブな位置連動キャンペーンを取得
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .not('target_lat', 'is', null);

      if (!campaigns) return;

      // 2. 距離を計算して、範囲内(radius_meters)にあるキャンペーンを1件特定
      const nearbyCampaign = campaigns.find((c: any) => {
        const dist = getDistance(latitude, longitude, c.target_lat, c.target_lng);
        return dist <= (c.radius_meters || 100);
      });

      if (nearbyCampaign) {
        // 3. キャンペーンに紐づくNPCボスデータを取得
        const { data: boss } = await supabase
          .from('bosses')
          .select('*, fixed_cards(*)') // 報酬カード情報も結合
          .eq('trigger_campaign_id', nearbyCampaign.id)
          .single();

        if (boss) {
          setDetectedBoss({
            ...boss,
            campaign_title: nearbyCampaign.title,
            sponsor_name: nearbyCampaign.sponsor_name
          });
        }
      } else {
        setDetectedBoss(null);
      }
    } catch (e) {
      console.log("ボス検知エラー", e);
    } finally {
      setLoadingBoss(false);
    }
  };

  // 2点間の距離(m)を計算
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // ⚔️ 通常のPVPバトル
  const startPvpBattle = async () => {
    setIsBattling(true);
    setBattleLog([]);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true).single();
    if (!myCard) {
      Alert.alert('エラー', '出撃中のカードがありません。DECKで設定してください。');
      setIsBattling(false);
      return;
    }

    const { data: oppCards } = await supabase.from('cards').select('*').neq('player_id', user.id).eq('is_active', true).limit(30);
    if (!oppCards || oppCards.length === 0) {
      Alert.alert('アリーナは静寂に包まれている', '対戦相手が見つかりません。');
      setIsBattling(false);
      return;
    }

    const oppCard = oppCards[Math.floor(Math.random() * oppCards.length)];
    simulateBattle(myCard, oppCard, false);
  };

  // 👹 エリアボス（NPC）バトル
  const startBossBattle = async () => {
    if (!detectedBoss) return;
    setIsBattling(true);
    setBattleLog([]);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true).single();
    if (!myCard) {
      Alert.alert('エラー', '出撃中のカードがありません。');
      setIsBattling(false);
      return;
    }

    // ボスの一時ステータスオブジェクトを作成
    const bossMonster = {
      card_name: `【BOSS】${detectedBoss.name}`,
      skill_name: 'カタストロフィ・ゼロ',
      status_hp: detectedBoss.hp,
      status_atk: detectedBoss.atk,
      status_def: detectedBoss.def,
      status_spd: 50, // ボスはやや鈍重
    };

    simulateBattle(myCard, bossMonster, true);
  };

  // 🥊 バトルシミュレーション共通ロジック
  const simulateBattle = (p1: any, p2: any, isBossMode: boolean) => {
    let log: string[] = [];
    log.push(`【BATTLE START】\n${p1.card_name} VS ${p2.card_name}`);

    let first = p1.status_spd >= p2.status_spd ? p1 : p2;
    let second = p1.status_spd >= p2.status_spd ? p2 : p1;
    let winner = null;

    let p1Hp = p1.status_hp;
    let p2Hp = p2.status_hp;

    for (let turn = 1; turn <= 5; turn++) {
      // 先制攻撃
      let dmg1 = Math.max(1, first.status_atk - Math.floor(second.status_def / 2) + Math.floor(Math.random() * 20 - 10));
      if (first === p1) p2Hp -= dmg1; else p1Hp -= dmg1;
      log.push(`[TURN ${turn}] ${first.card_name}の攻撃！\n『${first.skill_name}』を発動！\n${second.card_name}に ${dmg1} のダメージ！`);
      
      if (p1Hp <= 0) { winner = p2; break; }
      if (p2Hp <= 0) { winner = p1; break; }

      // 後攻反撃
      let dmg2 = Math.max(1, second.status_atk - Math.floor(first.status_def / 2) + Math.floor(Math.random() * 20 - 10));
      if (second === p1) p2Hp -= dmg2; else p1Hp -= dmg2;
      log.push(`[TURN ${turn}] ${second.card_name}の反撃！\n『${second.skill_name}』を発動！\n${first.card_name}に ${dmg2} のダメージ！`);
      
      if (p1Hp <= 0) { winner = p2; break; }
      if (p2Hp <= 0) { winner = p1; break; }
    }

    if (!winner) {
      log.push("⏳ 規定ターン数が経過。引き分けに終わった。");
    } else {
      log.push(`🏆 勝者：${winner.card_name}！`);
    }

    // ログを時間差で流す演出
    let currentLogIndex = 0;
    const interval = setInterval(async () => {
      if (currentLogIndex < log.length) {
        setBattleLog(prev => [...prev, log[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsBattling(false);

        // ★ ボス戦に勝利した場合のインセンティブ配給
        if (isBossMode && winner === p1) {
          await handleBossVictory();
        }
      }
    }, 600);
  };

  // 🏆 ボス討伐成功時の特権報酬処理
  const handleBossVictory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !detectedBoss) return;

    const reward = detectedBoss.fixed_cards;
    if (!reward) return;

    // ユーザーの手札に報酬の固定デザインカードをインサート
    const { error } = await supabase.from('cards').insert([{
      player_id: user.id,
      card_name: reward.card_name,
      image_url: reward.image_url,
      feature: reward.stats.feature || "ボス討伐限定の証",
      skill_name: reward.stats.skill || "レイド・ブレイク",
      status_hp: reward.stats.hp,
      status_atk: reward.stats.atk,
      status_def: reward.stats.def,
      status_spd: reward.stats.spd,
      status_total: reward.stats.hp + reward.stats.atk + reward.stats.def + reward.stats.spd,
      rarity: "P",
      card_type: 'local',
      is_fixed: true,
      ar_model_url: reward.ar_model_url
    }]);

    if (!error) {
      Alert.alert(
        "🎉 ボス討伐完了！",
        `周辺エリアの防衛に成功しました！限定カード「${reward.card_name}」を獲得！\nさらにAR討伐報酬（WebAR演出）が解放されました。`,
        [
          { text: "デッキ確認", style: "default" },
          { 
            text: "👁️ ARで演出を見る", 
            onPress: () => {
              if (reward.ar_model_url) {
                setArUrl(reward.ar_model_url);
                setArModalVisible(true);
              }
            },
            style: "destructive"
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea}>
        
        {/* 1. エリアボス（位置情報連動NPC）セクション */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>📍 エリアボス検知（店舗・観光地連動）</Text>
          
          {loadingBoss ? (
            <ActivityIndicator size="small" color="#38bdf8" style={{ padding: 20 }} />
          ) : detectedBoss ? (
            <View style={styles.bossPanel}>
              <Text style={styles.sponsorName}>【コラボ: {detectedBoss.sponsor_name}】</Text>
              <Text style={styles.bossName}>👹 {detectedBoss.name}</Text>
              <Text style={styles.bossEvent}>{detectedBoss.campaign_title}</Text>
              
              <View style={styles.bossStatsRow}>
                <Text style={styles.bossStat}>HP: {detectedBoss.hp}</Text>
                <Text style={styles.bossStat}>ATK: {detectedBoss.atk}</Text>
                <Text style={styles.bossStat}>DEF: {detectedBoss.def}</Text>
              </View>

              <TouchableOpacity 
                style={[styles.bossBattleBtn, isBattling && styles.btnDisabled]} 
                onPress={startBossBattle}
                disabled={isBattling}
              >
                <Text style={styles.bossBattleBtnText}>{isBattling ? '戦闘中...' : 'エリアボスに挑む'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noBossPanel}>
              <Text style={styles.noBossText}>周辺に限定ボスは検知されませんでした。</Text>
              <Text style={styles.noBossSub}>対象の店舗や観光地・史跡へ向かってください。</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={checkNearbyBoss}>
                <Text style={styles.refreshBtnText}>🔄 レーダー再スキャン</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2. 通常のPVP対戦アリーナセクション */}
        <View style={[styles.sectionContainer, { marginTop: 10 }]}>
          <Text style={styles.sectionHeader}>⚔️ レギュラーアリーナ（通常PVP対戦）</Text>
          <View style={styles.pvpPanel}>
            <TouchableOpacity 
              style={[styles.pvpBattleBtn, isBattling && styles.btnDisabled]} 
              onPress={startPvpBattle}
              disabled={isBattling}
            >
              <Text style={styles.pvpBattleBtnText}>{isBattling ? '戦闘中...' : 'ライバル司令官を探す'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. 戦闘シミュレーションのログ出力ログ */}
        {battleLog.length > 0 && (
          <View style={styles.logContainer}>
            <Text style={styles.logHeader}>BATTLE LOG SIMULATOR</Text>
            {battleLog.map((log, index) => (
              <View key={index} style={styles.logBox}>
                <Text style={styles.logText}>{log}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 討伐報酬AR起動用のフルスクリーンWebViewモーダル */}
      <Modal visible={isArModalVisible} animationType="slide" onRequestClose={() => setArModalVisible(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🎉 討伐成功AR報酬</Text>
          <TouchableOpacity onPress={() => setArModalVisible(false)} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
        {arUrl && (
          <WebView 
            source={{ uri: arUrl }} 
            style={{ flex: 1, backgroundColor: 'black' }}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scrollArea: { flex: 1 },
  sectionContainer: { padding: 15 },
  sectionHeader: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  
  // ボスパネル関連
  bossPanel: { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderWidth: 1, borderColor: '#f43f5e', padding: 20, borderRadius: 16, alignItems: 'center' },
  sponsorName: { color: '#f43f5e', fontSize: 11, fontWeight: 'bold' },
  bossName: { color: '#ffffff', fontSize: 22, fontWeight: '900', marginVertical: 6, letterSpacing: 1 },
  bossEvent: { color: '#cbd5e1', fontSize: 13, marginBottom: 15, textAlign: 'center' },
  bossStatsRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  bossStat: { color: '#f87171', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' },
  bossBattleBtn: { backgroundColor: '#f43f5e', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25 },
  bossBattleBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  
  // ボス未検知
  noBossPanel: { backgroundColor: '#0f172a', padding: 25, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  noBossText: { color: '#64748b', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  noBossSub: { color: '#475569', fontSize: 11, marginBottom: 15 },
  refreshBtn: { backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  refreshBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },

  // PVPパネル
  pvpPanel: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  pvpBattleBtn: { backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 50, borderRadius: 25, borderWidth: 1, borderColor: '#334155' },
  pvpBattleBtnText: { color: '#f1f5f9', fontWeight: '900', fontSize: 15 },
  btnDisabled: { backgroundColor: '#475569', borderColor: '#475569' },

  // ログ出力エリア
  logContainer: { padding: 15, borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 10 },
  logHeader: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', fontFamily: 'monospace' },
  logBox: { backgroundColor: 'rgba(56, 189, 248, 0.05)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.15)', padding: 12, borderRadius: 10, marginBottom: 8 },
  logText: { color: '#cbd5e1', fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },

  // モーダル
  modalHeader: { height: 60, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  modalTitle: { color: '#f43f5e', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#334155', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  closeBtnText: { color: 'white', fontWeight: 'bold' }
});
