import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null); // 🚨 エラー表示用
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  const fetchUserDataAndCampaigns = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('forge_tickets, last_ticket_reset, is_premium').eq('id', user.id).single();
    if (profile) {
      setIsPremium(profile.is_premium);
      const lastReset = new Date(profile.last_ticket_reset).toDateString();
      const today = new Date().toDateString();
      setTickets(lastReset !== today ? 3 : profile.forge_tickets);
    }
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) setActiveCampaigns(campaigns);
  };

  const takePhoto = async () => {
    if (!isPremium && tickets <= 0) {
      Alert.alert('チケットがありません', '本日の無料作成枠を使い切りました。ストアをご確認ください。');
      return;
    }

    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPerm.granted) {
      Alert.alert('カメラへのアクセス', 'カードを作成するためにカメラへのアクセスを許可してください。');
      return;
    }

    let userLat = null, userLng = null;
    const locationPerm = await Location.requestForegroundPermissionsAsync();
    if (locationPerm.granted) {
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        userLat = location.coords.latitude;
        userLng = location.coords.longitude;
      } catch (e) { console.log(e); }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      forgeCard(result.assets[0].base64, userLat, userLng);
    }
  };

  const forgeCard = async (base64Img: string, lat: number | null, lng: number | null) => {
    setLoading(true);
    setDebugError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証エラー: ログインし直してください');

      if (!isPremium) {
        const { data: canForge, error: rpcError } = await supabase.rpc('use_forge_ticket', { target_user_id: user.id });
        if (rpcError || !canForge) throw new Error(`チケット処理エラー: ${rpcError?.message}`);
        setTickets(prev => prev - 1);
      }

      // 画像のアップロード
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像アップロードエラー: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      // 💡【修正箇所1】宛先を 'super-task' に変更
      const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium, customName: isPremium ? customName : null, activeCampaigns, userLat: lat, userLng: lng }
      });
      
      if (aiError) throw new Error(`AI通信エラー: ${aiError.message || JSON.stringify(aiError)}`);
      if (!aiData) throw new Error('AIからデータが返ってきませんでした');
      if (aiData.error) throw new Error(`AI内部エラー: ${aiData.error}`);

      // 💡【修正箇所2】新旧どちらのAIプロンプトから返ってきても対応できるようにデータを整理
      const finalName = aiData.card_name || aiData.name || '名称不明';
      const finalSkill = aiData.skill_name || aiData.skill || '通常攻撃';
      const finalHp = aiData.status_hp || aiData.hp || 100;
      const finalAtk = aiData.status_atk || aiData.atk || 10;
      const finalDef = aiData.status_def || aiData.def || 10;
      const finalSpd = aiData.status_spd || aiData.spd || 10;

      // データベースに保存
      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: finalName,
        image_url: publicUrl,
        feature: aiData.feature || '',
        skill_name: finalSkill,
        status_hp: finalHp,
        status_atk: finalAtk,
        status_def: finalDef,
        status_spd: finalSpd,
        status_total: finalHp + finalAtk + finalDef + finalSpd,
        rarity: aiData.rarity || 'N',
        card_type: aiData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiData.campaign_id || null,
        location_lat: lat,
        location_lng: lng,
        is_fixed: aiData.is_fixed || false,
        ar_model_url: aiData.ar_model_url || null,
        card_role: Math.random() > 0.7 ? 'support' : 'attacker', // アタッカー/サポートの役割付与
        is_active: false // 保存時は未出撃状態にする
      }]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      Alert.alert('完成！', `新しいカード「${finalName}」を図鑑に追加しました。`, [
        { text: '図鑑を確認', onPress: () => router.push('/(tabs)') }
      ]);
      setCustomName('');
      
    } catch (error: any) {
      console.error("🚨 エラー発生:", error);
      setDebugError(error.message || JSON.stringify(error)); // 画面にエラー理由を強制表示
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🚨 デバッグ用エラー表示領域（エラー発生時のみ出現） */}
      {debugError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>🚨 エラーが発生しました</Text>
          <ScrollView style={{ maxHeight: 150 }}>
            <Text style={styles.errorText}>{debugError}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.errorCloseBtn} onPress={() => setDebugError(null)}>
            <Text style={styles.errorCloseText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 上部ステータス */}
      <View style={styles.statusRow}>
        <View style={[styles.ticketPill, isPremium && styles.premiumPill]}>
          <Text style={[styles.ticketText, isPremium && styles.premiumText]}>
            {isPremium ? '👑 無制限パス適用中' : `残り ${tickets} 枚`}
          </Text>
        </View>
      </View>

      {/* メインのアクションエリア */}
      <View style={styles.centerArea}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>カードを生成中...</Text>
          </View>
        ) : (
          <View style={styles.actionBox}>
            {isPremium && (
              <TextInput
                style={styles.input}
                placeholder="好きな名前を指定 (任意)"
                placeholderTextColor="#94A3B8"
                value={customName}
                onChangeText={setCustomName}
                maxLength={15}
              />
            )}
            <TouchableOpacity 
              style={[styles.primaryButton, (!isPremium && tickets <= 0) && styles.disabledButton]} 
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Camera color="#FFFFFF" size={28} style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>カメラを起動</Text>
            </TouchableOpacity>
            <Text style={styles.subText}>現実の風景や商品を撮影してカード化</Text>
          </View>
        )}
      </View>

      {/* 下部のインフォメーション */}
      {activeCampaigns.length > 0 && (
        <View style={styles.infoArea}>
          <Text style={styles.infoText}>📍 開催中のご当地・企業コラボ: {activeCampaigns.length} 件</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  errorBox: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(225, 29, 72, 0.95)', padding: 16, borderRadius: 12, zIndex: 9999, borderWidth: 2, borderColor: '#FFF' },
  errorTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  errorText: { color: '#FFF', fontSize: 12, fontFamily: 'monospace' },
  errorCloseBtn: { backgroundColor: '#FFF', padding: 10, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  errorCloseText: { color: '#E11D48', fontWeight: '900' },

  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
  ticketPill: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  premiumPill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  ticketText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  premiumText: { color: '#2563EB' },
  
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  actionBox: { width: '100%', alignItems: 'center' },
  
  input: { backgroundColor: '#FFFFFF', width: '100%', padding: 18, borderRadius: 16, fontSize: 16, color: '#0F172A', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  primaryButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  disabledButton: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '500' },
  
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#3B82F6', marginTop: 20, fontSize: 16, fontWeight: '700' },
  
  infoArea: { padding: 20, alignItems: 'center', paddingBottom: 30 },
  infoText: { color: '#64748B', fontSize: 13, fontWeight: '600' }
});



ダッシュボード

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


インデックス

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect } from 'expo-router';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  const fetchUserDataAndCampaigns = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('forge_tickets, last_ticket_reset, is_premium').eq('id', user.id).single();
    if (profile) {
      setIsPremium(profile.is_premium);
      const lastReset = new Date(profile.last_ticket_reset).toDateString();
      const today = new Date().toDateString();
      setTickets(lastReset !== today ? 3 : profile.forge_tickets);
    }
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) setActiveCampaigns(campaigns);
  };

  const takePhoto = async () => {
    if (!isPremium && tickets <= 0) {
      Alert.alert('チケットがありません', '本日の無料作成枠を使い切りました。ストアをご確認ください。');
      return;
    }

    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPerm.granted) {
      Alert.alert('カメラへのアクセス', 'カードを作成するためにカメラへのアクセスを許可してください。');
      return;
    }

    let userLat = null, userLng = null;
    const locationPerm = await Location.requestForegroundPermissionsAsync();
    if (locationPerm.granted) {
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        userLat = location.coords.latitude;
        userLng = location.coords.longitude;
      } catch (e) { console.log(e); }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      forgeCard(result.assets[0].base64, userLat, userLng);
    }
  };

  const forgeCard = async (base64Img: string, lat: number | null, lng: number | null) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証エラー');

      if (!isPremium) {
        const { data: canForge, error: rpcError } = await supabase.rpc('use_forge_ticket', { target_user_id: user.id });
        if (rpcError || !canForge) throw new Error('チケット処理エラー');
        setTickets(prev => prev - 1);
      }

      const fileName = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      const { data: aiData, error: aiError } = await supabase.functions.invoke('forge-card', {
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium, customName: isPremium ? customName : null, activeCampaigns, userLat: lat, userLng: lng }
      });
      if (aiError || !aiData) throw new Error('AI生成失敗');

      await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiData.name,
        image_url: publicUrl,
        feature: aiData.feature,
        skill_name: aiData.skill,
        status_hp: aiData.hp,
        status_atk: aiData.atk,
        status_def: aiData.def,
        status_spd: aiData.spd,
        status_total: aiData.hp + aiData.atk + aiData.def + aiData.spd,
        rarity: aiData.rarity,
        card_type: aiData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiData.campaign_id || null,
        location_lat: lat,
        location_lng: lng,
        is_fixed: aiData.is_fixed || false,
        ar_model_url: aiData.ar_model_url || null,
        is_active: true 
      }]);

      Alert.alert('完成！', `新しいカード「${aiData.name}」を図鑑に追加しました。`);
      setCustomName('');
    } catch (error: any) {
      Alert.alert('エラー', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 上部ステータス */}
      <View style={styles.statusRow}>
        <View style={[styles.ticketPill, isPremium && styles.premiumPill]}>
          <Text style={[styles.ticketText, isPremium && styles.premiumText]}>
            {isPremium ? '👑 無制限パス適用中' : `残り ${tickets} 枚`}
          </Text>
        </View>
      </View>

      {/* メインのアクションエリア */}
      <View style={styles.centerArea}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>AIがカードを生成中...</Text>
          </View>
        ) : (
          <View style={styles.actionBox}>
            {isPremium && (
              <TextInput
                style={styles.input}
                placeholder="好きな名前を指定 (任意)"
                placeholderTextColor="#94A3B8"
                value={customName}
                onChangeText={setCustomName}
                maxLength={15}
              />
            )}
            <TouchableOpacity 
              style={[styles.primaryButton, (!isPremium && tickets <= 0) && styles.disabledButton]} 
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Camera color="#FFFFFF" size={28} style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>カメラを起動</Text>
            </TouchableOpacity>
            <Text style={styles.subText}>現実の風景や商品を撮影してカード化</Text>
          </View>
        )}
      </View>

      {/* 下部のインフォメーション */}
      {activeCampaigns.length > 0 && (
        <View style={styles.infoArea}>
          <Text style={styles.infoText}>📍 開催中のご当地・企業コラボ: {activeCampaigns.length} 件</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
  ticketPill: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  premiumPill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  ticketText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  premiumText: { color: '#2563EB' },
  
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  actionBox: { width: '100%', alignItems: 'center' },
  
  input: { backgroundColor: '#FFFFFF', width: '100%', padding: 18, borderRadius: 16, fontSize: 16, color: '#0F172A', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  primaryButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  disabledButton: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '500' },
  
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#3B82F6', marginTop: 20, fontSize: 16, fontWeight: '700' },
  
  infoArea: { padding: 20, alignItems: 'center', paddingBottom: 30 },
  infoText: { color: '#64748B', fontSize: 13, fontWeight: '600' }
});
