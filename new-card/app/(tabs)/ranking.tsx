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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMyId(user.id);

    // コレクションスコアが高い順に上位50名を取得
    const { data, error } = await supabase
      .from('profiles')
      .select('id, player_name, collection_score, is_premium')
      .order('collection_score', { ascending: false })
      .limit(50);

    if (!error && data) setRankings(data);
    setLoading(false);
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.id === myId;
    let rankColor = '#64748b'; // default
    if (index === 0) rankColor = '#fbbf24'; // 1st Gold
    else if (index === 1) rankColor = '#94a3b8'; // 2nd Silver
    else if (index === 2) rankColor = '#b45309'; // 3rd Bronze

    return (
      <View style={[styles.rankCard, isMe && styles.myRankCard]}>
        <Text style={[styles.rankNumber, { color: rankColor }]}>{index + 1}</Text>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isMe && { color: '#10b981' }]}>
            {item.player_name} {item.is_premium ? '👑' : ''}
          </Text>
          {isMe && <Text style={styles.meText}>(あなた)</Text>}
        </View>
        <Text style={styles.score}>{item.collection_score} pt</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>COLLECTION RANKING</Text>
      <Text style={styles.subtitle}>全司令官の図鑑スコア・リーダーボード</Text>

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
  playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  playerName: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  meText: { color: '#10b981', fontSize: 10, marginLeft: 8, fontWeight: 'bold' },
  score: { color: '#f43f5e', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }
});
