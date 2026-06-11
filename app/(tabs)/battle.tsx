import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, ScrollView, Alert, Animated, Easing } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

// 🌌 ボスの画像プール
const BOSS_IMAGES = {
  small: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=150&q=80',
  medium: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&q=80',
  large: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=150&q=80',
  special: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&q=80'
};

export default function BattleScreen() {
  const [loading, setLoading] = useState(true);
  const [screenMode, setScreenMode] = useState<'explore' | 'battle'>('explore'); // explore(マップ) か battle(戦闘)
  
  // デッキ情報
  const [deck, setDeck] = useState<any[]>([]);
  const [partyHp, setPartyHp] = useState(0);
  const [partyMaxHp, setPartyMaxHp] = useState(0);

  // マップ上の周辺ボス一覧（固定の相対座標でプロット）
  const [nearbyBosses, setNearbyBosses] = useState<any[]>([]);
  const [selectedMapBoss, setSelectedMapBoss] = useState<any | null>(null);

  // 現在戦闘中のボス情報
  const [boss, setBoss] = useState<any>(null);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(0);
  const [bossAtkDebuff, setBossAtkDebuff] = useState(1.0);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [isBattleOver, setIsBattleOver] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // アニメーション用の値
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const radarPulseAnim = useRef(new Animated.Value(0)).current; // レーダーの波紋用
  const [flashColor, setFlashColor] = useState('rgba(255, 0, 0, 0.4)');

  // レーダーのパルス（波紋）アニメーションループ
  useEffect(() => {
    Animated.loop(
      Animated.timing(radarPulseAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDeckData();
    }, [])
  );

  // 1. プレイヤーのデッキデータを取得
  const fetchDeckData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: deckData } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .eq('is_active', true);

    if (!deckData || deckData.length === 0) {
      setLoading(false);
      Alert.alert('出撃エラー', 'デッキにカードが編成されていません。図鑑から「デッキに編成」を行ってください。');
      return;
    }

    const totalHp = deckData.reduce((sum, card) => sum + (card.status_hp || 100), 0);
    setDeck(deckData);
    setPartyMaxHp(totalHp);
    setPartyHp(totalHp);

    // 周辺スポットボスのシミュレート生成
    generateNearbyBosses();
    setLoading(false);
  };

  // 🎲【位置情報シミュレート】周辺にサイズ違いのボスをプロットする
  const generateNearbyBosses = () => {
    const list = [
      { id: 'b_small', name: 'スライム・ノイズ', type: 'small', size: 24, color: '#10B981', top: 60, left: 70, hp: 400, atk: 70, def: 30, marker: '🟢' },
      { id: 'b_medium', name: 'ヘビー・コードギア', type: 'medium', size: 34, color: '#3B82F6', top: 140, left: 240, hp: 700, atk: 110, def: 50, marker: '🔵' },
      { id: 'b_large', name: 'コア・デストラクター', type: 'large', size: 44, color: '#EF4444', top: 40, left: 200, hp: 1200, atk: 160, def: 70, marker: '🔴' },
      { id: 'b_special', name: '協賛限定: シャドウ・マトリクス', type: 'special', size: 54, color: '#F59E0B', top: 160, left: 40, hp: 2000, atk: 220, def: 100, marker: '🌟' },
    ];
    setNearbyBosses(list);
  };

  // ⚔️ マップ上のボスを選択して戦闘を開始する
  const startBattle = (targetBoss: any) => {
    setBoss(targetBoss);
    setBossMaxHp(targetBoss.hp);
    setBossHp(targetBoss.hp);
    setBossAtkDebuff(1.0);
    setIsBattleOver(false);
    
    // 戦闘画面モードへ切り替え
    setScreenMode('battle');
    setBattleLogs([
      `⚔️ アリーナ戦域に侵入：vs ${targetBoss.name}`,
      `🚨 警告：【${targetBoss.type.toUpperCase()}クラス】のエネルギー反応を感知！`
    ]);
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

  // ターン計算ロジック
  const executeTurn = async (selectedCard: any) => {
    if (isBattleOver || loading) return;

    const cardName = selectedCard.card_name || '名もなき戦士';
    const cardRole = selectedCard.card_role || 'attacker';
    const skillName = selectedCard.skill_name || '通常攻撃';
    const cardAtk = selectedCard.status_atk || 10;

    let currentBossHp = bossHp;
    let currentPartyHp = partyHp;

    // プレイヤーフェーズ
    if (cardRole === 'support') {
      const rand = Math.random();
      if (rand > 0.8) {
        const sacrificeDmg = Math.floor(partyMaxHp * 0.15);
        const massiveDmg = cardAtk * 4;
        currentPartyHp = Math.max(1, currentPartyHp - sacrificeDmg);
        currentBossHp = Math.max(0, currentBossHp - massiveDmg);
        triggerFlash('rgba(147, 51, 234, 0.6)');
        triggerShake(2.0);
        addLog(`☠️ [${cardName}] の禁忌技『${skillName}』！\n自身のデータをオーバーロードさせ、${boss.name} に ${massiveDmg} の反物質ダメージ！(自傷:${sacrificeDmg})`);
      } else if (rand > 0.5) {
        setBossAtkDebuff(0.4); 
        triggerFlash('rgba(14, 165, 233, 0.4)');
        addLog(`🌫️ [${cardName}] の妨害技『${skillName}』！\nジャミング電波を展開。ボスの次回の攻撃力を【60%ダウン】させた！`);
      } else {
        const healAmount = cardAtk * 2;
        currentPartyHp = Math.min(partyMaxHp, currentPartyHp + healAmount);
        triggerFlash('rgba(16, 185, 129, 0.4)');
        addLog(`✨ [${cardName}] の支援技『${skillName}』！\nナノリペアを照射し、パーティのHPを ${healAmount} 回復した！`);
      }
      setPartyHp(currentPartyHp);
      setBossHp(currentBossHp);
    } else {
      const damage = Math.max(1, cardAtk - (boss.def || 0) / 2);
      const finalDamage = Math.floor(damage * (1 + Math.random() * 0.2));
      currentBossHp = Math.max(0, currentBossHp - finalDamage);
      
      if (cardAtk >= 150) {
        triggerFlash('rgba(251, 191, 36, 0.6)');
        triggerShake(1.6);
        addLog(`🌟 [${cardName}] の超絶必殺『${skillName}』！！\n銀河を断ち切る一撃が炸裂！ ${boss.name} に ${finalDamage} の大ダメージ！`);
      } else if (cardAtk >= 100) {
        triggerFlash('rgba(239, 68, 68, 0.5)');
        triggerShake(1.0);
        addLog(`🔥 [${cardName}] の『${skillName}』！\n熱線砲を発射！ ${boss.name} に ${finalDamage} のダメージ！`);
      } else {
        triggerShake(0.4);
        addLog(`⚔️ [${cardName}] の『${skillName}』！\nターゲットを斬りつけ、 ${finalDamage} の通常ダメージ！`);
      }
      setBossHp(currentBossHp);
    }

    if (currentBossHp <= 0) {
      triggerFlash('rgba(255, 255, 255, 0.9)');
      triggerShake(3.0);
      addLog(`🎉 MISSION COMPLETE：${boss.name} の撃破・完全データ消去に成功！`);
      setIsBattleOver(true);
      return;
    }

    // ボス（NPC）の反撃フェーズ
    setTimeout(() => {
      const baseBossAtk = (boss.atk || 20) * bossAtkDebuff;
      setBossAtkDebuff(1.0);

      const bossRand = Math.random();
      let finalBossDamage = 0;

      if (bossRand > 0.7) {
        finalBossDamage = Math.floor((baseBossAtk * 1.6) * (1 + Math.random() * 0.1));
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        triggerFlash('rgba(225, 29, 72, 0.7)');
        triggerShake(2.2);
        addLog(`🚨 警告！${boss.name} の広域壊滅技！！\n『インフェルノ・バースト』発動！パーティ全員に ${finalBossDamage} の壊滅的ダメージ！`);
      } else if (bossRand > 0.4) {
        finalBossDamage = Math.floor(baseBossAtk * (1 + Math.random() * 0.2));
        const drainHeal = Math.floor(finalBossDamage * 0.5);
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        currentBossHp = Math.min(bossMaxHp, currentBossHp + drainHeal);
        triggerFlash('rgba(236, 72, 153, 0.5)');
        triggerShake(1.0);
        setBossHp(currentBossHp);
        addLog(`🧛 ${boss.name} の生命吸収技！！\n『コード・ドレイン』を喰らった！味方に ${finalBossDamage} ダメージ、ボスが ${drainHeal} 回復。`);
      } else {
        finalBossDamage = Math.floor(baseBossAtk * (1 + Math.random() * 0.2));
        currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
        triggerFlash('rgba(241, 245, 249, 0.3)');
        triggerShake(0.8);
        addLog(`💀 ${boss.name} の通常迎撃！\n強烈な一撃を受け、パーティのHPが ${finalBossDamage} 減少。`);
      }

      setPartyHp(currentPartyHp);

      if (currentPartyHp <= 0) {
        addLog(`☠️ MISSION FAILED：戦線が崩壊し、全滅した...。`);
        setIsBattleOver(true);
      }
    }, 1000);
  };

  const radarScale = radarPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const radarOpacity = radarPulseAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.6, 0.4, 0] });

  if (loading) return (
    <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#0ea5e9" /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {screenMode === 'explore' ? (
        // 🌐 【探索・近接レーダーマップ画面】
        <View style={styles.innerContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>TACTICAL RADAR</Text>
            <Text style={styles.mapSub}>現在地周辺の次元シグナルを捕捉</Text>
          </View>

          {/* 🔘 レーダー本体 */}
          <View style={styles.radarContainer}>
            <View style={styles.radarCircleBig}>
              <View style={styles.radarCircleMid}>
                <View style={styles.radarCircleSmall}>
                  {/* 🟢 中心（プレイヤー現在地） */}
                  <View style={styles.playerNode}>
                    <Text style={{ fontSize: 10 }}>📍</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* アニメーションするパルス波紋 */}
            <Animated.View style={[styles.radarPulse, { transform: [{ scale: radarScale }], opacity: radarOpacity }]} />

            {/* 👾 プロットされた周辺ボスマーク（小中大スペシャル） */}
            {nearbyBosses.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.bossMarker, 
                  { top: b.top, left: b.left, width: b.size, height: b.size, borderRadius: b.size / 2, backgroundColor: b.color },
                  selectedMapBoss?.id === b.id && styles.selectedMarker
                ]}
                onPress={() => setSelectedMapBoss(b)}
              >
                <Text style={{ fontSize: b.size * 0.5 }}>{b.marker}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 📄 選択中のボス情報パネル */}
          <View style={styles.infoPanel}>
            {selectedMapBoss ? (
              <View style={styles.infoContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.infoClassTag, { backgroundColor: selectedMapBoss.color }]}>
                    {selectedMapBoss.type.toUpperCase()}
                  </Text>
                  <Text style={styles.infoBossName}>{selectedMapBoss.name}</Text>
                </View>
                <Text style={styles.infoStatsText}>
                  初期体力: {selectedMapBoss.hp}  |  攻撃力: {selectedMapBoss.atk}  |  防御力: {selectedMapBoss.def}
                </Text>
                <TouchableOpacity style={[styles.engageBtn, { backgroundColor: selectedMapBoss.color }]} onPress={() => startBattle(selectedMapBoss)}>
                  <Text style={styles.engageBtnText}>⚔️ この戦域へエンゲージ（戦闘開始）</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoPlaceHolder}>
                <Text style={styles.placeHolderText}>レーダー上のボスマーク（🟢🔵🔴🌟）をタップして、ターゲットを選択してください</Text>
              </View>
            )}
          </View>

          {/* デッキ確認用 */}
          <View style={styles.mapFooterDeck}>
            <Text style={styles.deckTitle}>現在の迎撃部隊（デッキ編成数: {deck.length}枚）</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {deck.map(item => (
                <Image key={item.id} source={{ uri: item.image_url }} style={styles.miniDeckImg} />
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        // 💥 【コマンドバトル画面】
        <View style={styles.innerContainer}>
          <Animated.View style={[styles.flashOverlay, { backgroundColor: flashColor, opacity: flashAnim }]} pointerEvents="none" />
          <Animated.View style={[styles.innerContainer, { transform: [{ translateX: shakeAnim }] }]}>
            
            {/* 敵エリア */}
            <View style={styles.enemyArea}>
              <Image source={{ uri: BOSS_IMAGES[boss.type as keyof typeof BOSS_IMAGES] || 'https://via.placeholder.com/150' }} style={[styles.bossAvatar, { borderColor: getRarityConfig(boss.type.toUpperCase()).color }]} />
              <Text style={styles.bossName}>{boss?.name}</Text>
              <View style={styles.hpBarContainer}>
                <View style={[styles.hpBarFill, { width: `${Math.max(0, (bossHp / bossMaxHp) * 100)}%`, backgroundColor: '#E11D48' }]} />
              </View>
              <Text style={styles.hpText}>BOSS HP: {bossHp} / {bossMaxHp}</Text>
            </View>

            {/* ログエリア */}
            <ScrollView style={styles.logArea} ref={scrollViewRef}>
              {battleLogs.map((log, index) => <Text key={index} style={styles.logText}>{log}</Text>)}
              {isBattleOver && (
                <TouchableOpacity style={styles.retreatBtn} onPress={() => setScreenMode('explore')}>
                  <Text style={styles.retreatBtnText}>戦域から離脱してレーダーに戻る</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* プレイヤーエリア */}
            <View style={styles.playerArea}>
              <Text style={styles.partyName}>司令部コマンド</Text>
              <View style={styles.hpBarContainer}>
                <View style={[styles.hpBarFill, { width: `${Math.max(0, (partyHp / partyMaxHp) * 100)}%`, backgroundColor: '#10B981' }]} />
              </View>
              <Text style={styles.hpText}>PARTY HP: {partyHp} / {partyMaxHp}</Text>
              <Text style={styles.instructionText}>カードをタップして作戦を実行指令↓</Text>
              
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
        </View>
      )}
    </SafeAreaView>
  );
}

// 💥 レアリティ/規模に応じたバトルログのタイトル演出マッピング
const getRarityConfig = (type: string) => {
  switch (type) {
    case 'SPECIAL': return { color: '#F59E0B' };
    case 'LARGE': return { color: '#EF4444' };
    case 'MEDIUM': return { color: '#3B82F6' };
    case 'SMALL': default: return { color: '#10B981' };
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  innerContainer: { flex: 1, backgroundColor: '#0F172A' },
  flashOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },

  // 🌐 レーダーマップ用スタイル
  mapHeader: { padding: 16, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  mapTitle: { fontSize: 18, fontWeight: '900', color: '#0EA5E9', letterSpacing: 2 },
  mapSub: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
  
  radarContainer: { width: 300, height: 260, alignSelf: 'center', marginTop: 30, position: 'relative', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  radarCircleBig: { width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.2)', justifyContent: 'center', alignItems: 'center' },
  radarCircleMid: { width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.25)', justifyContent: 'center', alignItems: 'center' },
  radarCircleSmall: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.3)', justifyContent: 'center', alignItems: 'center' },
  playerNode: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#0EA5E9', shadowRadius: 10, shadowOpacity: 1 },
  
  radarPulse: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 2, borderColor: '#0EA5E9' },
  
  bossMarker: { position: 'absolute', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5 },
  selectedMarker: { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.15 }] },

  infoPanel: { margin: 16, padding: 16, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 1, borderColor: '#334155', minHeight: 130, justifyContent: 'center' },
  infoPlaceHolder: { alignItems: 'center', paddingHorizontal: 10 },
  placeHolderText: { color: '#64748B', fontSize: 12, textAlign: 'center', fontWeight: '600', lineHeight: 18 },
  infoContent: { width: '100%' },
  infoClassTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, color: '#FFF', fontSize: 10, fontWeight: '900', marginRight: 8 },
  infoBossName: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  infoStatsText: { color: '#94A3B8', fontSize: 11, marginVertical: 8, fontWeight: '600' },
  engageBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  engageBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },

  mapFooterDeck: { paddingHorizontal: 16, marginBottom: 20 },
  deckTitle: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  miniDeckImg: { width: 40, height: 55, borderRadius: 4, borderWidth: 1, borderColor: '#334155' },

  // 💥 コマンドバトル用スタイル
  enemyArea: { padding: 16, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#334155' },
  bossAvatar: { width: 65, height: 65, borderRadius: 32.5, marginBottom: 6, borderWidth: 2, backgroundColor: '#000' },
  bossName: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  hpBarContainer: { width: '100%', height: 10, backgroundColor: '#334155', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  hpBarFill: { height: '100%', borderRadius: 5 },
  hpText: { color: '#CBD5E1', fontSize: 11, fontWeight: '800', alignSelf: 'flex-end' },
  logArea: { flex: 1, padding: 14, backgroundColor: '#000000' },
  logText: { color: '#38BDF8', fontSize: 13, marginBottom: 10, lineHeight: 20, fontWeight: '600', fontFamily: 'monospace' },
  playerArea: { padding: 16, backgroundColor: '#1E293B', borderTopWidth: 2, borderTopColor: '#334155', paddingBottom: 24 },
  partyName: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  instructionText: { color: '#94A3B8', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 6, fontWeight: '700' },
  deckContainer: { height: 110 },
  cardBtn: { width: 75, height: 100, marginRight: 10, borderRadius: 8, borderWidth: 2, borderColor: '#475569', overflow: 'hidden', position: 'relative' },
  cardBtnDisabled: { opacity: 0.3 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  roleBadge: { position: 'absolute', top: 4, right: 4, padding: 4, borderRadius: 12, backgroundColor: '#00000090' },
  roleAttacker: { borderColor: '#FCA5A5', borderWidth: 1 },
  roleSupport: { borderColor: '#86EFAC', borderWidth: 1 },
  roleText: { fontSize: 9 },
  retreatBtn: { backgroundColor: '#0EA5E9', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  retreatBtnText: { color: '#F8FAFC', fontWeight: '800', fontSize: 13 }
});