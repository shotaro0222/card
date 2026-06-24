import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function RankingScreen() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchRankings();
    }, [])
  );

  const fetchRankings = async () => {
    setLoading(true);
    
    // 1. ログインユーザーのIDを取得
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMyId(user.id);

    try {
      // 2. 各種テーブルからランキング計算に必要なデータを並列で取得
      const [profilesRes, cardsRes, territoriesRes] = await Promise.all([
        supabase.from('profiles').select('id, player_name, is_premium, total_wins, total_battles'),
        supabase.from('cards').select('player_id, rarity'),
        supabase.from('territories').select('id, owner_id')
      ]);

      const allProfiles = profilesRes.data || [];
      const allCards = cardsRes.data || [];
      const allTerritories = territoriesRes.data || [];

      // 総テリトリー数（陣取り占有率の分母）
      const totalTerritoryCount = allTerritories.length;

      // 3. 各ユーザーのスコアを動的に算出
      const calculatedRankings = allProfiles.map((profile: any) => {
        const userId = profile.id;

        // --- ① レアリティ保有率の計算 ---
        // ユーザーが持つ全カード
        const userCards = allCards.filter((c: any) => c.player_id === userId);
        const totalUserCards = userCards.length;
        
        let rarityScore = 0;
        if (totalUserCards > 0) {
          // 高レアリティ（UR, SSR, SR）が保有カードの中で占める割合を％で算出
          const highRarityCount = userCards.filter((c: any) => 
            c.rarity === 'UR' || c.rarity === 'SSR' || c.rarity === 'SR'
          ).length;
          rarityScore = Math.round((highRarityCount / totalUserCards) * 100);
        }

        // --- ② バトル勝利率の計算 ---
        const wins = profile.total_wins || 0;
        const battles = profile.total_battles || wins; // total_battlesが未定義、または0の場合は勝利数を分母にして100%にするか、安全にフォールバック
        let winRateScore = 0;
        if (battles > 0) {
          winRateScore = Math.round((wins / battles) * 100);
        }

        // --- ③ 陣取りトータル占有率の計算 ---
        let territoryShareScore = 0;
        if (totalTerritoryCount > 0) {
          const userTerritoriesCount = allTerritories.filter((t: any) => t.owner_id === userId).length;
          // 全陣地に対する自分の陣地の割合（％）
          territoryShareScore = Math.round((userTerritoriesCount / totalTerritoryCount) * 100);
        }

        // --- 総合ポイントの算出 ---
        // 3つの要素（各最大100pt換算）の合計、あるいは平均値を総合ptとする設計
        // ここではバランスよく「レアリティ率(MAX100) + 勝率(MAX100) + 占有率(MAX100)」の合計値を総合ptとしています
        const totalCalculatedScore = rarityScore + winRateScore + territoryShareScore;

        return {
          id: userId,
          player_name: profile.player_name || '名もなき司令官',
          is_premium: profile.is_premium,
          calculated_score: totalCalculatedScore,
          details: {
            rarity: rarityScore,
            winRate: winRateScore,
            share: territoryShareScore
          }
        };
      });

      // 4. 総合スコアが高い順にソートし、上位50名に絞り込む
      calculatedRankings.sort((a, b) => b.calculated_score - a.calculated_score);
      const top50Rankings = calculatedRankings.slice(0, 50);

      setRankings(top50Rankings);

    } catch (err) {
      console.error('ランキングデータの取得・計算に失敗しました:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.id === myId;
    let rankColor = '#64748b'; // デフォルト
    if (index === 0) rankColor = '#fbbf24'; // 1位: 金
    else if (index === 1) rankColor = '#94a3b8'; // 2位: 銀
    else if (index === 2) rankColor = '#b45309'; // 3位: 銅

    return (
      <View style={[styles.rankCard, isMe && styles.myRankCard]}>
        <Text style={[styles.rankNumber, { color: rankColor }]}>{index + 1}</Text>
        
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isMe && { color: '#10b981' }]}>
            {item.player_name} {item.is_premium ? '👑' : ''}
          </Text>
          {isMe && <Text style={styles.meText}>(あなた)</Text>}
          
          {/* 内訳のサブテキスト表示を追加（デバッグやユーザーへの親切さ向上） */}
          <Text style={styles.rankDetails}>
            ⭐高レア:{item.details.rarity}% / ⚔️勝率:{item.details.winRate}% / 🗺️占有:{item.details.share}%
          </Text>
        </View>
        
        <Text style={styles.score}>{item.calculated_score} pt</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>STRATEGIC RANKING</Text>
      <Text style={styles.subtitle}>レアリティ・勝率・占有率からなる総合評価ボード</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={rankings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 10 },
  header: { fontSize: 24, fontWeight: '900', color: '#38bdf8', marginTop: 40, textAlign: 'center', letterSpacing: 2 },
  subtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  rankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  myRankCard: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  rankNumber: { fontSize: 20, fontWeight: '900', width: 40, textAlign: 'center' },
  playerInfo: { flex: 1, paddingLeft: 10, justifyContent: 'center' },
  playerName: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  meText: { color: '#10b981', fontSize: 10, marginLeft: 8, fontWeight: 'bold' },
  rankDetails: { color: '#64748b', fontSize: 11, marginTop: 4, fontWeight: '500' },
  score: { color: '#f43f5e', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }
});