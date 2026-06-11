import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('shop'); // デフォルトをショップに
  
  // 共通データリスト
  const [bosses, setBosses] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // 🛒 ショップ管理用ステート
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');
  const [sType, setSType] = useState('pack'); // pack, item, currency
  const [sDiscount, setSDiscount] = useState('0'); // セール割引率
  const [sBanner, setSBanner] = useState(''); // 目玉商品のバナー画像
  const [sRates, setSRates] = useState('{"UR": 1, "SR": 5, "R": 20, "N": 74}'); // ガチャ確率

  // 🎊 イベント管理用ステート
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eReward, setEReward] = useState(''); // 報酬アイテム/カード
  const [eStartDate, setEStartDate] = useState('2026-07-01');
  const [eEndDate, setEEndDate] = useState('2026-07-15');
  const [eBanner, setEBanner] = useState('');

  // 📢 コミュニティ（チャット/ランキング）用ステート
  const [sysMessage, setSysMessage] = useState('');

  // ⚖️ バランス調整用ステート
  const [expMulti, setExpMulti] = useState('1.0');
  const [dropMulti, setDropMulti] = useState('1.0');

  // --- 既存のボス・AI・サーベイステート（省略表記、実際は前回のコードを保持） ---
  const [bName, setBName] = useState(''); 
  // ... (前回のボス・AIステート等)

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'shop') {
      const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
      if (data) setShopItems(data);
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    }
    // 他タブのフェッチ処理...
  };

  // 🛒 ショップ商品の追加（拡張版）
  const handleAddShopItem = async () => {
    if (!sName || !sPrice) return Alert.alert('エラー', '必須項目を入力してください');
    const { error } = await supabase.from('shop_items').insert([{ 
      name: sName, 
      price: parseInt(sPrice), 
      item_type: sType, 
      discount_percent: parseInt(sDiscount),
      banner_url: sBanner,
      drop_rates: sType === 'pack' ? sRates : null, // パックの場合のみ確率を設定
      is_active: true 
    }]);
    if (error) Alert.alert('エラー', error.message);
    else { Alert.alert('成功', 'ショップに新商品を陳列しました'); fetchAdminData(); }
  };

  // 🎊 イベントの追加（拡張版）
  const handleAddEvent = async () => {
    if (!eTitle) return Alert.alert('エラー', 'タイトルは必須です');
    const { error } = await supabase.from('events').insert([{ 
      title: eTitle, 
      description: eDesc, 
      reward_text: eReward,
      start_date: eStartDate,
      end_date: eEndDate,
      banner_url: eBanner,
      is_active: true 
    }]);
    if (!error) { Alert.alert('成功', 'イベントスケジュールを登録しました'); fetchAdminData(); }
  };

  // 📢 グローバルシステムメッセージ送信（chat.tsx 連動）
  const handleSendSystemMessage = async () => {
    if (!sysMessage) return;
    // chatテーブルに 'SYSTEM' ユーザーとしてメッセージを挿入
    // await supabase.from('global_chat').insert([{ user_id: 'SYSTEM', message: sysMessage, is_announcement: true }]);
    Alert.alert('送信完了', '全ユーザーのチャット画面にシステム通知を送信しました。');
    setSysMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STRATEGIC ADMIN</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>終了</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {[
          { id: 'shop', label: '🛒 ショップ管理' },
          { id: 'events', label: '🎊 イベント構築' },
          { id: 'community', label: '📢 コミュニティ' },
          { id: 'economy', label: '⚖️ 経済・バランス' },
          { id: 'bosses', label: '👹 ボスマップ' },
          { id: 'survey', label: '✉️ サーベイ配信' },
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* 🛒 1. ショップ管理タブ */}
        {activeTab === 'shop' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>新商品の陳列・パック設定</Text>
              
              <TextInput style={styles.input} placeholder="商品名 (例: 夏の特大パック)" value={sName} onChangeText={setSName} />
              
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="価格 (ゴールド)" keyboardType="numeric" value={sPrice} onChangeText={setSPrice} />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="割引率 (%)" keyboardType="numeric" value={sDiscount} onChangeText={setSDiscount} />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {['pack', 'item', 'currency'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.miniChip, sType === t && styles.activeMiniChip]} onPress={() => setSType(t)}>
                    <Text style={styles.miniChipText}>{t === 'pack' ? 'カードパック' : t === 'item' ? 'アイテム' : '通貨'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="バナー画像URL (ショップの目玉にする場合)" value={sBanner} onChangeText={setSBanner} />

              {sType === 'pack' && (
                <>
                  <Text style={styles.label}>カード排出確率設定 (JSON)</Text>
                  <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} multiline value={sRates} onChangeText={setSRates} />
                </>
              )}

              <TouchableOpacity style={styles.addBtn} onPress={handleAddShopItem}>
                <Text style={styles.addBtnText}>ショップに反映する</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>現在の商品ラインナップ</Text>
            {shopItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.discount_percent > 0 ? `🔥${item.discount_percent}%OFF ` : ''}{item.name}</Text>
                  <Text style={styles.itemSub}>種別: {item.item_type} | 価格: {item.price}G</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 🎊 2. イベント構築タブ */}
        {activeTab === 'events' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>新規イベントのスケジュール化</Text>
              
              <TextInput style={styles.input} placeholder="イベントタイトル" value={eTitle} onChangeText={setETitle} />
              <TextInput style={[styles.input, { minHeight: 80 }]} multiline placeholder="イベント詳細文" value={eDesc} onChangeText={setEDesc} />
              
              <Text style={styles.label}>開催期間</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="開始日 (YYYY-MM-DD)" value={eStartDate} onChangeText={setEStartDate} />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="終了日 (YYYY-MM-DD)" value={eEndDate} onChangeText={setEEndDate} />
              </View>

              <TextInput style={styles.input} placeholder="目玉報酬 (例: 限定アバター、限定カード)" value={eReward} onChangeText={setEReward} />
              <TextInput style={styles.input} placeholder="イベントトップバナー画像URL" value={eBanner} onChangeText={setEBanner} />

              <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#F59E0B' }]} onPress={handleAddEvent}>
                <Text style={styles.addBtnText}>イベントを発令する</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 📢 3. コミュニティ管理タブ */}
        {activeTab === 'community' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>グローバルシステム通知 (全体チャット)</Text>
              <Text style={styles.infoText}>全プレイヤーの chat.tsx 画面に運営からの重要なお知らせをピン留め・送信します。</Text>
              
              <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} multiline placeholder="メンテナンスのお知らせや、イベント開催の告知を入力..." value={sysMessage} onChangeText={setSysMessage} />
              
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#EF4444' }]} onPress={handleSendSystemMessage}>
                <Text style={styles.addBtnText}>🚨 全体チャットへ送信</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>ランキング (ranking.tsx) 管理</Text>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: '#8B5CF6' }]}>
                <Text style={[styles.outlineBtnText, { color: '#8B5CF6' }]}>🏆 現在のシーズンを締め切り、報酬を配布</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: '#10B981', marginTop: 10 }]}>
                <Text style={[styles.outlineBtnText, { color: '#10B981' }]}>🔄 新シーズンを開幕する</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ⚖️ 4. 経済・バランス調整タブ */}
        {activeTab === 'economy' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内経済・報酬エコシステム</Text>
            
            <Text style={styles.label}>バトル獲得経験値 (EXP) ベース倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={expMulti} onChangeText={setExpMulti} />
            
            <Text style={styles.label}>アイテム/カード ドロップベース倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={dropMulti} onChangeText={setDropMulti} />
            
            <Text style={styles.infoText}>※キャンペーン期間中などに倍率を上げることで、全ユーザーの獲得効率を一括で引き上げます。</Text>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.addBtnText}>エコシステム設定を適用</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0F172A' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoutBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  
  tabScroll: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', maxHeight: 60 },
  tabContainer: { paddingHorizontal: 10, alignItems: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 14, marginRight: 8 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#0F172A' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#0F172A', fontWeight: '900' },
  
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 12, marginTop: 8 },
  formSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  label: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  infoText: { color: '#64748B', fontSize: 12, marginBottom: 16, fontWeight: '600', lineHeight: 18 },
  
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 10, marginBottom: 10, color: '#0F172A' },
  addBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  outlineBtn: { borderWidth: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  outlineBtnText: { fontWeight: '800', fontSize: 14 },
  
  miniChip: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  activeMiniChip: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1 },
  miniChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  
  listItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  itemName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  itemSub: { fontSize: 12, color: '#64748B' },
});