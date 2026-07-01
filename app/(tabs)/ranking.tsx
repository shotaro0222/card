import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function RankingScreen() {
  const [activeTab, setActiveTab] = useState<'individual' | 'team'>('individual');
  
  const [rankings, setRankings] = useState<any[]>([]);
  const [teamRankings, setTeamRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [myId, setMyId] = useState<string | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchRankings();
    }, [])
  );

  const fetchRankings = async () => {
    setLoading(true);
    
    // 1. ログインユーザーのIDを取得
    let currentUserId: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      currentUserId = user.id;
    }

    try {
      // 2. 各種テーブルからランキング計算に必要なデータを並列で取得
      const [profilesRes, cardsRes, territoriesRes, teamsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('cards').select('*'),
        supabase.from('territories').select('*'),
        supabase.from('teams').select('*')
      ]);

      const allProfiles = profilesRes.data || [];
      const allCards = cardsRes.data || [];
      const allTerritories = territoriesRes.data || [];
      const allTeams = teamsRes.data || [];

      // 総テリトリー数（個人陣取り占有率の分母）
      const totalTerritoryCount = allTerritories.length;

      // ユーザーIDからチームIDを引けるようにマップを作成
      const userToTeamMap: Record<string, string> = {};
      allProfiles.forEach((p: any) => {
        if (p.team_id) {
          userToTeamMap[p.id] = p.team_id;
          // 自分のチームIDをセット
          if (p.id === currentUserId) setMyTeamId(p.team_id);
        }
      });

      // ==========================================
      // 3. 個人のスコア計算
      // ==========================================
      const calculatedRankings = allProfiles.map((profile: any) => {
        const userId = profile.id;

        // --- ① レアリティ保有率の計算 ---
        const userCards = allCards.filter((c: any) => c.player_id === userId || c.user_id === userId);
        const totalUserCards = userCards.length;
        
        let rarityScore = 0;
        if (totalUserCards > 0) {
          const highRarityCount = userCards.filter((c: any) => 
            c.rarity === 'UR' || c.rarity === 'SSR' || c.rarity === 'SR'
          ).length;
          rarityScore = Math.round((highRarityCount / totalUserCards) * 100);
        }

        // --- ② バトル勝利率の計算 ---
        const wins = profile.total_wins || profile.wins || profile.win_count || 0;
        const battles = profile.total_battles || profile.battles || profile.battle_count || wins; 
        
        let winRateScore = 0;
        if (battles > 0) {
          winRateScore = Math.round((wins / battles) * 100);
        }

        // --- ③ 陣取りトータル占有率の計算 ---
        let territoryShareScore = 0;
        if (totalTerritoryCount > 0) {
          const userTerritoriesCount = allTerritories.filter((t: any) => 
            t.owner_id === userId || t.user_id === userId || t.player_id === userId
          ).length;
          territoryShareScore = Math.round((userTerritoriesCount / totalTerritoryCount) * 100);
        }

        // --- 総合ポイントの算出 ---
        const totalCalculatedScore = rarityScore + winRateScore + territoryShareScore;

        return {
          id: userId,
          player_name: profile.player_name || profile.name || '名もなき司令官',
          is_premium: profile.is_premium || false,
          calculated_score: totalCalculatedScore,
          details: {
            rarity: rarityScore,
            winRate: winRateScore,
            share: territoryShareScore
          }
        };
      });

      calculatedRankings.sort((a, b) => b.calculated_score - a.calculated_score);
      setRankings(calculatedRankings.slice(0, 50));


      // ==========================================
      // 4. チームのスコア（総面積量）計算
      // ==========================================
      const teamDetails: Record<string, { count: number, totalArea: number }> = {};
      
      allTeams.forEach((t: any) => {
        teamDetails[t.id] = { count: 0, totalArea: 0 };
      });

      allTerritories.forEach((t: any) => {
        const ownerId = t.owner_id || t.user_id || t.player_id;
        // テリトリーに直接チームIDがあればそれを、なければオーナーのチームIDを使用
        let tTeamId = t.team_id; 
        if (!tTeamId && ownerId) {
          tTeamId = userToTeamMap[ownerId];
        }

        if (tTeamId) {
          // 円の面積（π * r^2）を計算。半径データがない場合はデフォルト500mとして計算
          const radius = t.radius || 500;
          const area = Math.PI * Math.pow(radius, 2);
          
          if (!teamDetails[tTeamId]) teamDetails[tTeamId] = { count: 0, totalArea: 0 };
          teamDetails[tTeamId].count += 1;
          teamDetails[tTeamId].totalArea += area;
        }
      });

      const calculatedTeamRankings = allTeams.map((t: any) => {
        const details = teamDetails[t.id] || { count: 0, totalArea: 0 };
        // 平方メートルだと桁が大きすぎるため、平方キロメートル(km²)に換算して表示用にする
        const areaInKm2 = details.totalArea / 1000000;
        
        // ポイントとしてのスコア（面積に基づく。例として1000平方メートル = 1pt）
        const areaScore = Math.round(details.totalArea / 1000);

        return {
          id: t.id,
          team_name: t.name || t.team_name || '名称未設定',
          score: areaScore,
          formattedArea: areaInKm2.toFixed(2),
          details: details
        };
      });

      calculatedTeamRankings.sort((a, b) => b.score - a.score);
      setTeamRankings(calculatedTeamRankings.slice(0, 50));

    } catch (err) {
      console.error('ランキングデータの取得・計算に失敗しました:', err);
    } finally {
      setLoading(false);
    }
  };

  // 個人ランキング用のレンダリング
  const renderIndividualItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.id === myId;
    let rankColor = '#64748b';
    if (index === 0) rankColor = '#fbbf24';
    else if (index === 1) rankColor = '#94a3b8';
    else if (index === 2) rankColor = '#b45309';

    return (
      <View style={[styles.rankCard, isMe && styles.myRankCard]}>
        <Text style={[styles.rankNumber, { color: rankColor }]}>{index + 1}</Text>
        
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isMe && { color: '#10b981' }]}>
            {item.player_name} {item.is_premium ? '👑' : ''}
          </Text>
          {isMe && <Text style={styles.meText}>(あなた)</Text>}
          
          <Text style={styles.rankDetails}>
            ⭐高レア:{item.details.rarity}% / ⚔️勝率:{item.details.winRate}% / 🗺️占有:{item.details.share}%
          </Text>
        </View>
        
        <Text style={styles.score}>{item.calculated_score} pt</Text>
      </View>
    );
  };

  // チームランキング用のレンダリング
  const renderTeamItem = ({ item, index }: { item: any, index: number }) => {
    const isMyTeam = item.id === myTeamId;
    let rankColor = '#64748b';
    if (index === 0) rankColor = '#fbbf24';
    else if (index === 1) rankColor = '#94a3b8';
    else if (index === 2) rankColor = '#b45309';

    return (
      <View style={[styles.rankCard, isMyTeam && styles.myRankCard]}>
        <Text style={[styles.rankNumber, { color: rankColor }]}>{index + 1}</Text>
        
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isMyTeam && { color: '#3b82f6' }]}>
            {item.team_name}
          </Text>
          {isMyTeam && <Text style={[styles.meText, { color: '#3b82f6' }]}>所属チーム</Text>}
          
          <Text style={styles.rankDetails}>
            🛡️確保陣地数: {item.details.count} 箇所
          </Text>
          <Text style={[styles.rankDetails, { marginTop: 2, color: '#94a3b8' }]}>
            総面積: {item.formattedArea} km²
          </Text>
        </View>
        
        <Text style={styles.score}>{item.score.toLocaleString()} pt</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>STRATEGIC RANKING</Text>
      
      {/* タブ切り替えUI */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'individual' && styles.activeTab]} 
          onPress={() => setActiveTab('individual')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'individual' && styles.activeTabText]}>個人スコア</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'team' && styles.activeTab]} 
          onPress={() => setActiveTab('team')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>チーム制圧面積</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {activeTab === 'individual' 
          ? 'レアリティ・勝率・占有率からなる総合評価ボード'
          : '陣取りゲームで獲得した陣地の総面積に基づくチーム評価ボード'}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={activeTab === 'individual' ? rankings : teamRankings}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'individual' ? renderIndividualItem : renderTeamItem}
          contentContainerStyle={{ padding: 15 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
              ランキングデータがありません。
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 10 },
  header: { fontSize: 24, fontWeight: '900', color: '#38bdf8', marginTop: 40, textAlign: 'center', letterSpacing: 2 },
  
  tabContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 4,
    marginHorizontal: 15,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#1e293b',
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#38bdf8',
  },

  subtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 15, paddingHorizontal: 20 },
  
  rankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  myRankCard: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  
  rankNumber: { fontSize: 20, fontWeight: '900', width: 40, textAlign: 'center' },
  playerInfo: { flex: 1, paddingLeft: 10, justifyContent: 'center' },
  playerName: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  meText: { color: '#10b981', fontSize: 10, marginLeft: 8, fontWeight: 'bold' },
  rankDetails: { color: '#64748b', fontSize: 11, marginTop: 4, fontWeight: '500' },
  score: { color: '#f43f5e', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }
});