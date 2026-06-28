import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const fetchEvents = async () => {
    setLoading(true);
    
    // 1. 現在ログインしているユーザーの情報を取得
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setLoading(false);
      return;
    }

    let fetchedData: any[] = [];

    // 2. 矢印演算子による 400 Bad Request を避けるため、安全な contains でクエリを試みる
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .contains('metadata', { type: 'announcement', recipient_id: user.id })
      .order('created_at', { ascending: false });

    // 3. もし DBの型制約(json型など)で contains もエラーになった場合の安全なフォールバック
    if (error) {
      console.warn('JSON Query Error, falling back to client-side filtering:', error);
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200); // 負荷軽減のために上限を設定して最新を取得

      if (!fallbackError && fallbackData) {
        // クライアント(JS)側で該当ユーザー宛てのお知らせだけを絞り込む
        fetchedData = fallbackData.filter((msg: any) => 
          msg.metadata && 
          msg.metadata.type === 'announcement' && 
          msg.metadata.recipient_id === user.id
        );
      }
    } else if (data) {
      fetchedData = data;
    }

    setEvents(fetchedData);
    setLoading(false);
  };

  const renderEvent = ({ item }: { item: any }) => {
    // ダッシュボードで送信されるフォーマット「📢【お知らせ】\n{タイトル}\n\n{本文}」を解析して分割表示
    let displayTitle = 'お知らせ';
    let displayDesc = item.text || '';
    
    if (displayDesc.startsWith('📢【お知らせ】\n')) {
      const parts = displayDesc.split('\n\n');
      // タイトル部分からヘッダー装飾を取り除く
      displayTitle = parts[0].replace('📢【お知らせ】\n', '');
      // 本文部分を結合（本文内に改行が含まれているケースに対応）
      displayDesc = parts.slice(1).join('\n\n');
    }

    return (
      <View style={styles.eventCard}>
        <View style={styles.header}>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('ja-JP')}</Text>
        </View>
        {/* お知らせに画像がある場合の処理 */}
        {item.metadata?.image_url && (
          <Image source={{ uri: item.metadata.image_url }} style={styles.image} />
        )}
        <Text style={styles.description}>{displayDesc}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f87171" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={styles.emptyText}>現在届いているお知らせはありません。</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  eventCard: { backgroundColor: '#0f172a', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { color: '#f87171', fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 10 },
  date: { color: '#64748b', fontSize: 12 },
  image: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10, backgroundColor: '#000' },
  description: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 50 }
});