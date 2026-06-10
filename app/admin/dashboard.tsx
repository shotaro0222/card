import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ugc_cards'); // ugc_cards, bosses, shop, events, settings
  
  // データリスト
  const [ugcCards, setUgcCards] = useState<any[]>([]);
  const [bosses, setBosses] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // フォーム状態（ボス追加）
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('');
  const [bAtk, setBAtk] = useState('');
  const [bLat, setBLat] = useState('35.6983'); // 初期値: 立川近辺
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('1000');
  const [bImage, setBImage] = useState('https://images.unsplash.com/photo-1542051812-ba32e18ce6a6');

  // フォーム状態（ショップアイテム追加）
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');
  const [sType, setSType] = useState('card_pack'); // card_pack, item

  // フォーム状態（イベント追加）
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');

  // フォーム状態（システム設定）
  const [expMultiplier, setExpMultiplier] = useState('1.0');

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'ugc_cards') {
      const { data } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
      if (data) setUgcCards(data);
    } else if (activeTab === 'bosses') {
      const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false });
      if (data) setBosses(data);
    } else if (activeTab === 'shop') {
      const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
      if (data) setShopItems(data);
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    } else if (activeTab === 'settings') {
      const { data } = await supabase.from('system_settings').select('*').eq('key', 'base_exp_multiplier').single();
      if (data) setExpMultiplier(data.value);
    }
  };

  // 1. 限定ボスの追加（デザイン・発生場所・ステータス全指定）
  const handleAddBoss = async () => {
    if (!bName || !bHp || !bAtk || !bLat || !bLng) {
      Alert.alert('エラー', '必須項目を入力してください');
      return;
    }
    const { error } = await supabase.from('bosses').insert([
      { 
        name: bName, 
        hp: parseInt(bHp), 
        atk: parseInt(bAtk), 
        def: 10, 
        lat: parseFloat(bLat), 
        lng: parseFloat(bLng), 
        radius_meters: parseInt(bRadius),
        image_url: bImage,
        is_active: true 
      }
    ]);
    if (error) { Alert.alert('失敗', error.message); } 
    else { Alert.alert('成功', '限定ボスを配置しました'); fetchAdminData(); }
  };

  // 2. ショップアイテムの追加
  const handleAddShopItem = async () => {
    if (!sName || !sPrice) return;
    const { error } = await supabase.from('shop_items').insert([
      { name: sName, price: parseInt(sPrice), item_type: sType, is_active: true }
    ]);
    if (!error) { Alert.alert('成功', '商品を追加しました'); setSName(''); setSPrice(''); fetchAdminData(); }
  };

  // 3. イベントの追加
  const handleAddEvent = async () => {
    if (!eTitle || !eDesc) return;
    const { error } = await supabase.from('events').insert([
      { title: eTitle, description: eDesc, is_active: true }
    ]);
    if (!error) { Alert.alert('成功', 'イベントを公開しました'); setETitle(''); setEDesc(''); fetchAdminData(); }
  };

  // 4. UGCカードのステータス・特別デザイン調整
  const handleAdjustCard = async (cardId: string, currentFixed: boolean, currentAtk: number) => {
    // 例として、攻撃力を+10し、特別デザイン（🌟）フラグをトグル反転させる調整
    const { error } = await supabase.from('cards').update({
      is_fixed: !currentFixed,
      status_atk: currentAtk + 10
    }).eq('id', cardId);
    
    if (!error) {
      Alert.alert('調整完了', 'カードのステータスとデザイン属性を更新しました。');
      fetchAdminData();
    }
  };

  // 5. 獲得ポイント（経験値倍率）の調整保存
  const handleSaveSettings = async () => {
    const { error } = await supabase.from('system_settings').upsert({
      key: 'base_exp_multiplier', value: expMultiplier, description: '戦闘獲得経験値の基本倍率'
    });
    if (!error) Alert.alert('成功', 'システムバランスを再適用しました。');
  };

  const toggleActive = async (table: string, id: string, current: boolean) => {
    await supabase.from(table).update({ is_active: !current }).eq('id', id);
    fetchAdminData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STRATEGIC ADMIN</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>終了</Text>
        </TouchableOpacity>
      </View>

      {/* ナビゲーションタブ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {[
          { id: 'ugc_cards', label: 'UGCカード監視' },
          { id: 'bosses', label: '限定ボス配置' },
          { id: 'shop', label: 'ショップ設定' },
          { id: 'events', label: 'イベント構築' },
          { id: 'settings', label: 'バランス調整' }
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        
        {/* 1. UGCカード監視 & ステータス・特別デザイン調整 */}
        {activeTab === 'ugc_cards' && (
          <View>
            <Text style={styles.sectionTitle}>ユーザー生成コンテンツ(UGC) 監視台帳</Text>
            {ugcCards.map((card) => (
              <View key={card.id} style={styles.listItemVertical}>
                <Image source={{ uri: card.image_url }} style={styles.cardPreviewImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemName}>{card.is_fixed ? '🌟 ' : ''}{card.card_name}</Text>
                  <Text style={styles.itemSub}>所属ID: {card.player_id.substring(0,8)}... | ロール: {card.card_role}</Text>
                  <Text style={styles.itemSub}>HP: {card.status_hp} | ATK: {card.status_atk} | DEF: {card.status_def}</Text>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => handleAdjustCard(card.id, card.is_fixed, card.status_atk)}
                  >
                    <Text style={styles.adjustBtnText}>⚡ 特別枠切替 & ATK強化</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 2. 限定ボス追加（デザイン・発生場所・ステータス全指定） */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>エリア限定ボス 新規プロット</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <TextInput style={styles.input} placeholder="体力 (HP)" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
              <TextInput style={styles.input} placeholder="攻撃力 (ATK)" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              <TextInput style={styles.input} placeholder="出現緯度 (Latitude)" value={bLat} onChangeText={setBLat} />
              <TextInput style={styles.input} placeholder="出現経度 (Longitude)" value={bLng} onChangeText={setBLng} />
              <TextInput style={styles.input} placeholder="影響半径 (meters)" keyboardType="numeric" value={bRadius} onChangeText={setBRadius} />
              <TextInput style={styles.input} placeholder="デザイン画像URL" value={bImage} onChangeText={setBImage} />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>指定座標にボスを配置</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>配置済みボス一覧</Text>
            {bosses.map((b) => (
              <View key={b.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{b.name}</Text>
                  <Text style={styles.itemSub}>📍 緯度:{b.lat} 経度:{b.lng} (内{b.radius_meters}m)</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, b.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('bosses', b.id, b.is_active)}>
                  <Text style={styles.statusBtnText}>{b.is_active ? '出現中' : '隠蔽中'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 3. ショップ金額・内容管理 */}
        {activeTab === 'shop' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>新商品の追加</Text>
              <TextInput style={styles.input} placeholder="商品名" value={sName} onChangeText={setSName} />
              <TextInput style={styles.input} placeholder="販売価格 (ゴールド)" keyboardType="numeric" value={sPrice} onChangeText={sPrice} />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {['card_pack', 'item'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.miniChip, sType === t && styles.activeMiniChip]} onPress={() => setSType(t)}>
                    <Text style={styles.miniChipText}>{t === 'card_pack' ? 'カードパック' : '消費アイテム'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={handleAddShopItem}>
                <Text style={styles.addBtnText}>ショップに陳列する</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>現在の商品ラインナップ</Text>
            {shopItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>価格: {item.price} Gold | 種別: {item.item_type}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, item.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('shop_items', item.id, item.is_active)}>
                  <Text style={styles.statusBtnText}>{item.is_active ? '販売中' : '売切設定'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 4. イベント管理 */}
        {activeTab === 'events' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>新規広域イベントの構築</Text>
              <TextInput style={styles.input} placeholder="イベントタイトル" value={eTitle} onChangeText={setETitle} />
              <TextInput style={styles.input} placeholder="概要・説明文" value={eDesc} onChangeText={setEDesc} />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddEvent}>
                <Text style={styles.addBtnText}>イベントスケジュールを発令</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>発令中のイベント一覧</Text>
            {events.map((e) => (
              <View key={e.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{e.title}</Text>
                  <Text style={styles.itemSub}>{e.description}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, e.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('events', e.id, e.is_active)}>
                  <Text style={styles.statusBtnText}>{e.is_active ? '開催中' : '終了設定'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 5. 獲得ポイント調整（自動計算の補正倍率） */}
        {activeTab === 'settings' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内経済・報酬エコシステム調整</Text>
            <Text style={styles.label}>バトル獲得経験値（EXP）の自動生成倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={expMultiplier} onChangeText={setExpMultiplier} />
            <Text style={styles.infoText}>※1.0を基準として、全ユーザーの獲得効率をグローバルに一括調整します。</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveSettings}>
              <Text style={styles.addBtnText}>システム設定を保存・即時適用</Text>
            </TouchableOpacity>
          </View>
        )}

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
  label: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  infoText: { color: '#64748B', fontSize: 11, marginBottom: 16, fontWeight: '600' },
  
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 10, marginBottom: 10, color: '#0F172A' },
  addBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemVertical: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  itemSub: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  
  cardPreviewImage: { width: 70, height: 90, borderRadius: 8, backgroundColor: '#F1F5F9' },
  adjustBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  adjustBtnText: { color: '#2563EB', fontSize: 11, fontWeight: '800' },
  
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F1F5F9' },
  statusBtnText: { fontSize: 11, fontWeight: '800', color: '#1E293B' },
  
  miniChip: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  activeMiniChip: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1 },
  miniChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 20 }
});