import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, ScrollView, Alert, Animated } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

// 🌌 ランダムボスのデザイン（画像プール）
const RANDOM_BOSS_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80', // サイバー・コア
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=500&q=80', // ダーク・アブストラクト
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&q=80', // ネオン・ネメシス
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80', // 古代の遺物ギア
];

// 🌌 ランダムボスの名前（接頭辞 × 接尾辞で無限生成）
const BOSS_PREFIX = ['カオス・', 'ヴァイラス・', 'サイバー・', 'ヴォイド・', 'ファントム・'];
const BOSS_SUFFIX = ['タイタン', 'レイス', 'ドローン', 'ジェネレーター', 'ビースト'];

export default function BattleScreen() {
  const [loading, setLoading] = useState(true);
  
  const [deck, setDeck] = useState<any[]>([]);
  const [boss, setBoss] = useState<any>(null);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(0);
  
  const [partyHp, setPartyHp] = useState(0);
  const [partyMaxHp, setPartyMaxHp] = useState(0);
  const [bossAtkDebuff, setBossAtkDebuff] = useState(1.0); 

  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [isBattleOver, setIsBattleOver] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // アニメーション用の値
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState('rgba(255, 0, 0, 0.4)');

  useFocusEffect(
    useCallback(() => {
      fetchBattleData();
    }, [])
  );

  // 🎲 限定ボスがいなければ、その場で野生のボスを「自動生成」するロジック
  const generateRandomBoss = () => {
    const pfx = BOSS_PREFIX[Math.floor(Math.random() * BOSS_PREFIX.length)];
    const sfx = BOSS_SUFFIX[Math.floor(Math.random() * BOSS_SUFFIX.length)];
    const randomName = `${pfx}${sfx}`;
    const randomImg = RANDOM_BOSS_IMAGES[Math.floor(Math.random() * RANDOM_BOSS_IMAGES.length)];
    
    // ステータスもランダム自動生成
    const randomHp = Math.floor(Math.random() * 600) + 600; // 600〜1200
    const randomAtk = Math.floor(Math.random() * 80) + 100;  // 100〜180
    const randomDef = Math.floor(Math.random() * 40) + 40;   // 40〜80

    return {
      id: 'random-generated-boss',
      name: `👾 野生: ${randomName}`,
      hp: randomHp,
      atk: randomAtk,
      def: randomDef,
      image_url: randomImg,
      is_active: true
    };
  };

  const fetchBattleData = async () => {
    setLoading(true);
    setIsBattleOver(false);
    setBossAtkDebuff(1.0);
    setBattleLogs(['【システム】周囲の量子エネルギーをスキャン中...']);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. デッキ取得
    const { data: deckData, error: deckError } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .eq('is_active', true);

    if (deckError || !deckData || deckData.length === 0) {
      setLoading(false);
      Alert.alert('出撃エラー', 'デッキにカードが編成されていません。図鑑画面でカードを「デッキに編成」してください。');
      return;
    }

    // 2. データベースから稼働中の限定ボスを検索
    const { data: bossData } = await supabase
      .from('bosses')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(); // 該当なしでもクラッシュさせない

    let finalBoss = bossData;

    // 💡【新規：ランダムボス生成】限定ボスがいなければ、その場で野生ボスを自動ビルド
    if (!finalBoss) {
      finalBoss = generateRandomBoss();
      addLog(`⚡【空間歪み検知】周囲に協賛限定ボスは存在しません。`);
    } else {
      addLog(`📍【エリア限定指令】スポンサー協賛ボスを捕捉。`);
    }

    const totalHp = deckData.reduce((sum, card) => sum + (card.status_hp || 100), 0);

    setDeck(deckData);
    setBoss(finalBoss);
    setBossMaxHp(finalBoss.hp);
    setBossHp(finalBoss.hp);
    setPartyMaxHp(totalHp);
    setPartyHp(totalHp);
    
    addLog(`⚠️ 警告：${finalBoss.name} が目の前に現れた！`);
    addLog(`【システム】迎撃コマンドを実行してください。`);
    setLoading(false);
  };

  const addLog = (message: string) => {
    setBattleLogs(prev => [...prev, message]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const triggerShake = (intensity = 1) => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10 * intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10 * intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10 * intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true })
    ]).start();
  };

  const triggerFlash = (color: string) => {
    setFlashColor(color);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true })
    ]).start();
  };

  const executeTurn = async (selectedCard: any) => {
    if (isBattleOver || loading) return;

    const cardName = selectedCard.card_name || '名もなき戦士';
    const cardRole = selectedCard.card_role || 'attacker';
    const skillName = selectedCard.skill_name || '通常攻撃';
    const cardAtk = selectedCard.status_atk || 10;

    let currentBossHp = bossHp;
    let currentPartyHp = partyHp;

    // --- 1. プレイヤーの行動フェーズ ---
    if (cardRole === 'support') {
      const rand = Math.random();
      if (rand > 0.8) {
        // 禁忌の自爆技
        const sacrificeDmg = Math.floor(partyMaxHp * 0.15);
        const massiveDmg = cardAtk * 4;
        currentPartyHp = Math.max(1, currentPartyHp - sacrificeDmg);
        currentBossHp = Math.max(0, currentBossHp - massiveDmg);
        triggerFlash('rgba(147, 51, 234, 0.6)'); // 禁忌の紫
        triggerShake(2.0);
        addLog(`☠️ [${cardName}] の禁忌技『${skillName}』！\n自らのフレームを破壊し、${boss.name} に ${massiveDmg} の反物質ダメージ！！(味方反動:${sacrificeDmg})`);
      } else if (rand > 0.5) {
        // デバフ（敵のATK低下）
        setBossAtkDebuff(0.4); 
        triggerFlash('rgba(14, 165, 233, 0.4)'); // スカイブルー
        addLog(`🌫️ [${cardName}] のデバフ技『${skillName}』！\n妨害電波を放射し、ボスの次回の攻撃力を【60%ダウン】させた！`);
      } else {
        // 回復
        const healAmount = cardAtk * 2;
        currentPartyHp = Math.min(partyMaxHp, currentPartyHp + healAmount);
        triggerFlash('rgba(16, 185, 129, 0.4)'); // ヒールグリーン
        addLog(`✨ [${cardName}] の支援技『${skillName}』！\nナノマシンを展開し、パーティのHPを ${healAmount} 修復した！`);
      }
      setPartyHp(currentPartyHp);
      setBossHp(currentBossHp);
    } else {
      // アタッカーの物理攻撃
      const damage = Math.max(1, cardAtk - (boss.def || 0) / 2);
      const finalDamage = Math.floor(damage * (1 + Math.random() * 0.2));
      currentBossHp = Math.max(0, currentBossHp - finalDamage);
      
      if (cardAtk >= 150) {
        triggerFlash('rgba(251, 191, 36, 0.6)'); // UR級ゴールド
        triggerShake(1.6);
        addLog(`🌟 [${cardName}] の超絶必殺『${skillName}』！！\n空間を断ち切る最強の閃光が炸裂！ ${boss.name} に ${finalDamage} の大ダメージ！`);
      } else if (cardAtk >= 100) {
        triggerFlash('rgba(239, 68, 68, 0.5)'); // SR級レッド
        triggerShake(1.0);
        addLog(`🔥 [${cardName}] の『${skillName}』！\n激しいエネルギー波を照射！ ${boss.name} に ${finalDamage} のダメージ！`);
      } else {
        triggerShake(0.4);
        addLog(`⚔️ [${cardName}] の『${skillName}』！\nターゲットを捕捉し、 ${finalDamage} の通常ダメージ！`);
      }
      setBossHp(currentBossHp);
    }

    // ボス討伐判定
    if (currentBossHp <= 0) {
      triggerFlash('rgba(255, 255, 255, 0.9)');
      triggerShake(3.0);
      addLog(`🎉 MISSION COMPLETE：${boss.name} の完全破壊に成功！`);
      setIsBattleOver(true);
      return;
    }

    // --- 2. ボス（NPC）の高度なスキル発動フェーズ ---
    // 💡【新規：敵もド派手なスキルを駆使してくる演出】
    setLoading(true); // ボスの思考演出のため一瞬操作ロック
    setTimeout(() => {
      const baseBossAtk = (boss.atk || 20) * bossAtkDebuff;
      setBossAtkDebuff(1.0); // デバフを消費

      const bossRand = Math.random();
      let finalBossDamage = 0;

      if (bossRand > 0.7) {
        // 敵専用スキルA：全体即死級バースト
        finalBossDamage = Math.floor((baseBossAtk * 1.6) * (1 + Math.random() * 0.1));
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        triggerFlash('rgba(225, 29, 72, 0.7)'); // 凶悪な赤
        triggerShake(2.2);
        addLog(`🚨 警告！${boss.name} のカタストロフ・スキル！！\n『終焉のオーバーロード』が発動！破壊光線によりパーティ全員に ${finalBossDamage} の壊滅的ダメージ！`);
      } else if (bossRand > 0.4) {
        // 敵専用スキルB：ライフドレイン（攻撃しつつ自分を回復）
        finalBossDamage = Math.floor(baseBossAtk * (1 + Math.random() * 0.2));
        const drainHeal = Math.floor(finalBossDamage * 0.5);
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        currentBossHp = Math.min(bossMaxHp, currentBossHp + drainHeal);
        
        triggerFlash('rgba(236, 72, 153, 0.5)'); // 吸血ピンク
        triggerShake(1.0);
        setBossHp(currentBossHp);
        addLog(`🧛 ${boss.name} の吸命スキル！！\n『ソウル・ドレイン』を喰らった！味方に ${finalBossDamage} ダメージを与え、ボスの体力が ${drainHeal} 回復した！`);
      } else {
        // 通常反撃
        finalBossDamage = Math.floor(baseBossAtk * (1 + Math.random() * 0.2));
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        triggerFlash('rgba(241, 245, 249, 0.3)'); 
        triggerShake(0.8);
        addLog(`💀 ${boss.name} のカウンターアタック！\n強烈な一撃を受け、パーティ全体のHPが ${finalBossDamage} 減少した。`);
      }

      setPartyHp(currentPartyHp);
      setLoading(false);

      if (currentPartyHp <= 0) {
        addLog(`☠️ MISSION FAILED：あなたの軍勢は全滅した...。`);
        setIsBattleOver(true);
      }
    }, 1200); // ボスのチャージ時間演出（1.2秒）
  };

  if (loading && !boss) return (
    <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#0ea5e9" /></SafeAreaView>
  );

  const bossHpPercent = Math.max(0, (bossHp / bossMaxHp) * 100);
  const partyHpPercent = Math.max(0, (partyHp / partyMaxHp) * 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* 画面フラッシュ用レイヤー */}
      <Animated.View style={[styles.flashOverlay, { backgroundColor: flashColor, opacity: flashAnim }]} pointerEvents="none" />
      
      {/* 画面シェイク用コンテナ */}
      <Animated.View style={[styles.innerContainer, { transform: [{ translateX: shakeAnim }] }]}>
        
        {/* ボスエリア */}
        <View style={styles.enemyArea}>
          <Image source={{ uri: boss?.image_url || 'https://via.placeholder.com/150' }} style={styles.bossAvatar} />
          <Text style={styles.bossName}>{boss?.name}</Text>
          <View style={styles.hpBarContainer}>
            <View style={[styles.hpBarFill, { width: `${bossHpPercent}%`, backgroundColor: '#E11D48' }]} />
          </View>
          <Text style={styles.hpText}>BOSS HP: {bossHp} / {bossMaxHp}</Text>
        </View>

        {/* リアルタイムバトルログ */}
        <ScrollView style={styles.logArea} ref={scrollViewRef}>
          {battleLogs.map((log, index) => <Text key={index} style={styles.logText}>{log}</Text>)}
          {isBattleOver && (
            <TouchableOpacity style={styles.retreatBtn} onPress={fetchBattleData}>
              <Text style={styles.retreatBtnText}>次の戦域をスキャンする（リセット）</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* プレイヤーデッキ操作エリア */}
        <View style={styles.playerArea}>
          <Text style={styles.partyName}>司令部コマンド（布陣: {deck.length}枚）</Text>
          <View style={styles.hpBarContainer}>
            <View style={[styles.hpBarFill, { width: `${partyHpPercent}%`, backgroundColor: '#10B981' }]} />
          </View>
          <Text style={styles.hpText}>PARTY HP: {partyHp} / {partyMaxHp}</Text>
          <Text style={styles.instructionText}>カードを戦術タップしてスキルを発動せよ↓</Text>
          
          <View style={styles.deckContainer}>
            <FlatList
              data={deck}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSupport = item.card_role === 'support';
                return (
                  <TouchableOpacity 
                    style={[styles.cardBtn, isBattleOver && styles.cardBtnDisabled]} 
                    onPress={() => executeTurn(item)}
                    disabled={isBattleOver || loading}
                  >
                    <Image source={{ uri: item.image_url || 'https://via.placeholder.com/100' }} style={styles.cardImage} />
                    <View style={[styles.roleBadge, isSupport ? styles.roleSupport : styles.roleAttacker]}>
                      <Text style={styles.roleText}>{isSupport ? '🛡️' : '⚔️'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
        
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  innerContainer: { flex: 1, backgroundColor: '#0F172A' },
  flashOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  enemyArea: { padding: 16, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#334155' },
  bossAvatar: { width: 70, height: 70, borderRadius: 35, marginBottom: 8, borderWidth: 2, borderColor: '#E11D48', backgroundColor: '#000' },
  bossName: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  
  hpBarContainer: { width: '100%', height: 12, backgroundColor: '#334155', borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  hpBarFill: { height: '100%', borderRadius: 6 },
  hpText: { color: '#CBD5E1', fontSize: 11, fontWeight: '800', alignSelf: 'flex-end' },

  logArea: { flex: 1, padding: 14, backgroundColor: '#000000' },
  logText: { color: '#38BDF8', fontSize: 13, marginBottom: 10, lineHeight: 20, fontWeight: '600', fontFamily: 'monospace' },
  
  playerArea: { padding: 16, backgroundColor: '#1E293B', borderTopWidth: 2, borderTopColor: '#334155', paddingBottom: 24 },
  partyName: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  instructionText: { color: '#94A3B8', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 8, fontWeight: '700' },
  deckContainer: { height: 110 },
  cardBtn: { width: 75, height: 100, marginRight: 10, borderRadius: 8, borderWidth: 2, borderColor: '#475569', overflow: 'hidden', position: 'relative' },
  cardBtnDisabled: { opacity: 0.3 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  roleBadge: { position: 'absolute', top: 4, right: 4, padding: 4, borderRadius: 12, backgroundColor: '#00000090' },
  roleAttacker: { borderColor: '#FCA5A5', borderWidth: 1 },
  roleSupport: { borderColor: '#86EFAC', borderWidth: 1 },
  roleText: { fontSize: 9 },
  retreatBtn: { backgroundColor: '#E11D48', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  retreatBtnText: { color: '#F8FAFC', fontWeight: '800', fontSize: 14 }
});