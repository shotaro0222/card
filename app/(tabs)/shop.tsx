import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ShopScreen() {
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [tickets, setTickets] = useState(0);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('is_premium, forge_tickets').eq('id', user.id).single();
    if (data) {
      setIsPremium(data.is_premium);
      setTickets(data.forge_tickets);
    }
  };

  // ※将来的にはApple/Googleの決済完了コールバックで実行する処理です
  const buyPremium = async () => {
    Alert.alert(
      "プレミアムパス購入",
      "月額500円を支払いますか？（※テスト環境のため実際には請求されません）",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "購入する", onPress: async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
              setIsPremium(true);
              Alert.alert('購入完了', 'プレミアム機能が解放されました！');
            }
            setLoading(false);
        }}
      ]
    );
  };

  const buyTickets = async () => {
    Alert.alert(
      "チケット購入",
      "100円でチケットを10枚購入しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "購入する", onPress: async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const newAmount = tickets + 10;
              await supabase.from('profiles').update({ forge_tickets: newAmount }).eq('id', user.id);
              setTickets(newAmount);
              Alert.alert('購入完了', 'チケットが追加されました！');
            }
            setLoading(false);
        }}
      ]
    );
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#f59e0b" style={{marginTop: 50}} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>SHOP</Text>
      
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productTitle}>👑 プレミアムパス</Text>
          <Text style={styles.price}>￥500 / 月</Text>
        </View>
        <Text style={styles.desc}>・1日の錬成回数が【無制限】に！</Text>
        <Text style={styles.desc}>・カードに【好きな名前】を指定可能！</Text>
        <Text style={styles.desc}>・プレミアムガチャ確定演出</Text>
        
        {isPremium ? (
          <View style={styles.ownedBadge}><Text style={styles.ownedText}>加入済み</Text></View>
        ) : (
          <TouchableOpacity style={styles.buyBtn} onPress={buyPremium}>
            <Text style={styles.buyBtnText}>契約する</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productTitle}>🎟️ 錬成チケット x10</Text>
          <Text style={styles.price}>￥100</Text>
        </View>
        <Text style={styles.desc}>・通常錬成を10回追加で行えます。</Text>
        <Text style={styles.desc}>現在の所持数: {tickets}枚</Text>
        
        <TouchableOpacity style={[styles.buyBtn, { backgroundColor: '#3b82f6' }]} onPress={buyTickets}>
          <Text style={styles.buyBtnText}>購入する</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  header: { fontSize: 24, fontWeight: '900', color: '#f59e0b', marginBottom: 20, marginTop: 40, letterSpacing: 2 },
  productCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  productTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b' },
  desc: { color: '#94a3b8', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  buyBtn: { backgroundColor: '#f59e0b', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buyBtnText: { color: '#020617', fontWeight: 'bold', fontSize: 16 },
  ownedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#10b981' },
  ownedText: { color: '#10b981', fontWeight: 'bold' }
});
