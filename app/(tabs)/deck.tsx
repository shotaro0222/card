import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function DeckScreen() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 画面を開くたびに最新のカードを取得
  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [])
  );

  const fetchCards = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('player_id', user.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setCards(data);
    setLoading(false);
  };

  const setActiveCard = async (cardId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 一旦すべてのアクティブを解除
    await supabase.from('cards').update({ is_active: false }).eq('player_id', user.id);
    // 選択したカードをアクティブに
    await supabase.from('cards').update({ is_active: true }).eq('id', cardId);
    
    fetchCards(); // 再取得して画面更新
  };

  const renderCard = ({ item }: { item: any }) => (
    <View style={[styles.card, item.is_active && styles.activeCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{item.card_name}</Text>
        <Text style={styles.rarity}>{item.rarity}</Text>
      </View>
      <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      <Text style={styles.skillText}>技: {item.skill_name}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>HP: {item.status_hp}</Text>
        <Text style={styles.stat}>ATK: {item.status_atk}</Text>
        <Text style={styles.stat}>DEF: {item.status_def}</Text>
        <Text style={styles.stat}>SPD: {item.status_spd}</Text>
      </View>
      {!item.is_active ? (
        <TouchableOpacity style={styles.equipBtn} onPress={() => setActiveCard(item.id)}>
          <Text style={styles.equipBtnText}>出撃させる</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeLabel}><Text style={styles.activeLabelText}>出撃中</Text></View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f87171" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 10 }}
          ListEmptyComponent={<Text style={styles.emptyText}>カードがありません。FORGEで錬成してください。</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  card: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  activeCard: { borderColor: '#10b981', borderWidth: 2, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardName: { color: 'white', fontWeight: 'bold', fontSize: 16, flex: 1 },
  rarity: { color: '#fbbf24', fontWeight: 'bold' },
  cardImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10, backgroundColor: '#000' },
  skillText: { color: '#c084fc', fontSize: 12, marginBottom: 10, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  stat: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  equipBtn: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, alignItems: 'center' },
  equipBtnText: { color: 'white', fontWeight: 'bold' },
  activeLabel: { backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 10, borderRadius: 8, alignItems: 'center' },
  activeLabelText: { color: '#10b981', fontWeight: 'bold' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 50 }
});
