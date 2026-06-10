import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function BattleScreen() {
  const [loading, setLoading] = useState(true);
  
  const [deck, setDeck] = useState<any[]>([]);
  const [boss, setBoss] = useState<any>(null);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(0);
  const [partyHp, setPartyHp] = useState(0);
  const [partyMaxHp, setPartyMaxHp] = useState(0);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [isBattleOver, setIsBattleOver] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      fetchBattleData();
    }, [])
  );

  const fetchBattleData = async () => {
    setLoading(true);
    setIsBattleOver(false);
    setBattleLogs(['【システム】周囲のエネルギー反応を探知中...']);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: deckData, error: deckError } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .eq('is_active', true);

    if (deckError || !deckData || deckData.length === 0) {
      setLoading(false);
      Alert.alert('出撃エラー', 'デッキにカードが編成されていません。図鑑からカードを編成してください。');
      return;
    }

    const { data: bossData, error: bossError } = await supabase
      .from('bosses')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (bossError || !bossData) {
      setLoading(false);
      Alert.alert('平和な世界', '現在、周辺にボスの反応はありません。');
      return;
    }

    const totalHp = deckData.reduce((sum, card) => sum + (card.status_hp || 100), 0);

    setDeck(deckData);
    setBoss(bossData);
    setBossMaxHp(bossData.hp);
    setBossHp(bossData.hp);
    setPartyMaxHp(totalHp);
    setPartyHp(totalHp);
    
    addLog(`⚠️ 警告：${bossData.name} が出現した！`);
    addLog(`【システム】${deckData.length}体の軍勢で迎撃を開始します。行動するカードを選択してください。`);
    
    setLoading(false);
  };

  const addLog = (message: string) => {
    setBattleLogs(prev => [...prev, message]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 👇 【重要】攻撃力に応じた派手なエフェクトロジック
  const getEffectText = (atk: number) => {
    if (atk >= 150) return "🌟【超絶必殺】銀河を切り裂く一撃！！🌟";
    if (atk >= 100) return "🔥【強烈攻撃】猛烈な炎の衝撃波！🔥";
    if (atk >= 50)  return "⚡【鋭い一撃】雷光が敵を貫く！⚡";
    return "⚔️ 通常攻撃を繰り出した！";
  };

  // 👇 サポート用の回復エフェクトロジック
  const getSupportEffectText = (atk: number) => {
    if (atk >= 100) return "💖【奇跡の光】女神の息吹が全てを包み込む！💖";
    return "✨【回復魔法】優しい光が傷を癒やす！✨";
  };

  const executeTurn = async (selectedCard: any) => {
    if (isBattleOver || loading) return;

    const cardName = selectedCard.card_name || '名もなき戦士';
    const cardRole = selectedCard.card_role || 'attacker';
    const skillName = selectedCard.skill_name || '通常攻撃';
    const cardAtk = selectedCard.status_atk || 10;

    let currentBossHp = bossHp;
    let currentPartyHp = partyHp;

    if (cardRole === 'support') {
      const healAmount = cardAtk * 2;
      currentPartyHp = Math.min(partyMaxHp, currentPartyHp + healAmount);
      const effectStr = getSupportEffectText(cardAtk);
      addLog(`✨ [${cardName}] のサポート技！\n${effectStr}\n『${skillName}』でパーティのHPが ${healAmount} 回復した！`);
      setPartyHp(currentPartyHp);
    } else {
      const damage = Math.max(1, cardAtk - (boss.def || 0) / 2);
      const finalDamage = Math.floor(damage * (1 + Math.random() * 0.2));
      currentBossHp = Math.max(0, currentBossHp - finalDamage);
      
      // 演出テキストを組み込んでログを出力
      const effectStr = getEffectText(cardAtk);
      addLog(`💥 [${cardName}] の攻撃！\n${effectStr}\n『${skillName}』が炸裂！ ${boss.name} に ${finalDamage} のダメージ！`);
      setBossHp(currentBossHp);
    }

    if (currentBossHp <= 0) {
      addLog(`🎉 討伐成功！ ${boss.name} は崩れ落ちた...！`);
      addLog(`【システム】経験値と報酬を獲得しました。（※報酬付与機能は今後のアップデートで解放されます）`);
      setIsBattleOver(true);
      return;
    }

    setTimeout(() => {
      const bossDamage = Math.max(1, (boss.atk || 20) - (selectedCard.status_def || 10) / 2);
      const finalBossDamage = Math.floor(bossDamage * (1 + Math.random() * 0.2));
      currentPartyHp = Math.max(0, currentPartyHp - finalBossDamage);
      
      addLog(`💀 ${boss.name} の反撃！\n強烈な一撃により、パーティ全体に ${finalBossDamage} のダメージ！`);
      setPartyHp(currentPartyHp);

      if (currentPartyHp <= 0) {
        addLog(`☠️ パーティは全滅してしまった...。図鑑で部隊を強化して再挑戦しよう。`);
        setIsBattleOver(true);
      }
    }, 800);
  };

  const renderDeckCard = ({ item }: { item: any }) => {
    const isSupport = item.card_role === 'support';
    
    return (
      <TouchableOpacity 
        style={[styles.cardBtn, isBattleOver && styles.cardBtnDisabled]} 
        onPress={() => executeTurn(item)}
        disabled={isBattleOver}
      >
        <Image source={{ uri: item.image_url || 'https://via.placeholder.com/100' }} style={styles.cardImage} />
        <View style={[styles.roleBadge, isSupport ? styles.roleSupport : styles.roleAttacker]}>
          <Text style={styles.roleText}>{isSupport ? '🛡️' : '⚔️'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text style={styles.loadingText}>索敵中...</Text>
      </SafeAreaView>
    );
  }

  if (!deck.length || !boss) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyText}>現在戦闘可能なターゲットがいません。</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchBattleData}>
          <Text style={styles.retryBtnText}>再スキャン</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const bossHpPercent = Math.max(0, (bossHp / bossMaxHp) * 100);
  const partyHpPercent = Math.max(0, (partyHp / partyMaxHp) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.enemyArea}>
        <Text style={styles.bossName}>Lv.? {boss.name}</Text>
        <View style={styles.hpBarContainer}>
          <View style={[styles.hpBarFill, { width: `${bossHpPercent}%`, backgroundColor: '#E11D48' }]} />
        </View>
        <Text style={styles.hpText}>HP: {bossHp} / {bossMaxHp}</Text>
      </View>

      <ScrollView style={styles.logArea} ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {battleLogs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
        {isBattleOver && (
          <TouchableOpacity style={styles.retreatBtn} onPress={fetchBattleData}>
            <Text style={styles.retreatBtnText}>戦域から離脱する（リセット）</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.playerArea}>
        <Text style={styles.partyName}>あなたの軍勢（{deck.length}体）</Text>
        <View style={styles.hpBarContainer}>
          <View style={[styles.hpBarFill, { width: `${partyHpPercent}%`, backgroundColor: '#10B981' }]} />
        </View>
        <Text style={styles.hpText}>PARTY HP: {partyHp} / {partyMaxHp}</Text>

        <Text style={styles.instructionText}>タップして行動を指示↓</Text>
        <View style={styles.deckContainer}>
          <FlatList
            data={deck}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderDeckCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#FFFFFF', marginTop: 16, fontWeight: '700' },
  emptyText: { color: '#94A3B8', fontSize: 16, marginBottom: 20 },
  
  enemyArea: { padding: 20, alignItems: 'center', backgroundColor: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#334155' },
  bossName: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 10, textShadowColor: '#E11D48', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  
  hpBarContainer: { width: '100%', height: 12, backgroundColor: '#334155', borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  hpBarFill: { height: '100%', borderRadius: 6 },
  hpText: { color: '#CBD5E1', fontSize: 12, fontWeight: '800', alignSelf: 'flex-end' },

  logArea: { flex: 1, padding: 16, backgroundColor: '#000000' },
  logText: { color: '#38BDF8', fontSize: 14, marginBottom: 12, lineHeight: 22, fontWeight: '600', fontFamily: 'monospace' },
  
  playerArea: { padding: 16, backgroundColor: '#1E293B', borderTopWidth: 2, borderTopColor: '#334155', paddingBottom: 30 },
  partyName: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  instructionText: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 8, fontWeight: '700' },
  
  deckContainer: { height: 120 },
  cardBtn: { width: 80, height: 110, marginRight: 12, borderRadius: 8, borderWidth: 2, borderColor: '#475569', overflow: 'hidden', position: 'relative' },
  cardBtnDisabled: { opacity: 0.3 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  roleBadge: { position: 'absolute', top: 4, right: 4, padding: 4, borderRadius: 12, backgroundColor: '#00000080' },
  roleAttacker: { borderColor: '#FCA5A5', borderWidth: 1 },
  roleSupport: { borderColor: '#86EFAC', borderWidth: 1 },
  roleText: { fontSize: 10 },

  retryBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  
  retreatBtn: { backgroundColor: '#475569', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  retreatBtnText: { color: '#F8FAFC', fontWeight: '800' }
});