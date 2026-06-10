import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, SafeAreaView, Alert, TextInput } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('bosses'); // bosses, shop, events
  
  // データ状態
  const [bosses, setBosses] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // 新規追加用フォーム状態（ボス）
  const [newBossName, setNewBossName] = useState('');
  const [newBossHp, setNewBossHp] = useState('');
  const [newBossAtk, setNewBossAtk] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'bosses') {
      const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false });
      if (data) setBosses(data);
    } else if (activeTab === 'shop') {
      const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
      if (data) setShopItems(data);
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    }
  };

  // ボスの追加
  const handleAddBoss = async () => {
    if (!newBossName || !newBossHp || !newBossAtk) {
      Alert.alert('エラー', 'すべての項目を入力してください');
      return;
    }
    const { error } = await supabase.from('bosses').insert([
      { name: newBossName, hp: parseInt(newBossHp), atk: parseInt(newBossAtk), def: 10, is_active: true }
    ]);
    if (error) {
      Alert.alert('追加失敗', error.message);
    } else {
      Alert.alert('成功', '新しいボスを追加しました');
      setNewBossName(''); setNewBossHp(''); setNewBossAtk('');
      fetchAdminData();
    }
  };

  // 状態の切り替え（有効/無効）
  const toggleActiveStatus = async (table: string, id: string, currentStatus: boolean) => {
    const { error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id);
    if (!error) fetchAdminData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ADMIN DASHBOARD</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* タブナビゲーション */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'bosses' && styles.activeTab]} onPress={() => setActiveTab('bosses')}>
          <Text style={[styles.tabText, activeTab === 'bosses' && styles.activeTabText]}>ボス管理</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'shop' && styles.activeTab]} onPress={() => setActiveTab('shop')}>
          <Text style={[styles.tabText, activeTab === 'shop' && styles.activeTabText]}>ショップ管理</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'events' && styles.activeTab]} onPress={() => setActiveTab('events')}>
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>イベント管理</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* ボス管理タブ */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>新規ボス追加</Text>
              <TextInput style={styles.input} placeholder="ボス名" value={newBossName} onChangeText={setNewBossName} />
              <TextInput style={styles.input} placeholder="HP" keyboardType="numeric" value={newBossHp} onChangeText={setNewBossHp} />
              <TextInput style={styles.input} placeholder="攻撃力" keyboardType="numeric" value={newBossAtk} onChangeText={setNewBossAtk} />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>追加する</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>登録済みボス一覧</Text>
            {bosses.map((boss) => (
              <View key={boss.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{boss.name}</Text>
                  <Text style={styles.itemSub}>HP: {boss.hp} | ATK: {boss.atk}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.statusBtn, boss.is_active ? styles.statusActive : styles.statusInactive]}
                  onPress={() => toggleActiveStatus('bosses', boss.id, boss.is_active)}
                >
                  <Text style={styles.statusBtnText}>{boss.is_active ? '稼働中' : '停止中'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ショップ管理タブ */}
        {activeTab === 'shop' && (
          <View>
            <Text style={styles.sectionTitle}>ショップアイテム一覧</Text>
            {shopItems.length === 0 ? (
              <Text style={styles.emptyText}>アイテムが登録されていません</Text>
            ) : (
              shopItems.map((item) => (
                <View key={item.id} style={styles.listItem}>
                   <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>価格: {item.price} {item.currency_type}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.statusBtn, item.is_active ? styles.statusActive : styles.statusInactive]}
                    onPress={() => toggleActiveStatus('shop_items', item.id, item.is_active)}
                  >
                    <Text style={styles.statusBtnText}>{item.is_active ? '販売中' : '停止中'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

         {/* イベント管理タブ */}
         {activeTab === 'events' && (
          <View>
            <Text style={styles.sectionTitle}>イベント一覧</Text>
            {events.length === 0 ? (
              <Text style={styles.emptyText}>イベントが登録されていません</Text>
            ) : (
              events.map((evt) => (
                <View key={evt.id} style={styles.listItem}>
                   <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{evt.title}</Text>
                    <Text style={styles.itemSub}>{evt.description}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.statusBtn, evt.is_active ? styles.statusActive : styles.statusInactive]}
                    onPress={() => toggleActiveStatus('events', evt.id, evt.is_active)}
                  >
                    <Text style={styles.statusBtnText}>{evt.is_active ? '開催中' : '終了'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#1E293B' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoutBtn: { backgroundColor: '#475569', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  activeTabText: { color: '#3B82F6', fontWeight: '900' },
  
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16, marginTop: 10 },
  
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8, marginBottom: 12 },
  addBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  itemName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  itemSub: { fontSize: 13, color: '#64748B' },
  
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F1F5F9' },
  statusBtnText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 20 }
});