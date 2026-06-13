import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('bosses'); 
  
  // 共通データリスト
  const [ugcCards, setUgcCards] = useState<any[]>([]);
  const [bosses, setBosses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // 運営機能用状態
  const [users, setUsers] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>({
    total_users: 0, total_cards: 0, total_bosses: 0, total_events: 0
  });

  // 👑 MINT & ショップ出品 フォーム状態
  const [cardGenMode, setCardGenMode] = useState<'manual' | 'ai'>('manual');
  const [cName, setCName] = useState('');
  const [cImage, setCImage] = useState('');
  const [cAttr, setCAttr] = useState('Fire');
  const [cHp, setCHp] = useState('');
  const [cAtk, setCAtk] = useState('');
  const [cDef, setCDef] = useState('');
  const [cSpd, setCSpd] = useState('');
  const [cSkillName, setCSkillName] = useState('');
  const [cAiPrompt, setCAiPrompt] = useState('');

  // 🛒 ショップ併売オプション
  const [listToShop, setListToShop] = useState(false);
  const [shopPrice, setShopPrice] = useState('');
  const [packImage, setPackImage] = useState('');
  const [packCardCount, setPackCardCount] = useState('1');
  const [packRarity, setPackRarity] = useState('Normal');
  const [packDesign, setPackDesign] = useState('Standard');

  // 👥 ユーザー管理用
  const [searchUserQuery, setSearchUserQuery] = useState('');

  // 🏢 スポンサー管理フォーム状態
  const [spName, setSpName] = useState('');
  const [spCampaignTitle, setSpCampaignTitle] = useState('');
  const [spItemName, setSpItemName] = useState('');
  const [spBudget, setSpBudget] = useState('');

  // 👹 ボス追加 フォーム状態
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('');
  const [bAtk, setBAtk] = useState('');
  const [bLat, setBLat] = useState('35.6983');
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('1000');
  const [bImage, setBImage] = useState('');
  const [bSkills, setBSkills] = useState<string[]>(['']);
  const [bDropName, setBDropName] = useState('');
  const [bDropRarity, setBDropRarity] = useState('Normal');
  const [bDropAttr, setBDropAttr] = useState('Fire');
  const [bDropImage, setBDropImage] = useState('');
  const [bCustomDesign, setBCustomDesign] = useState('');
  const [bEffect, setBEffect] = useState('none'); 
  const [autoBossEnabled, setAutoBossEnabled] = useState(false);

  // 📢 お知らせ配信 フォーム状態
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const [nTarget, setNTarget] = useState('all');

  // 🎊 イベント構築
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eTime, setETime] = useState('12:00 - 20:00');
  const [eBossName, setEBossName] = useState('');
  const [eLocType, setELocType] = useState('coords'); 
  const [eCoords, setECoords] = useState<{lat: string, lng: string}[]>([{lat: '35.6983', lng: '139.4130'}]);
  const [eLandmark, setELandmark] = useState('');
  const [eRandomCount, setERandomCount] = useState('50');
  const [eLat, setELat] = useState('35.6983'); 
  const [eLng, setELng] = useState('139.4130');

  // ⚖️ バランス調整
  const [expMultiplier, setExpMultiplier] = useState('1.0');
  const [hpMultiplier, setHpMultiplier] = useState('1.0');
  const [atkMultiplier, setAtkMultiplier] = useState('1.0');

  const [isUploading, setIsUploading] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchAdminData(); }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'ugc_cards') {
      const { data } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
      if (data) setUgcCards(data);
    } else if (activeTab === 'bosses') {
      const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false });
      if (data) setBosses(data);
      const { data: autoData } = await supabase.from('system_settings').select('*').eq('key', 'auto_boss_gen').single();
      if (autoData) setAutoBossEnabled(autoData.value === 'true');
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    } else if (activeTab === 'users_manage') {
      const { data } = await supabase.from('users_profiles').select('*').order('created_at', { ascending: false });
      if (data) setUsers(data);
    } else if (activeTab === 'sponsors') {
      const { data } = await supabase.from('sponsors_campaigns').select('*').order('created_at', { ascending: false });
      if (data) setSponsors(data);
    } else if (activeTab === 'announcements') {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (data) setAnnouncements(data);
    } else if (activeTab === 'analytics') {
      // 本番データから件数を取得
      const { count: uCount } = await supabase.from('users_profiles').select('*', { count: 'exact', head: true });
      const { count: cCount } = await supabase.from('cards').select('*', { count: 'exact', head: true });
      const { count: bCount } = await supabase.from('bosses').select('*', { count: 'exact', head: true });
      const { count: eCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
      
      setAnalyticsData({
        total_users: uCount || 0,
        total_cards: cCount || 0,
        total_bosses: bCount || 0,
        total_events: eCount || 0
      });
    } else if (activeTab === 'settings') {
      const { data: expData } = await supabase.from('system_settings').select('*').eq('key', 'base_exp_multiplier').single();
      if (expData) setExpMultiplier(expData.value);
    }
  };

  const handleImageUpload = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) return Alert.alert('エラー', '画像アクセス許可が必要です。');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true,        
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) throw new Error('画像データ取得エラー');
        setIsUploading(true);
        const fileName = `admin_uploads/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);
        setter(publicUrl);
        Alert.alert('成功', 'アップロード完了');
      }
    } catch (error: any) { Alert.alert('失敗', error.message); } finally { setIsUploading(false); }
  };

  // 👑 MINT & ショップ出品統合ロジック
  const handleCreatePremiumCard = async () => {
    let cardData: any = {};

    if (cardGenMode === 'manual') {
      if (!cName || !cHp || !cAtk || !cDef || !cSpd || !cSkillName) {
        return Alert.alert('エラー', '必須項目を入力してください');
      }
      cardData = {
        card_name: cName, image_url: cImage || null, category: 'premium',
        status_hp: parseInt(cHp), status_atk: parseInt(cAtk), status_def: parseInt(cDef), status_spd: parseInt(cSpd),
        attribute: cAttr, skills: [cSkillName], is_fixed: true
      };
    } else {
      if (!cAiPrompt) return Alert.alert('エラー', 'AIプロンプトを入力してください');
      cardData = {
        card_name: `AI_${cName || '未命名'}`, image_url: cImage || null, category: 'premium_ai',
        status_hp: Math.floor(Math.random() * 80) + 120, status_atk: Math.floor(Math.random() * 40) + 60,
        status_def: Math.floor(Math.random() * 30) + 40, status_spd: Math.floor(Math.random() * 50) + 50,
        attribute: cAttr, skills: ['AIバースト'], is_fixed: true
      };
    }

    const { data: insertedCard, error } = await supabase.from('cards').insert([cardData]).select().single();
    if (error) return Alert.alert('失敗', error.message);

    // ショップにも出品する場合
    if (listToShop) {
      if (!shopPrice) return Alert.alert('エラー', 'ショップ出品用の価格を入力してください');
      const shopPayload = {
        name: `${cardData.card_name} 限定パッケージ`,
        price: parseInt(shopPrice),
        item_type: 'premium_pack',
        banner_url: packImage || cImage,
        drop_rates: JSON.stringify({
          guaranteed_card_id: insertedCard.id,
          count: parseInt(packCardCount),
          rarity: packRarity,
          design: packDesign
        }),
        is_active: true
      };
      const { error: shopError } = await supabase.from('shop_items').insert([shopPayload]);
      if (shopError) return Alert.alert('ショップ登録失敗', shopError.message);
    }

    Alert.alert('成功', '特権カードをMINT' + (listToShop ? 'し、ショップへ出品しました' : 'しました'));
    fetchAdminData();
  };

  // 👹 ボス登録ロジック
  const handleAddBoss = async () => {
    if (!bName || !bHp || !bAtk || !bLat || !bLng) return Alert.alert('エラー', '必須項目を入力してください');
    let finalDesign: any = {};
    if (bCustomDesign) { try { finalDesign = JSON.parse(bCustomDesign); } catch (e) {} }
    if (bEffect !== 'none') finalDesign.effect = bEffect;
    if (bDropImage) finalDesign.imageUrl = bDropImage;

    const { error } = await supabase.from('bosses').insert([{ 
      name: bName, hp: parseInt(bHp), atk: parseInt(bAtk), def: 10, 
      lat: parseFloat(bLat), lng: parseFloat(bLng), radius_meters: parseInt(bRadius),
      image_url: bImage || null, skills: bSkills.filter(s => s !== ''),
      drop_card_name: bDropName || null, drop_card_rarity: bDropName ? bDropRarity : null,
      drop_card_attribute: bDropName ? bDropAttr : null,
      custom_design: Object.keys(finalDesign).length > 0 ? JSON.stringify(finalDesign) : null,
      is_active: true 
    }]);
    if (error) Alert.alert('失敗', error.message);
    else { Alert.alert('成功', 'ARボスを登録しました'); fetchAdminData(); }
  };

  // 📢 お知らせ配信ロジック
  const handleSendAnnouncement = async () => {
    if (!nTitle || !nBody) return Alert.alert('エラー', 'タイトルと本文は必須です');
    const { error } = await supabase.from('announcements').insert([{
      title: nTitle, content: nBody, target_segment: nTarget
    }]);
    if (error) Alert.alert('失敗', error.message);
    else { Alert.alert('成功', 'お知らせを配信しました'); setNTitle(''); setNBody(''); fetchAdminData(); }
  };

  // 👥 ユーザー権限変更
  const handleUserAction = async (userId: string, action: 'ban' | 'role_admin' | 'role_user' | 'clear_reports') => {
    let updateData = {};
    if (action === 'ban') updateData = { is_banned: true };
    if (action === 'role_admin') updateData = { role: 'admin' };
    if (action === 'role_user') updateData = { role: 'user' };
    if (action === 'clear_reports') updateData = { report_count: 0 };
    const { error } = await supabase.from('users_profiles').update(updateData).eq('id', userId);
    if (!error) { Alert.alert('成功', '同期完了'); fetchAdminData(); }
  };

  // フィルタリング済みユーザーリスト
  const filteredUsers = users.filter(u => u.username?.includes(searchUserQuery) || u.id.includes(searchUserQuery));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STRATEGIC SYSTEM CENTER</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>終了</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {[
          { id: 'users_manage', label: '👥 ユーザー' },
          { id: 'ugc_cards', label: '🎴 カード監視' },
          { id: 'premium_card_mint', label: '👑 MINT＆ショップ' },
          { id: 'bosses', label: '👹 ARボス/マップ' },
          { id: 'events', label: '🎊 イベント' },
          { id: 'sponsors', label: '🏢 スポンサー' },
          { id: 'analytics', label: '📊 データ分析' },
          { id: 'announcements', label: '📢 お知らせ配信' }
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        
        {/* 1. ユーザー管理 */}
        {activeTab === 'users_manage' && (
          <View>
            <View style={styles.formContainer}>
              <TextInput style={styles.input} placeholder="ユーザー名・UIDで検索..." value={searchUserQuery} onChangeText={setSearchUserQuery} />
            </View>
            {filteredUsers.map((u) => (
              <View key={u.id} style={styles.listItemVertical}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{u.username || 'NoName'} {u.is_banned && '🚨[BAN]'}</Text>
                  <Text style={styles.itemSub}>権限: {u.role || 'user'} | 通報: {u.report_count || 0}回</Text>
                </View>
                <View style={styles.horizontalBtnGroup}>
                  <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleUserAction(u.id, 'ban')}><Text style={styles.miniActionBtnText}>BAN</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleUserAction(u.id, u.role === 'admin' ? 'role_user' : 'role_admin')}><Text style={styles.miniActionBtnText}>権限</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 2. カード監視 (省略せず表示) */}
        {activeTab === 'ugc_cards' && (
          <View>
            {ugcCards.map((card) => (
              <View key={card.id} style={styles.listItemVertical}>
                <Text style={styles.itemName}>{card.card_name} (ATK: {card.status_atk})</Text>
              </View>
            ))}
          </View>
        )}

        {/* 3. 特権MINT ＆ ショップ出品 */}
        {activeTab === 'premium_card_mint' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>カード生成 ＆ ショップ同時出品</Text>
            
            <TextInput style={styles.input} placeholder="カード名称" value={cName} onChangeText={setCName} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="カード画像URL" value={cImage} onChangeText={setCImage} />
              <TouchableOpacity style={styles.outlineBtn} onPress={() => handleImageUpload(setCImage)}>
                <Text style={styles.outlineBtnText}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={cHp} onChangeText={setCHp} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={cAtk} onChangeText={setCAtk} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="DEF" keyboardType="numeric" value={cDef} onChangeText={setCDef} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="SPD" keyboardType="numeric" value={cSpd} onChangeText={setCSpd} />
            </View>

            <TextInput style={styles.input} placeholder="技名" value={cSkillName} onChangeText={setCSkillName} />

            {/* ショップ統合部分 */}
            <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
              <TouchableOpacity onPress={() => setListToShop(!listToShop)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>{listToShop ? '☑' : '☐'}</Text>
                <Text style={{ fontWeight: 'bold' }}>🛒 このカードをショップにも出品・パッケージ化する</Text>
              </TouchableOpacity>

              {listToShop && (
                <View>
                  <TextInput style={styles.input} placeholder="販売価格 (コイン)" keyboardType="numeric" value={shopPrice} onChangeText={setShopPrice} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="封入枚数 (例: 5)" value={packCardCount} onChangeText={setPackCardCount} />
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="レアリティ" value={packRarity} onChangeText={setPackRarity} />
                  </View>
                  <TextInput style={styles.input} placeholder="パッケージ/カードデザイン (例: GoldFrame)" value={packDesign} onChangeText={setPackDesign} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="パッケージ画像URL" value={packImage} onChangeText={setPackImage} />
                    <TouchableOpacity style={styles.outlineBtn} onPress={() => handleImageUpload(setPackImage)}>
                      <Text style={styles.outlineBtnText}>📷</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#8B5CF6', marginTop: 15 }]} onPress={handleCreatePremiumCard}>
              <Text style={styles.addBtnText}>MINT実行 {listToShop && '& ショップ登録'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. ARボス/マップ */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>ボス登録 / マップドロップ設定</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lat (緯度)" value={bLat} onChangeText={setBLat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lng (経度)" value={bLng} onChangeText={setBLng} />
              </View>

              <Text style={styles.label}>討伐ドロップカード詳細設定</Text>
              <TextInput style={styles.input} placeholder="ドロップカード名" value={bDropName} onChangeText={setBDropName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="レアリティ (Normal, Rare...)" value={bDropRarity} onChangeText={setBDropRarity} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="属性 (Fire, Water...)" value={bDropAttr} onChangeText={setBDropAttr} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="専用カードデザイン(画像URL)" value={bDropImage} onChangeText={setBDropImage} />
                <TouchableOpacity style={styles.outlineBtn} onPress={() => handleImageUpload(setBDropImage)}>
                  <Text style={styles.outlineBtnText}>📷</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>ARボスを配置</Text>
              </TouchableOpacity>
            </View>

            {bosses.map((b) => (
              <View key={b.id} style={styles.listItemVertical}>
                <Text style={styles.itemName}>{b.name} (HP: {b.hp})</Text>
                <Text style={styles.itemSub}>ドロップ: {b.drop_card_name || 'なし'} [{b.drop_card_rarity}]</Text>
              </View>
            ))}
          </View>
        )}

        {/* 7. データ分析 (本番データ同期済み) */}
        {activeTab === 'analytics' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>リアルタイム統計ダッシュボード</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#666' }}>総ユーザー数</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{analyticsData.total_users}</Text>
              </View>
              <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#666' }}>生成済みカード</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{analyticsData.total_cards}</Text>
              </View>
              <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#666' }}>配置ボス数</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{analyticsData.total_bosses}</Text>
              </View>
              <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#666' }}>イベント拠点数</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{analyticsData.total_events}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 8. お知らせ配信 (新規追加) */}
        {activeTab === 'announcements' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内お知らせ・プッシュ配信</Text>
            <TextInput style={styles.input} placeholder="お知らせタイトル" value={nTitle} onChangeText={setNTitle} />
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="本文を入力..." multiline value={nBody} onChangeText={setNBody} />
            <TextInput style={styles.input} placeholder="ターゲット (例: all, premium_users)" value={nTarget} onChangeText={setNTarget} />
            
            <TouchableOpacity style={styles.addBtn} onPress={handleSendAnnouncement}>
              <Text style={styles.addBtnText}>お知らせを配信する</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>配信履歴</Text>
            {announcements.map((a) => (
              <View key={a.id} style={styles.listItemVertical}>
                <Text style={styles.itemName}>{a.title}</Text>
                <Text style={styles.itemSub}>対象: {a.target_segment} | 日付: {new Date(a.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  logoutText: { color: '#374151', fontWeight: 'bold' },
  tabScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e7eb', flexGrow: 0 },
  tabContainer: { paddingHorizontal: 10 },
  tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderColor: 'transparent' },
  activeTab: { borderColor: '#3b82f6' },
  tabText: { color: '#6b7280', fontWeight: 'bold' },
  activeTabText: { color: '#3b82f6' },
  content: { padding: 16 },
  formContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 20 },
  formSectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 10, marginBottom: 10 },
  addBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 6, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  outlineBtn: { borderWidth: 1, borderColor: '#d1d5db', padding: 10, borderRadius: 6, justifyContent: 'center' },
  outlineBtnText: { fontSize: 16 },
  listItemVertical: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: 'bold' },
  itemSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  horizontalBtnGroup: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
  miniActionBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginBottom: 4 }
});