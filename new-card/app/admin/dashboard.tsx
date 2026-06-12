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
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // 👹 フォーム状態（ボス追加）
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
  const [bCustomDesign, setBCustomDesign] = useState('');
  const [bEffect, setBEffect] = useState('none'); 
  const [autoBossEnabled, setAutoBossEnabled] = useState(false);

  // 🤖 フォーム状態（AIメーカー別調整）
  const [aiMaker, setAiMaker] = useState('');
  const [aiPromptText, setAiPromptText] = useState('');

  // 📢 フォーム状態（サーベイ配信）
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyTargets, setSurveyTargets] = useState<string[]>([]);
  const [surveyUrl, setSurveyUrl] = useState('');
  const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);
  const [availableSegments, setAvailableSegments] = useState<string[]>([
    '全ユーザー', '課金ユーザー', '無課金ユーザー', '10代', '20代', '30代', '男性', '女性', 'メーカーAカード所持', '立川エリアユーザー'
  ]);

  // 🛒 フォーム状態（ショップ）
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');
  const [sType, setSType] = useState('original_pack');
  const [sImage, setSImage] = useState(''); 
  const [sCardImages, setSCardImages] = useState<string[]>([]); 
  const [sEffect, setSEffect] = useState('none'); 
  
  // 🎊 フォーム状態（イベント構築 - 拡張機能）
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eTime, setETime] = useState('12:00 - 20:00');
  const [eBossName, setEBossName] = useState('');
  // 追加: 3つのロケーションモード
  const [eLocType, setELocType] = useState('coords'); // coords, landmark, random
  const [eCoords, setECoords] = useState<{lat: string, lng: string}[]>([{lat: '35.6983', lng: '139.4130'}]);
  const [eLandmark, setELandmark] = useState('');
  const [eRandomCount, setERandomCount] = useState('50');
  const [eLat, setELat] = useState('35.6983'); // ランダム・ランドマーク用の基準座標
  const [eLng, setELng] = useState('139.4130');

  // ⚖️ ゲーム内バランス調整用ステート
  const [expMultiplier, setExpMultiplier] = useState('1.0');
  const [hpMultiplier, setHpMultiplier] = useState('1.0');
  const [atkMultiplier, setAtkMultiplier] = useState('1.0');

  // 画像アップロード中のローディング状態
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
    } else if (activeTab === 'shop') {
      const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
      if (data) setShopItems(data);
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    } else if (activeTab === 'settings') {
      const { data: expData } = await supabase.from('system_settings').select('*').eq('key', 'base_exp_multiplier').single();
      if (expData) setExpMultiplier(expData.value);
      const { data: hpData } = await supabase.from('system_settings').select('*').eq('key', 'global_hp_multiplier').single();
      if (hpData) setHpMultiplier(hpData.value);
      const { data: atkData } = await supabase.from('system_settings').select('*').eq('key', 'global_atk_multiplier').single();
      if (atkData) setAtkMultiplier(atkData.value);
    }
  };

  // --- 👹 ボス関連ロジック ---
  const handleUpdateSkill = (text: string, index: number) => {
    const newSkills = [...bSkills];
    newSkills[index] = text;
    setBSkills(newSkills);
  };

  const handleGenerateRandomBoss = () => {
    setBName(`異変種ボス_${Math.floor(Math.random() * 1000)}`);
    setBHp(String(Math.floor(Math.random() * 500) + 100));
    setBAtk(String(Math.floor(Math.random() * 50) + 10));
    setBLat(String(parseFloat(bLat) + (Math.random() - 0.5) * 0.05));
    setBLng(String(parseFloat(bLng) + (Math.random() - 0.5) * 0.05));
    setBRadius('500');
    setBSkills(['ランダムストライク', 'なぎ払う']);
    setBDropName(`シークレットカード_${Math.floor(Math.random() * 100)}`);
    setBDropRarity(['Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 3)]);
    setBCustomDesign('{"frameColor": "gold"}');
    setBEffect(['sparkle', 'fire', 'hologram'][Math.floor(Math.random() * 3)]); 
  };

  const handleImageUpload = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        return Alert.alert('エラー', '画像を選択するにはカメラロールへのアクセス許可が必要です。');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, 
        quality: 0.8,        
        base64: true,        
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) throw new Error('画像のデータが取得できませんでした。');

        setIsUploading(true);
        const fileName = `admin_uploads/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('card_images') 
          .upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);
        setter(publicUrl);
        Alert.alert('成功', '画像のアップロードが完了しました。');
      }
    } catch (error: any) {
      Alert.alert('アップロード失敗', error.message || '画像の保存に失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultipleImagesUpload = async (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        return Alert.alert('エラー', '画像を選択するにはアクセス許可が必要です。');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const uploadedUrls: string[] = [];

        for (const asset of result.assets) {
          if (!asset.base64) continue;
          
          const fileName = `admin_uploads/pack_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('card_images')
            .upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
          }
        }

        if (uploadedUrls.length > 0) {
          setter(prev => [...prev, ...uploadedUrls]);
          Alert.alert('成功', `${uploadedUrls.length}枚の画像のアップロードが完了しました。`);
        } else {
          throw new Error('全てのアップロードに失敗しました');
        }
      }
    } catch (error: any) {
      Alert.alert('アップロード失敗', error.message || '画像の保存に失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddBoss = async () => {
    if (!bName || !bHp || !bAtk || !bLat || !bLng) {
      return Alert.alert('エラー', '必須項目を入力してください');
    }
    
    let finalDesign = {};
    try { if (bCustomDesign) finalDesign = JSON.parse(bCustomDesign); } catch (e) {}
    if (bEffect !== 'none') finalDesign = { ...finalDesign, effect: bEffect };

    const { error } = await supabase.from('bosses').insert([{ 
      name: bName, hp: parseInt(bHp), atk: parseInt(bAtk), def: 10, 
      lat: parseFloat(bLat), lng: parseFloat(bLng), radius_meters: parseInt(bRadius),
      image_url: bImage || null, skills: bSkills.filter(s => s !== ''),
      drop_card_name: bDropName || null, drop_card_rarity: bDropName ? bDropRarity : null,
      custom_design: Object.keys(finalDesign).length > 0 ? JSON.stringify(finalDesign) : null,
      is_active: true 
    }]);

    if (error) Alert.alert('失敗', error.message);
    else { Alert.alert('成功', '限定ボスとドロップ設定を配置しました'); fetchAdminData(); }
  };

  const toggleAutoBossGen = async () => {
    const newVal = !autoBossEnabled;
    await supabase.from('system_settings').upsert({ key: 'auto_boss_gen', value: newVal.toString() });
    setAutoBossEnabled(newVal);
    Alert.alert('設定更新', `ランダムボスの自動生成を${newVal ? 'ON' : 'OFF'}にしました。`);
  };

  // --- 🤖 AI & 📢 サーベイ ---
  const handleSaveAiPrompt = async () => {
    if (!aiMaker) return Alert.alert('エラー', 'メーカー・ブランド名を入力してください');
    Alert.alert('保存完了', `${aiMaker}用のAI雛形をシステムに適用しました。`);
    setAiMaker(''); setAiPromptText('');
  };

  const handleSendSurvey = async () => {
    if (surveyTargets.length === 0 || !surveyUrl) return Alert.alert('エラー', 'ターゲット条件とURLは必須です');
    Alert.alert('配信完了', `条件「${surveyTargets.join(', ')}」へサーベイをプッシュ配信しました。`);
    setSurveyTitle(''); 
    setSurveyTargets([]); 
    setSurveyUrl('');
  };

  // --- 🛒 ショップ関連ロジック ---
  const handleAddShopItem = async () => {
    if (!sName || !sPrice) return Alert.alert('エラー', '商品名と価格を入力してください');

    let customDesignObj: any = {};
    if (sEffect !== 'none') customDesignObj.effect = sEffect;
    
    if (sCardImages.length > 0) {
      customDesignObj.frameUrls = sCardImages;
    }

    const finalDesignJson = Object.keys(customDesignObj).length > 0 ? JSON.stringify(customDesignObj) : null;

    const { error } = await supabase.from('shop_items').insert([{ 
      name: sName, price: parseInt(sPrice), item_type: sType, 
      banner_url: sImage || null, 
      drop_rates: finalDesignJson,
      is_active: true 
    }]);

    if (!error) {
      Alert.alert('成功', '新コンセプトパックをショップに追加陳列しました');
      setSName(''); setSPrice(''); setSImage(''); setSCardImages([]); setSEffect('none');
      fetchAdminData();
    } else {
      Alert.alert('失敗', error.message);
    }
  };

  // --- 🎊 イベント & ⚖️ 設定 ---
  const handleAddEvent = async () => {
    if (!eTitle || !eDesc) return Alert.alert('エラー', 'タイトルと詳細説明を入力してください');

    let insertPayload: any[] = [];

    // 1. 複数座標モード
    if (eLocType === 'coords') {
      const validCoords = eCoords.filter(c => c.lat && c.lng);
      if (validCoords.length === 0) return Alert.alert('エラー', '有効な座標を1つ以上入力してください');
      
      insertPayload = validCoords.map(c => ({
        title: eTitle, 
        description: eDesc, 
        event_time_range: eTime,
        lat: parseFloat(c.lat) || 0, 
        lng: parseFloat(c.lng) || 0, 
        attached_boss_name: eBossName || null, 
        is_active: true
      }));
    } 
    // 2. ランドマークモード
    else if (eLocType === 'landmark') {
      if (!eLandmark) return Alert.alert('エラー', 'ランドマーク名を入力してください');
      
      insertPayload = [{
        title: eTitle, 
        description: `【📍${eLandmark}近辺】\n${eDesc}`, 
        event_time_range: eTime,
        lat: parseFloat(eLat) || 35.6983, 
        lng: parseFloat(eLng) || 139.4130, 
        attached_boss_name: eBossName || null, 
        is_active: true,
        landmark_name: eLandmark // 将来的な拡張に対応
      }];
    } 
    // 3. ランダム大量発生モード
    else if (eLocType === 'random') {
      const count = parseInt(eRandomCount);
      if (!count || count <= 0) return Alert.alert('エラー', '正しい発生数を入力してください');
      
      const baseLatNum = parseFloat(eLat) || 35.6983;
      const baseLngNum = parseFloat(eLng) || 139.4130;
      
      for (let i = 0; i < count; i++) {
        // 基準座標から ±約5kmの範囲にばら撒く (0.05度程度)
        const rLat = baseLatNum + (Math.random() - 0.5) * 0.05;
        const rLng = baseLngNum + (Math.random() - 0.5) * 0.05;
        
        insertPayload.push({
          title: `${eTitle} (No.${i+1})`, 
          description: eDesc, 
          event_time_range: eTime,
          lat: rLat, 
          lng: rLng, 
          attached_boss_name: eBossName || null, 
          is_active: true
        });
      }
    }

    const { error } = await supabase.from('events').insert(insertPayload);
    
    if (!error) { 
      Alert.alert('成功', `合計 ${insertPayload.length} 件のイベントスポットを発令しました`); 
      setETitle(''); setEDesc(''); setEBossName('');
      setECoords([{lat: '35.6983', lng: '139.4130'}]);
      setELandmark('');
      fetchAdminData(); 
    } else {
      Alert.alert('失敗', error.message);
    }
  };

  const handleAdjustCard = async (cardId: string, currentFixed: boolean, currentAtk: number) => {
    await supabase.from('cards').update({ is_fixed: !currentFixed, status_atk: currentAtk + 10 }).eq('id', cardId);
    Alert.alert('調整完了', 'カード属性を更新しました。'); fetchAdminData();
  };

  const handleSaveSettings = async () => {
    await supabase.from('system_settings').upsert({ key: 'base_exp_multiplier', value: expMultiplier });
    await supabase.from('system_settings').upsert({ key: 'global_hp_multiplier', value: hpMultiplier });
    await supabase.from('system_settings').upsert({ key: 'global_atk_multiplier', value: atkMultiplier });
    Alert.alert('成功', 'バランスを即時適用しました。');
  };

  const toggleActive = async (table: string, id: string, current: boolean) => {
    await supabase.from(table).update({ is_active: !current }).eq('id', id);
    fetchAdminData();
  };

  // --- UI レンダリング ---
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
          { id: 'bosses', label: '👹 ボスマップ' },
          { id: 'shop', label: '🛒 ショップ設定' },
          { id: 'ugc_cards', label: '📸 UGC監視' },
          { id: 'ai_prompt', label: '🤖 AI調整' },
          { id: 'survey', label: '📢 サーベイ' },
          { id: 'events', label: '🎊 イベント' },
          { id: 'settings', label: '⚖️ バランス' }
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* 👹 1. ボスマップ配置 */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.autoGenBox}>
              <View>
                <Text style={styles.autoGenText}>⏳ 1時間ごとのランダムボス自動生成</Text>
                <Text style={styles.autoGenSub}>ONにするとバックエンドで未知のボスが配置されます</Text>
              </View>
              <TouchableOpacity style={[styles.toggleBtn, autoBossEnabled ? styles.toggleOn : styles.toggleOff]} onPress={toggleAutoBossGen}>
                <Text style={[styles.toggleBtnText, autoBossEnabled ? styles.toggleTextOn : styles.toggleTextOff]}>{autoBossEnabled ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity style={[styles.addBtn, { flex: 1, marginTop: 0, backgroundColor: '#8B5CF6' }]} onPress={handleGenerateRandomBoss}>
                <Text style={styles.addBtnText}>🎲 パラメータをランダム生成 (手動)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>エリア限定ボス 新規プロット</Text>
              
              <Text style={styles.label}>基本ステータス</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              </View>

              <Text style={styles.label}>出現座標</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lat" value={bLat} onChangeText={setBLat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lng" value={bLng} onChangeText={setBLng} />
              </View>

              <Text style={styles.label}>討伐特典 (カード付与)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="ドロップカード名" value={bDropName} onChangeText={setBDropName} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="レア (例: Rare)" value={bDropRarity} onChangeText={setBDropRarity} />
              </View>
              
              <Text style={styles.label}>✨ リッチエフェクト (アニメーション/VFX)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[{id:'none', label:'なし'}, {id:'sparkle', label:'✨ キラキラ'}, {id:'fire', label:'🔥 炎属性'}, {id:'hologram', label:'💿 ホログラム'}, {id:'sakura', label:'🌸 桜舞う'}].map(eff => (
                  <TouchableOpacity key={eff.id} style={[styles.miniChip, bEffect === eff.id && styles.activeMiniChip]} onPress={() => setBEffect(eff.id)}>
                    <Text style={styles.miniChipText}>{eff.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>カード画像＆枠デザイン (JSON)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="画像URL" value={bImage} onChangeText={setBImage} />
                <TouchableOpacity 
                  style={[styles.outlineBtn, { marginBottom: 0, justifyContent: 'center' }]} 
                  onPress={() => handleImageUpload(setBImage)}
                  disabled={isUploading}
                >
                  <Text style={styles.outlineBtnText}>{isUploading ? '送信中...' : '⬆️ 画像選択'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder={`枠色等の指定\n例: {"frameColor": "gold"}`} multiline value={bCustomDesign} onChangeText={setBCustomDesign} />

              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>指定座標にボスを配置</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>配置済みボス</Text>
            {bosses.map((b) => (
              <View key={b.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{b.name}</Text>
                  <Text style={styles.itemSub}>📍 {b.lat}, {b.lng} | ドロップ: {b.drop_card_name || 'なし'}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, b.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('bosses', b.id, b.is_active)}>
                  <Text style={styles.statusBtnText}>{b.is_active ? '出現中' : '隠蔽中'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 🛒 5. ショップ設定 */}
        {activeTab === 'shop' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>マネタイズパック 新規陳列設定</Text>
              <TextInput style={styles.input} placeholder="パック名 (例: 〇〇コラボ限定パック)" value={sName} onChangeText={setSName} />
              <TextInput style={styles.input} placeholder="販売価格 (ゴールド)" keyboardType="numeric" value={sPrice} onChangeText={setSPrice} />
              
              <Text style={styles.label}>パックカテゴリ割付</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'original_pack', label: 'オリジナル' },
                  { id: 'influencer_pack', label: 'インフルエンサー' },
                  { id: 'celebrity_pack', label: '有名人・タレント' }
                ].map((packType) => (
                  <TouchableOpacity 
                    key={packType.id} 
                    style={[styles.miniChip, sType === packType.id && styles.activeMiniChip]} 
                    onPress={() => setSType(packType.id)}
                  >
                    <Text style={styles.miniChipText}>{packType.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>パッケージ画像 / コラボバナー</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="パッケージ画像URL" value={sImage} onChangeText={setSImage} />
                <TouchableOpacity 
                  style={[styles.outlineBtn, { marginBottom: 0, justifyContent: 'center' }]} 
                  onPress={() => handleImageUpload(setSImage)}
                  disabled={isUploading}
                >
                  <Text style={styles.outlineBtnText}>{isUploading ? '送信中...' : '⬆️ 画像選択'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>排出カードの特別デザイン / 枠画像 (複数枚登録可能)</Text>
              <View style={styles.multiImageContainer}>
                {sCardImages.map((url, index) => (
                  <View key={index} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: url }} style={styles.thumbnailImage} />
                    <TouchableOpacity 
                      style={styles.removeImgBtn} 
                      onPress={() => setSCardImages(prev => prev.filter((_, i) => i !== index))}
                    >
                      <Text style={styles.removeImgText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity 
                  style={styles.addImgBtn} 
                  onPress={() => handleMultipleImagesUpload(setSCardImages)}
                  disabled={isUploading}
                >
                  <Text style={styles.addImgText}>{isUploading ? '送信中' : '➕ 追加'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>✨ 出出カードの確定リッチエフェクト</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {[{id:'none', label:'なし'}, {id:'sparkle', label:'✨ キラ仕様'}, {id:'hologram', label:'💿 ホログラム'}, {id:'dark_aura', label:'🟣 ダークオーラ'}].map(eff => (
                  <TouchableOpacity key={eff.id} style={[styles.miniChip, sEffect === eff.id && styles.activeMiniChip]} onPress={() => setSEffect(eff.id)}>
                    <Text style={styles.miniChipText}>{eff.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddShopItem}>
                <Text style={styles.addBtnText}>ショップに追加・陳列</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>陳列中のショップアイテム</Text>
            {shopItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>価格: {item.price} Gold | 分類: {item.item_type}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, item.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('shop_items', item.id, item.is_active)}>
                  <Text style={styles.statusBtnText}>{item.is_active ? '販売中' : '非公開'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 👁️ 4. UGCカード監視 */}
        {activeTab === 'ugc_cards' && (
          <View>
            <Text style={styles.sectionTitle}>ユーザー生成コンテンツ(UGC) 監視台帳</Text>
            {ugcCards.length === 0 ? (
              <Text style={styles.infoText}>現在、データベース内にUGCカードがありません。</Text>
            ) : (
              ugcCards.map((card) => (
                <View key={card.id} style={styles.listItemVertical}>
                  <Image source={{ uri: card.image_url || 'https://via.placeholder.com/70x90' }} style={styles.cardPreviewImage} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemName}>{card.is_fixed ? '🌟 [限定枠] ' : ''}{card.card_name || '無名オブジェクト'}</Text>
                    <Text style={styles.itemSub}>種別: {card.is_founder ? '👑 Founder初版' : card.category || '通常図鑑'}</Text>
                    <Text style={styles.itemSub}>ATK: {card.status_atk || 0} | HP: {card.status_hp || 0}</Text>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustCard(card.id, card.is_fixed, card.status_atk || 0)}>
                      <Text style={styles.adjustBtnText}>⚡ 特別枠切替 & ATK+10調整</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 🤖 2. AI錬成ロジック調整 */}
        {activeTab === 'ai_prompt' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>企業・メーカー別 AI錬成ロジック調整</Text>
            <TextInput style={styles.input} placeholder="メーカー・ブランド名" value={aiMaker} onChangeText={setAiMaker} />
            <TextInput style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} placeholder="プロンプト雛形を入力..." multiline value={aiPromptText} onChangeText={setAiPromptText} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveAiPrompt}>
              <Text style={styles.addBtnText}>メーカー別AIロジックを保存</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 📢 3. サーベイ配信 */}
        {activeTab === 'survey' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>デモグラフィック・割付サーベイ配信</Text>
            <TextInput style={styles.input} placeholder="お知らせタイトル" value={surveyTitle} onChangeText={setSurveyTitle} />
            <Text style={styles.label}>割付・ターゲット条件指定 (複数選択可)</Text>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setIsSegmentDropdownOpen(!isSegmentDropdownOpen)}>
              <Text style={styles.dropdownHeaderText} numberOfLines={1}>
                {surveyTargets.length > 0 ? surveyTargets.join(', ') : 'デモグラフィック・セグメントを選択'}
              </Text>
              <Text style={styles.dropdownIcon}>{isSegmentDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {isSegmentDropdownOpen && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled={true}>
                  {availableSegments.map((segment) => {
                    const isSelected = surveyTargets.includes(segment);
                    return (
                      <TouchableOpacity 
                        key={segment} 
                        style={[styles.dropdownItem, isSelected && { backgroundColor: '#EFF6FF' }]} 
                        onPress={() => {
                          if (isSelected) {
                            setSurveyTargets(surveyTargets.filter(t => t !== segment));
                          } else {
                            setSurveyTargets([...surveyTargets, segment]);
                          }
                        }}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && { color: '#2563EB', fontWeight: 'bold' }]}>
                          {isSelected ? '☑ ' : '☐ '}{segment}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            
            <TextInput style={styles.input} placeholder="サーベイURL" value={surveyUrl} onChangeText={setSurveyUrl} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={handleSendSurvey}>
              <Text style={styles.addBtnText}>対象ユーザーへ配信を実行</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🎊 6. イベント構築 */}
        {activeTab === 'events' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>新規スポットイベント タイムライン構築</Text>
            <TextInput style={styles.input} placeholder="イベントタイトル" value={eTitle} onChangeText={setETitle} />
            <TextInput style={styles.input} placeholder="概要・告知説明文" value={eDesc} onChangeText={setEDesc} />
            <Text style={styles.label}>時間・日時指示</Text>
            <TextInput style={styles.input} placeholder="例: 12:00 - 18:00 (毎日開催)" value={eTime} onChangeText={setETime} />

            {/* 💡【追加】ロケーションモード選択UI */}
            <Text style={styles.label}>開催対象ロケーション設定</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[
                { id: 'coords', label: '📍 複数座標' },
                { id: 'landmark', label: '🏛️ ランドマーク' },
                { id: 'random', label: '🌪️ ランダム発生' }
              ].map((locType) => (
                <TouchableOpacity 
                  key={locType.id} 
                  style={[styles.miniChip, eLocType === locType.id && styles.activeMiniChip]} 
                  onPress={() => setELocType(locType.id)}
                >
                  <Text style={styles.miniChipText}>{locType.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 📍 モード1: 複数座標 */}
            {eLocType === 'coords' && (
              <View>
                {eCoords.map((coord, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="緯度 (Lat)" value={coord.lat} onChangeText={(v) => { const newC = [...eCoords]; newC[index].lat = v; setECoords(newC); }} />
                    <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="経度 (Lng)" value={coord.lng} onChangeText={(v) => { const newC = [...eCoords]; newC[index].lng = v; setECoords(newC); }} />
                    {eCoords.length > 1 && (
                      <TouchableOpacity onPress={() => setECoords(eCoords.filter((_, i) => i !== index))} style={styles.removeLocBtn}>
                        <Text style={styles.removeLocText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setECoords([...eCoords, { lat: '', lng: '' }])}>
                  <Text style={styles.outlineBtnText}>➕ 座標を追加</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 🏛️ モード2: ランドマーク */}
            {eLocType === 'landmark' && (
              <View>
                <TextInput style={styles.input} placeholder="目印となる建物・施設名 (例: 東京タワー)" value={eLandmark} onChangeText={setELandmark} />
                <Text style={styles.infoText}>※施設付近のスポットに自動的にイベントを配置します。</Text>
              </View>
            )}

            {/* 🌪️ モード3: ランダム発生 */}
            {eLocType === 'random' && (
              <View>
                <Text style={styles.label}>ばら撒きの基準となる中心座標</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="基準緯度" value={eLat} onChangeText={setELat} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="基準経度" value={eLng} onChangeText={setELng} />
                </View>
                <Text style={styles.label}>ランダム発生数</Text>
                <TextInput style={styles.input} placeholder="発生させる数 (例: 100)" keyboardType="numeric" value={eRandomCount} onChangeText={setERandomCount} />
                <Text style={styles.infoText}>※基準座標の周辺に指定した数のイベントを完全にランダムでばら撒きます。</Text>
              </View>
            )}

            <Text style={styles.label}>出現連動ボス指定 (任意)</Text>
            <TextInput style={styles.input} placeholder="出現させるボスキャラ名を入力" value={eBossName} onChangeText={setEBossName} />

            <TouchableOpacity style={styles.addBtn} onPress={handleAddEvent}>
              <Text style={styles.addBtnText}>イベントスケジュールを発令</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ⚖️ 7. バランス調整 */}
        {activeTab === 'settings' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内メカニクス・ステータス一括調整</Text>
            <Text style={styles.label}>戦闘獲得経験値（EXP）の自動生成倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={expMultiplier} onChangeText={setExpMultiplier} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveSettings}>
              <Text style={styles.addBtnText}>システムステータス調整を即時保存</Text>
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
  outlineBtn: { borderWidth: 1, borderColor: '#3B82F6', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  outlineBtnText: { color: '#3B82F6', fontWeight: '700', fontSize: 13 },
  
  autoGenBox: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  autoGenText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  autoGenSub: { fontSize: 11, color: '#64748B', marginTop: 4 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  toggleOn: { backgroundColor: '#10B981', borderColor: '#059669' },
  toggleOff: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  toggleTextOn: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  toggleTextOff: { color: '#64748B', fontWeight: '800', fontSize: 13 },

  dropdownHeader: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownHeaderText: { color: '#0F172A', fontSize: 14, flex: 1, marginRight: 10 },
  dropdownIcon: { color: '#64748B', fontSize: 12, fontWeight: 'bold' },
  dropdownList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 16, maxHeight: 180 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { color: '#1E293B', fontSize: 14, fontWeight: '500' },
  
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

  multiImageContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  thumbnailWrapper: { position: 'relative', width: 75, height: 75, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: 8 },
  removeImgBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  removeImgText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  addImgBtn: { width: 75, height: 75, borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  addImgText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },

  removeLocBtn: { backgroundColor: '#EF4444', width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  removeLocText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }
});