import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ShieldAlert, Users, Swords } from 'lucide-react-native';

export default function BattleScreen() {
  const [battleLog, setBattleLog] = useState<any[]>([]); // 演出用のスタイル付きログを入れるためany型に拡張
  const [isBattling, setIsBattling] = useState(false);
  const [loadingBoss, setLoadingBoss] = useState(false);
  const [detectedBoss, setDetectedBoss] = useState<any>(null);
  const [isArModalVisible, setArModalVisible] = useState(false);
  const [arUrl, setArUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => { checkNearbyBoss(); }, [])
  );

  const checkNearbyBoss = async () => {
    setLoadingBoss(true);
    try {
      const locationPerm = await Location.requestForegroundPermissionsAsync();
      if (!locationPerm.granted) return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;

      const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true).not('target_lat', 'is', null);
      if (!campaigns) return;

      const nearbyCampaign = campaigns.find((c: any) => {
        const dist = getDistance(latitude, longitude, c.target_lat, c.target_lng);
        return dist <= (c.radius_meters || 100);
      });

      if (nearbyCampaign) {
        const { data: boss } = await supabase.from('bosses').select('*, fixed_cards(*)').eq('trigger_campaign_id', nearbyCampaign.id).single();
        if (boss) {
          setDetectedBoss({ ...boss, campaign_title: nearbyCampaign.title, sponsor_name: nearbyCampaign.sponsor_name });
        }
      } else { setDetectedBoss(null); }
    } catch (e) { console.log(e); } finally { setLoadingBoss(false); }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // ⚔️ 【改善】同格プレイヤーマッチング＆PVP
  const startPvpBattle = async () => {
    setIsBattling(true);
    setBattleLog([]);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 自分の出撃カード取得
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true).single();
    if (!myCard) {
      Alert.alert('準備不足', '出撃中のカードがありません。「図鑑」タブからカードを出撃させてください。');
      setIsBattling(false);
      return;
    }

    // ★ 同格マッチング：自分の総合ステータス（status_total）の±25%以内の相手だけを抽出
    const minStatus = Math.floor(myCard.status_total * 0.75);
    const maxStatus = Math.floor(myCard.status_total * 1.25);

    const { data: oppCards } = await supabase
      .from('cards')
      .select('*')
      .neq('player_id', user.id)
      .eq('is_active', true)
      .gte('status_total', minStatus)
      .lte('status_total', maxStatus)
      .limit(20);

    if (!oppCards || oppCards.length === 0) {
      Alert.alert('索敵中', '現在、あなたと同格のライバル司令官が見つかりませんでした。時間をおいて再度お試しください。');
      setIsBattling(false);
      return;
    }

    const oppCard = oppCards[Math.floor(Math.random() * oppCards.length)];
    simulateBattle(myCard, oppCard, false);
  };

  // 👹 エリアボス戦起動
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

    const bossMonster = {
      id: 'BOSS_NPC',
      card_name: `【エリアボス】${detectedBoss.name}`,
      skill_name: 'カタストロフィ・レイ',
      status_hp: detectedBoss.hp,
      status_atk: detectedBoss.atk,
      status_def: detectedBoss.def,
      status_spd: 40,
      level: 10,
      rarity: '👑'
    };

    simulateBattle(myCard, bossMonster, true);
  };

  // 💥 【目玉機能】カードの格（レベル・レアリティ・攻撃力）によって演出を派手にするエフェクト生成装置
  const generateVisualLog = (attacker: any, defender: any, damage: number, skillUsed: string, turn: number) => {
    let prefix = '';
    let suffix = '';
    let isSpecialStyle = false;

    // 1. 攻撃力やレベルによる派手さ判定
    if (attacker.status_atk >= 200 || attacker.level >= 15) {
      prefix = '🔥【限界突破】💥 ';
      suffix = ' 💥!!!';
      isSpecialStyle = true;
    } else if (attacker.status_atk >= 100 || attacker.level >= 5) {
      prefix = '⚡ ';
      suffix = ' !';
    }

    // 2. レアリティ（企業コラボカードやシークレットなど）による装飾追加
    if (attacker.rarity === 'CP' || attacker.rarity === 'P' || attacker.rarity === '★★★★') {
      prefix = `✨🌟 ${prefix}`;
      suffix = `${suffix} 🌟✨\n(企業協賛の演出がフィールドを包む！)`;
      isSpecialStyle = true;
    }

    return {
      text: `[第 ${turn} ターン]\n${prefix}${attacker.card_name}のわざ『${skillUsed}』が炸裂！\n${defender.card_name}に ${damage} の痛撃を与えた！`,
      isSpecial: isSpecialStyle
    };
  };

  // 🥊 バトルシミュレーション
  const simulateBattle = (p1: any, p2: any, isBossMode: boolean) => {
    let log: any[] = [];
    log.push({ text: `🏁 【対戦開始】\n${p1.card_name} (Lv.${p1.level}) \n   VS \n${p2.card_name} (Lv.${p2.level})`, isSpecial: true });

    let first = p1.status_spd >= p2.status_spd ? p1 : p2;
    let second = p1.status_spd >= p2.status_spd ? p2 : p1;
    let winner = null;

    let p1Hp = p1.status_hp;
    let p2Hp = p2.status_hp;

    for (let turn = 1; turn <= 5; turn++) {
      // 先攻攻撃
      let dmg1 = Math.max(1, first.status_atk - Math.floor(second.status_def / 2) + Math.floor(Math.random() * 10));
      if (first === p1) p2Hp -= dmg1; else p1Hp -= dmg1;
      log.push(generateVisualLog(first, second, dmg1, first.skill_name, turn));
      
      if (p1Hp <= 0) { winner = p2; break; }
      if (p2Hp <= 0) { winner = p1; break; }

      // 後攻反撃
      let dmg2 = Math.max(1, second.status_atk - Math.floor(first.status_def / 2) + Math.floor(Math.random() * 10));
      if (second === p1) p2Hp -= dmg2; else p1Hp -= dmg2;
      log.push(generateVisualLog(second, first, dmg2, second.skill_name, turn));
      
      if (p1Hp <= 0) { winner = p2; break; }
      if (p2Hp <= 0) { winner = p1; break; }
    }

    if (!winner) {
      log.push({ text: "⏳ 規定ターン数が経過。決着がつかず引き分け。", isSpecial: false });
    } else {
      log.push({ text: `🏆 【試合終了】\n勝者：${winner.card_name}！`, isSpecial: true });
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

        // バトル終了後の経験値・報酬処理
        if (winner === p1) {
          if (isBossMode) {
            await handleBossVictory();
          } else {
            await handlePvpVictory(p1.id);
          }
        } else {
          // 負けても救済として少しだけ経験値が入る
          await handlePvpLoss(p1.id);
        }
      }
    }, 800);
  };

  // 🎉 PVP勝利時の経験値獲得処理
  const handlePvpVictory = async (cardId: string) => {
    const { data, error } = await supabase.rpc('gain_card_exp', { target_card_id: cardId, exp_to_add: 120 }); // 勝利時120exp
    if (!error && data[0]) {
      if (data[0].leveled_up) {
        Alert.alert('🎉 レベルアップ!!!', `出撃カードが レベル ${data[0].new_level} に到達しました！全能力値が5%強化されました。`);
      } else {
        Alert.alert('作戦成功', 'バトルに勝利し、出撃カードが 120 の経験値を獲得しました。');
      }
    }
  };

  // 📈 PVP敗北時の救済経験値
  const handlePvpLoss = async (cardId: string) => {
    const { data, error } = await supabase.rpc('gain_card_exp', { target_card_id: cardId, exp_to_add: 30 }); // 敗北でも30exp
    if (!error && data[0] && data[0].leveled_up) {
      Alert.alert('🎉 レベルアップ(粘りの成果)!', `カードが レベル ${data[0].new_level} に上がりました！`);
    } else {
      Alert.alert('敗北', 'バトルに敗れましたが、カードは経験値を 30 獲得して成長しました。');
    }
  };

  const handleBossVictory = async () => {
    const reward = detectedBoss.fixed_cards;
    if (!reward) return;

    await supabase.from('cards').insert([{
      player_id: (await supabase.auth.getUser()).data.user?.id,
      card_name: reward.card_name,
      image_url: reward.image_url,
      feature: reward.stats.feature || "エリアボス討伐の証",
      skill_name: reward.stats.skill || "レイド・バースト",
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

    Alert.alert("👹 ボス討伐完了！", `限定カード「${reward.card_name}」を獲得しました！`, [
      { text: "閉じる" },
      { text: "👁️ AR報酬を見る", onPress: () => { if (reward.ar_model_url) { setArUrl(reward.ar_model_url); setArModalVisible(true); } }, style: "destructive" }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollArea}>
        
        {/* 1. エリアボス */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 周辺のスポット限定ボス</Text>
          {loadingBoss ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ padding: 20 }} />
          ) : detectedBoss ? (
            <View style={styles.bossPanel}>
              <Text style={styles.sponsorTag}>{detectedBoss.sponsor_name} 協賛</Text>
              <Text style={styles.bossName}>👹 {detectedBoss.name}</Text>
              <TouchableOpacity style={[styles.primaryButton, isBattling && styles.disabledButton]} onPress={startBossBattle} disabled={isBattling}>
                <Text style={styles.btnText}>ボスに挑む</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <ShieldAlert color="#94A3B8" size={24} />
              <Text style={styles.emptyText}>周辺に限定ボスはいません。対象の観光地や店舗へ向かいましょう。</Text>
            </View>
          )}
        </View>

        {/* 2. PVP対戦アリーナ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚔️ 全国オンライン対戦（同格マッチング）</Text>
          <View style={styles.pvpPanel}>
            <View style={styles.iconRow}><Users color="#3B82F6" size={28} style={{marginRight: 10}} /><Swords color="#3B82F6" size={28} /></View>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#0F172A' }, isBattling && styles.disabledButton]} onPress={startPvpBattle} disabled={isBattling}>
              <Text style={styles.btnText}>{isBattling ? '戦闘計算中...' : '同格の対戦相手を探す'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. バトルログ出力 */}
        {battleLog.length > 0 && (
          <View style={styles.logSection}>
            <Text style={styles.logSectionTitle}>⚡ バルト実況・ログシミュレーター</Text>
            {battleLog.map((log, index) => (
              <View key={index} style={[styles.logBox, log.isSpecial && styles.specialLogBox]}>
                <Text style={[styles.logText, log.isSpecial && styles.specialLogText]}>{log.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ARモーダル */}
      <Modal visible={isArModalVisible} animationType="slide" onRequestClose={() => setArModalVisible(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🎉 討伐成功AR報酬</Text>
          <TouchableOpacity onPress={() => setArModalVisible(false)} style={styles.closeBtn}><Text style={styles.closeBtnText}>閉じる</Text></TouchableOpacity>
        </View>
        {arUrl && <WebView source={{ uri: arUrl }} style={{ flex: 1 }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollArea: { flex: 1 },
  section: { padding: 20 },
  sectionTitle: { color: '#64748B', fontSize: 13, fontWeight: '700', marginBottom: 12, letterSpacing: 1 },
  
  bossPanel: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FEE2E2', padding: 20, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  sponsorTag: { color: '#EF4444', fontSize: 12, fontWeight: '800', backgroundColor: '#FFEEEE', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  bossName: { color: '#1E293B', fontSize: 20, fontWeight: '900', marginVertical: 15 },
  
  emptyPanel: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '600', lineHeight: 20 },
  
  pvpPanel: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  iconRow: { flexDirection: 'row', marginBottom: 20 },
  
  primaryButton: { backgroundColor: '#3B82F6', width: '100%', height: 55, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  disabledButton: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  
  logSection: { padding: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  logSectionTitle: { color: '#475569', fontSize: 12, fontWeight: '800', marginBottom: 15, textAlign: 'center', fontFamily: 'monospace' },
  logBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', padding: 16, borderRadius: 16, marginBottom: 12 },
  specialLogBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1.5 },
  logText: { color: '#334155', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  specialLogText: { color: '#1E40AF', fontWeight: '800' },

  modalHeader: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { color: '#EF4444', fontSize: 16, fontWeight: '800' },
  closeBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  closeBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 }
});
