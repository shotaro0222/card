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

    try {
      // 1. ユーザー情報を取得
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return;
      }

      // 2. ユーザーのプロフィール（性別、年齢、地域）を取得
      // ※セグメント（ターゲット）配信の判定に使用します
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, location')
        .eq('id', user.id)
        .maybeSingle();

      // 3. announcements テーブルからお知らせを取得
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('お知らせの取得に失敗しました:', error);
        return;
      }

      if (data) {
        // 4. ユーザーの属性に合わせてお知らせをフィルタリング
        const filteredData = data.filter((ann: any) => {
          // プロフィールが取得できない場合は、全体向け（ALL）のみ表示する
          if (!profile) {
            return ann.target_gender === 'ALL' && ann.target_age === 'ALL' && (!ann.target_location || ann.target_location === '');
          }

          // 性別フィルター
          if (ann.target_gender && ann.target_gender !== 'ALL') {
            const isMale = profile.gender === 'male' || profile.gender === '男性';
            const isFemale = profile.gender === 'female' || profile.gender === '女性';
            if (ann.target_gender === 'MALE' && !isMale) return false;
            if (ann.target_gender === 'FEMALE' && !isFemale) return false;
          }

          // 年代フィルター
          if (ann.target_age && ann.target_age !== 'ALL') {
            const age = parseInt(profile.age) || 0;
            if (ann.target_age === 'TEENS' && !(age > 0 && age < 20)) return false;
            if (ann.target_age === 'TWENTIES' && !(age >= 20 && age < 30)) return false;
            if (ann.target_age === 'THIRTIES' && !(age >= 30)) return false;
          }

          // エリアフィルター（登録されている地域が含まれているか）
          if (ann.target_location && ann.target_location !== '') {
            if (!profile.location || !profile.location.includes(ann.target_location)) return false;
          }

          return true;
        });

        setEvents(filteredData);
      }
    } catch (err) {
      console.log('お知らせ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderEvent = ({ item }: { item: any }) => (
    <View style={styles.eventCard}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('ja-JP')}</Text>
      </View>
      {/* ※ announcementsテーブルに画像URLカラムを追加した場合はここで表示可能 */}
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.image} />
      )}
      <Text style={styles.description}>{item.body}</Text>
    </View>
  );

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