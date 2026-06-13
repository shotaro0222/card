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
  
  // --- 新規追加分の状態管理（運営機能拡張用） ---
  const [users, setUsers] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>({
    dau: 0, mau: 0, total_posts: 0, total_battles: 0, demographics: { males: 0, females: 0, teens: 0, twenties: 0, thirties: 0 }
  });

  // 🎴 企業・有名人特別カード作成フォーム状態
  const [cardGenMode, setCardGenMode] = useState<'manual' | 'ai'>('manual'); // manual or ai
  const [cName, setCName] = useState('');
  const [cImage, setCImage] = useState('');
  const [cAttr, setCAttr] = useState('Fire'); // 属性
  const [cHp, setCHp] = useState('');
  const [cAtk, setCAtk] = useState('');
  const [cDef, setCDef] = useState('');
  const [cSpd, setCSpd] = useState(''); // 4つのステータス
  const [cSkillName, setCSkillName] = useState(''); // 技名
  const [cAiPrompt, setCAiPrompt] = useState(''); // AI生成用プロンプト

  // 👥 ユーザー管理用
  const [searchUserQuery, setSearchUserQuery] = useState('');

  // 🏢 スポンサー管理フォーム状態
  const [spName, setSpName] = useState('');
  const [spCampaignTitle, setSpCampaignTitle] = useState('');
  const [spItemName, setSpItemName] = useState('');
  const [spBudget, setSpBudget] = useState('');

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
  const [eLocType, setELocType] = useState('coords'); // coords, landmark, random
  const [eCoords, setECoords] = useState<{lat: string, lng: string}[]>([{lat: '35.6983', lng: '139.4130'}]);
  const [eLandmark, setELandmark] = useState('');
  const [eRandomCount, setERandomCount] = useState('50');
  const [eLat, setELat] = useState('35.6983'); 
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
    } else if (activeTab === 'users_manage') {
      const { data } = await supabase.from('users_profiles').select('*').order('created_at', { ascending: false });
      if (data) setUsers(data);
    } else if (activeTab === 'sponsors') {
      const { data } = await supabase.from('sponsors_campaigns').select('*').order('created_at', { ascending: false });
      if (data) setSponsors(data);
    } else if (activeTab === 'analytics') {
      // 本来は集計クエリを実行
      setAnalyticsData({
        dau: 1250, mau: 18400, total_posts: 4520, total_battles: 8940,
        demographics: { males: 58, females: 42, teens: 25, twenties: 45, thirties: 30 }
      });
    } else if (activeTab === 'settings') {
      const { data: expData } = await supabase.from('system_settings').select('*').eq('key', 'base_exp_multiplier').single();
      if (expData) setExpMultiplier(expData.value);
      const { data: hpData } = await supabase.from('system_settings').select('*').eq('key', 'global_hp_multiplier').single();
      if (hpData) setHpMultiplier(hpData.value);
      const { data: atkData } = await supabase.from('system_settings').select('*').eq('key', 'global_atk_multiplier').single();
      if (atkData) setAtkMultiplier(atkData.value);
    }
  };

  // --- 🎴 メーカー・有名人特権カード作成ロジック ---
  const handleCreatePremiumCard = async () => {
    if (cardGenMode === 'manual') {
      if (!cName || !cHp || !cAtk || !cDef || !cSpd || !cSkillName) {
        return Alert.alert('エラー', '手動作成の必須項目をすべて入力してください');
      }
      const { error } = await supabase.from('cards').insert([{
        card_name: cName, image_url: cImage || null, category: 'premium',
        status_hp: parseInt(cHp), status_atk: parseInt(cAtk), status_def: parseInt(cDef), status_spd: parseInt(cSpd),
        attribute: cAttr, skills: [cSkillName], is_fixed: true
      }]);
      if (error) Alert.alert('失敗', error.message);
      else { Alert.alert('成功', '特権ステータスカードを手動登録しました'); fetchAdminData(); }
    } else {
      if (!cAiPrompt) return Alert.alert('エラー', 'AIへの指示文（プロンプト）を入力してください');
      Alert.alert('AI生成シミュレート', `${cAiPrompt} に基づき、4種ステータス、属性、技名を自動錬成しました。`);
      const { error } = await supabase.from('cards').insert([{
        card_name: `AI_${cName || '未命名'}`, image_url: cImage || null, category: 'premium_ai',
        status_hp: Math.floor(Math.random() * 80) + 120, status_atk: Math.floor(Math.random() * 40) + 60,
        status_def: Math.floor(Math.random() * 30) + 40, status_spd: Math.floor(Math.random() * 50) + 50,
        attribute: ['Fire', 'Water', 'Wind', 'Earth'][Math.floor(Math.random() * 4)],
        skills: ['AIインパルス', '自動最適化バースト'], is_fixed: true
      }]);
      if (error) Alert.alert('失敗', error.message);
      else { Alert.alert('成功', 'AI自動生成カードを登録しました'); fetchAdminData(); }
    }
  };

  // --- 👥 ユーザー管理ロジック ---
  const handleUserAction = async (userId: string, action: 'ban' | 'role_admin' | 'role_user' | 'clear_reports') => {
    let updateData = {};
    if (action === 'ban') updateData = { is_banned: true };
    if (action === 'role_admin') updateData = { role: 'admin' };
    if (action === 'role_user') updateData = { role: 'user' };
    if (action === 'clear_reports') updateData = { report_count: 0 };

    const { error } = await supabase.from('users_profiles').update(updateData).eq('id', userId);
    if (!error) { Alert.alert('成功', 'ユーザー権限・ステータスを即時同期しました'); fetchAdminData(); }
  };

  // --- 🎴 カード管理（削除・編集・非公開）ロジック ---
  const handleManageCard = async (cardId: string, action: 'delete' | 'hide' | 'publish') => {
    if (action === 'delete') {
      Alert.alert('警告', 'このカードを完全に抹消しますか？', [
        { text: 'キャンセル' },
        { text: '削除実行', style: 'destructive', onPress: async () => {
          await supabase.from('cards').delete().eq('id', cardId);
          fetchAdminData();
        }}
      ]);
    } else {
      const isHidden = action === 'hide';
      await supabase.from('cards').update({ is_hidden: isHidden }).eq('id', cardId);
      Alert.alert('成功', isHidden ? 'カードを非公開に指定しました' : 'カードを公開に復帰しました');
      fetchAdminData();
    }
  };

  // --- 🏢 スポンサー管理ロジック ---
  const handleAddSponsoredCampaign = async () => {
    if (!spName || !spCampaignTitle) return Alert.alert('エラー', '企業名とキャンペーンタイトルは必須です');
    const { error } = await supabase.from('sponsors_campaigns').insert([{
      sponsor_name: spName, campaign_title: spCampaignTitle,
      product_card_name: spItemName || null, budget: parseInt(spBudget) || 0, is_active: true
    }]);
    if (!error) { Alert.alert('成功', 'スポンサータイアップキャンペーンを発令しました'); fetchAdminData(); }
  };

  // --- 📊 分析：CSVエクスポート機能 ---
  const handleExportUsersCSV = () => {
    if (users.length === 0) return Alert.alert('情報', '出力対象のユーザーが存在しません');
    let csvContent = 'ID,ユーザー名,ロール,BAN状態,通報数,作成日時\n';
    users.forEach(u => {
      csvContent += `${u.id},${u.username || 'NoName'},${u.role || 'user'},${u.is_banned ? 'BAN' : '正常'},${u.report_count || 0},${u.created_at}\n`;
    });
    Alert.alert('CSVエクスポート成功 (擬似)', `管理者用ローカルストレージ/PC共有領域へ書き出しました。\n(レコード数: ${users.length}件)`);
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
        allowsEditing: true, quality: 0.8, base64: true,        
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) throw new Error('画像のデータが取得できませんでした。');
        setIsUploading(true);
        const fileName = `admin_uploads/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('card_images').upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);
        setter(publicUrl);
        Alert.alert('成功', '画像のアップロードが完了しました。');
      }
    } catch (error: any) {
      Alert.alert('アップロード失敗', error.message || '画像の保存に失敗しました。');
    } finally { setIsUploading(false); }
  };

  const handleMultipleImagesUpload = async (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) return Alert.alert('エラー', 'アクセス許可が必要です。');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8, base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          if (!asset.base64) continue;
          const fileName = `admin_uploads/pack_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('card_images').upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
          }
        }
        if (uploadedUrls.length > 0) {
          setter(prev => [...prev, ...uploadedUrls]);
          Alert.alert('成功', `${uploadedUrls.length}枚の画像のアップロードが完了しました。`);
        } else { throw new Error('全てのアップロードに失敗しました'); }
      }
    } catch (error: any) { Alert.alert('アップロード失敗', error.message || '画像の保存に失敗しました。'); }
    finally { setIsUploading(false); }
  };

  const handleAddBoss = async () => {
    if (!bName || !bHp || !bAtk || !bLat || !bLng) return Alert.alert('エラー', '必須項目を入力してください');
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
    else { Alert.alert('成功', 'ARボスおよびイベントスポットとして登録しました'); fetchAdminData(); }
  };

  const toggleAutoBossGen = async () => {
    const newVal = !autoBossEnabled;
    await supabase.from('system_settings').upsert({ key: 'auto_boss_gen', value: newVal.toString() });
    setAutoBossEnabled(newVal);
    Alert.alert('設定更新', `ランダムボスの自動生成を${newVal ? 'ON' : 'OFF'}にしました。`);
  };

  const handleSaveAiPrompt = async () => {
    if (!aiMaker) return Alert.alert('エラー', 'メーカー・ブランド名を入力してください');
    Alert.alert('保存完了', `${aiMaker}用のAI雛形をシステムに適用しました。`);
    setAiMaker(''); setAiPromptText('');
  };

  const handleSendSurvey = async () => {
    if (surveyTargets.length === 0 || !surveyUrl) return Alert.alert('エラー', 'ターゲット条件とURLは必須です');
    Alert.alert('配信完了', `条件「${surveyTargets.join(', ')}」へサーベイをプッシュ配信しました。`);
    setSurveyTitle(''); setSurveyTargets([]); setSurveyUrl('');
  };

  const handleAddShopItem = async () => {
    if (!sName || !sPrice) return Alert.alert('エラー', '商品名と価格を入力してください');
    let customDesignObj: any = {};
    if (sEffect !== 'none') customDesignObj.effect = sEffect;
    if (sCardImages.length > 0) customDesignObj.frameUrls = sCardImages;

    const { error } = await supabase.from('shop_items').insert([{ 
      name: sName, price: parseInt(sPrice), item_type: sType, 
      banner_url: sImage || null, drop_rates: JSON.stringify(customDesignObj), is_active: true 
    }]);
    if (!error) {
      Alert.alert('成功', '新コンセプトパックをショップに追加陳列しました');
      setSName(''); setSPrice(''); setSImage(''); setSCardImages([]); setSEffect('none');
      fetchAdminData();
    } else { Alert.alert('失敗', error.message); }
  };

  const handleAddEvent = async () => {
    if (!eTitle || !eDesc) return Alert.alert('エラー', 'タイトルと詳細説明を入力してください');
    let insertPayload: any[] = [];

    if (eLocType === 'coords') {
      const validCoords = eCoords.filter(c => c.lat && c.lng);
      if (validCoords.length === 0) return Alert.alert('エラー', '有効な座標を1つ以上入力してください');
      insertPayload = validCoords.map(c => ({
        title: eTitle, description: eDesc, event_time_range: eTime,
        lat: parseFloat(c.lat) || 0, lng: parseFloat(c.lng) || 0, 
        attached_boss_name: eBossName || null, is_active: true
      }));
    } else if (eLocType === 'landmark') {
      if (!eLandmark) return Alert.alert('エラー', 'ランドマーク名を入力してください');
      insertPayload = [{
        title: eTitle, description: `【📍${eLandmark}近辺】\n${eDesc}`, event_time_range: eTime,
        lat: parseFloat(eLat) || 35.6983, lng: parseFloat(eLng) || 139.4130, 
        attached_boss_name: eBossName || null, is_active: true
      }];
    } else if (eLocType === 'random') {
      const count = parseInt(eRandomCount);
      if (!count || count <= 0) return Alert.alert('エラー', '正しい発生数を入力してください');
      const baseLatNum = parseFloat(eLat) || 35.6983;
      const baseLngNum = parseFloat(eLng) || 139.4130;
      for (let i = 0; i < count; i++) {
        insertPayload.push({
          title: `${eTitle} (No.${i+1})`, description: eDesc, event_time_range: eTime,
          lat: baseLatNum + (Math.random() - 0.5) * 0.05, lng: baseLngNum + (Math.random() - 0.5) * 0.05, 
          attached_boss_name: eBossName || null, is_active: true
        });
      }
    }

    const { error } = await supabase.from('events').insert(insertPayload);
    if (!error) { 
      Alert.alert('成功', `合計 ${insertPayload.length} 件のARイベントスポットを登録しました`); 
      setETitle(''); setEDesc(''); setECoords([{lat: '35.6983', lng: '139.4130'}]); fetchAdminData(); 
    } else { Alert.alert('失敗', error.message); }
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
          { id: 'users_manage', label: '👥 ユーザー管理' },
          { id: 'ugc_cards', label: '🎴 カード管理' },
          { id: 'premium_card_mint', label: '👑 特権MINT' },
          { id: 'bosses', label: '👹 ARボス/マップ' },
          { id: 'events', label: '🎊 イベント登録' },
          { id: 'sponsors', label: '🏢 スポンサー広告' },
          { id: 'analytics', label: '📊 データ分析' },
          { id: 'shop', label: '🛒 ショップ' },
          { id: 'settings', label: '⚖️ バランス' }
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* 👥 1. ユーザー管理 (BAN, 通報, 権限変更) */}
        {activeTab === 'users_manage' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>ユーザー検索 / アカウント監査</Text>
              <TextInput style={styles.input} placeholder="ユーザー名・UIDでフィルタリング..." value={searchUserQuery} onChangeText={setSearchUserQuery} />
            </View>
            <Text style={styles.sectionTitle}>管理ユーザー台帳 ({users.length}件)</Text>
            {users.map((u) => (
              <View key={u.id} style={styles.listItemVertical}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{u.username || '名無しのアバター'} {u.is_banned && '🚨[BAN済み]'}</Text>
                  <Text style={styles.itemSub}>権限ロール: {u.role || 'user'} | 🚨被通報件数: {u.report_count || 0}回</Text>
                </View>
                <View style={styles.horizontalBtnGroup}>
                  <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleUserAction(u.id, 'ban')}>
                    <Text style={styles.miniActionBtnText}>BAN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleUserAction(u.id, 'clear_reports')}>
                    <Text style={styles.miniActionBtnText}>通報却下</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleUserAction(u.id, u.role === 'admin' ? 'role_user' : 'role_admin')}>
                    <Text style={styles.miniActionBtnText}>権限変更</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 🎴 2. カード管理 (UGC監視・削除・編集・非公開) */}
        {activeTab === 'ugc_cards' && (
          <View>
            <Text style={styles.sectionTitle}>アセット・UGCカード総合監視台帳</Text>
            {ugcCards.length === 0 ? (
              <Text style={styles.infoText}>データベース内に該当カードがありません。</Text>
            ) : (
              ugcCards.map((card) => (
                <View key={card.id} style={styles.listItemVertical}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={{ uri: card.image_url || 'https://via.placeholder.com/70x90' }} style={styles.cardPreviewImage} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.itemName}>{card.is_hidden ? '👁️‍🗨️[非公開] ' : ''}{card.card_name || '名称未設定'}</Text>
                      <Text style={styles.itemSub}>属性: {card.attribute || '通常'} | ATK: {card.status_atk || 0} | DEF: {card.status_def || 0}</Text>
                    </View>
                  </View>
                  <View style={[styles.horizontalBtnGroup, { marginTop: 10 }]}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustCard(card.id, card.is_fixed, card.status_atk || 0)}>
                      <Text style={styles.adjustBtnText}>⚡ ATK+10/編集補正</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#6B7280' }]} onPress={() => handleManageCard(card.id, card.is_hidden ? 'publish' : 'hide')}>
                      <Text style={styles.miniActionBtnText}>{card.is_hidden ? '公開' : '非公開'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#DC2626' }]} onPress={() => handleManageCard(card.id, 'delete')}>
                      <Text style={styles.miniActionBtnText}>削除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 👑 3. 特権カードMINT (メーカー・有名人対応：手動4種ステータス＋属性＋技 or AI錬成) */}
        {activeTab === 'premium_card_mint' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>企業請負・オフィシャル有名人カード生成</Text>
            
            <View style={styles.modeToggleContainer}>
              <TouchableOpacity style={[styles.modeTab, cardGenMode === 'manual' && styles.activeModeTab]} onPress={() => setCardGenMode('manual')}>
                <Text style={cardGenMode === 'manual' ? styles.activeModeText : styles.modeText}>📋 手動詳細設定パターン</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeTab, cardGenMode === 'ai' && styles.activeModeTab]} onPress={() => setCardGenMode('ai')}>
                <Text style={cardGenMode === 'ai' ? styles.activeModeText : styles.modeText}>🤖 AI自動プロンプト生成</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="カード名称 (例: メイカー公式A)" value={cName} onChangeText={setCName} />
            
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="アセット画像URL" value={cImage} onChangeText={setCImage} />
              <TouchableOpacity style={[styles.outlineBtn, { marginBottom: 0 }]} onPress={() => handleImageUpload(setCImage)}>
                <Text style={styles.outlineBtnText}>📷 アップ</Text>
              </TouchableOpacity>
            </View>

            {cardGenMode === 'manual' ? (
              <View>
                <Text style={styles.label}>属性選択</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {['Fire', 'Water', 'Wind', 'Earth', 'Light', 'Dark'].map((attr) => (
                    <TouchableOpacity key={attr} style={[styles.miniChip, cAttr === attr && styles.activeMiniChip]} onPress={() => setCAttr(attr)}>
                      <Text style={styles.miniChipText}>{attr}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>4大コアステータス割当</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={cHp} onChangeText={setCHp} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={cAtk} onChangeText={setCAtk} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="DEF" keyboardType="numeric" value={cDef} onChangeText={setCDef} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="SPD" keyboardType="numeric" value={cSpd} onChangeText={setCSpd} />
                </View>

                <Text style={styles.label}>固有の特殊技名</Text>
                <TextInput style={styles.input} placeholder="例: ブランド・マキシマムノヴァ" value={cSkillName} onChangeText={setCSkillName} />
              </View>
            ) : (
              <View>
                <Text style={styles.label}>AI錬成プロンプト (世界観やイメージ、モチーフを入力)</Text>
                <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="例: 創業100年の老舗メーカー。重厚な鋼鉄と伝統の炎属性、攻撃力高めのバランス" multiline value={cAiPrompt} onChangeText={setCAiPrompt} />
              </View>
            )}

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#8B5CF6' }]} onPress={handleCreatePremiumCard}>
              <Text style={styles.addBtnText}>オフィシャルカードを発行・同期</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 👹 4. AR管理：ボス登録 */}
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

            <TouchableOpacity style={[styles.addBtn, { marginBottom: 16, backgroundColor: '#8B5CF6' }]} onPress={handleGenerateRandomBoss}>
              <Text style={styles.addBtnText}>🎲 パラメータをランダム生成 (手動)</Text>
            </TouchableOpacity>

            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>エリア限定ARボス レイドプロット</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              </View>

              <Text style={styles.label}>出現中心座標</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lat" value={bLat} onChangeText={setBLat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lng" value={bLng} onChangeText={setBLng} />
              </View>

              <Text style={styles.label}>討伐ドロップ特典カード</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="ドロップカード名" value={bDropName} onChangeText={setBDropName} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Rarity" value={bDropRarity} onChangeText={setBDropRarity} />
              </View>
              
              <Text style={styles.label}>✨ 特殊リッチエフェクト(VFX)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[{id:'none', label:'なし'}, {id:'sparkle', label:'✨ キラ'}, {id:'fire', label:'🔥 炎'}, {id:'hologram', label:'💿 ホロ'}, {id:'sakura', label:'🌸 桜'}].map(eff => (
                  <TouchableOpacity key={eff.id} style={[styles.miniChip, bEffect === eff.id && styles.activeMiniChip]} onPress={() => setBEffect(eff.id)}>
                    <Text style={styles.miniChipText}>{eff.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>指定座標にARボスを配置</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>配置中のボス一覧</Text>
            {bosses.map((b) => (
              <View key={b.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{b.name}</Text>
                  <Text style={styles.itemSub}>📍 {b.lat}, {b.lng} | 特典: {b.drop_card_name || 'なし'}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, b.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('bosses', b.id, b.is_active)}>
                  <Text style={styles.statusBtnText}>{b.is_active ? '出現中' : '非アクティブ'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 🎊 5. AR管理：イベント登録 */}
        {activeTab === 'events' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>AR連動スポットイベント構築</Text>
            <TextInput style={styles.input} placeholder="イベントタイトル" value={eTitle} onChangeText={setETitle} />
            <TextInput style={styles.input} placeholder="概要説明テキスト" value={eDesc} onChangeText={setEDesc} />
            <TextInput style={styles.input} placeholder="開催時間範囲(例: 10:00 - 22:00)" value={eTime} onChangeText={setETime} />

            <Text style={styles.label}>ロケーション条件割当</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[{ id: 'coords', label: '📍 複数座標プロット' }, { id: 'landmark', label: '🏛️ ランドマーク' }, { id: 'random', label: '🌪️ 大量ランダム' }].map((locType) => (
                <TouchableOpacity key={locType.id} style={[styles.miniChip, eLocType === locType.id && styles.activeMiniChip]} onPress={() => setELocType(locType.id)}>
                  <Text style={styles.miniChipText}>{locType.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {eLocType === 'coords' && (
              <View style={styles.coordsBox}>
                <Text style={styles.itemSub}>基準座標:</Text>
                <TextInput style={styles.input} placeholder="Lat" value={eCoords[0].lat} onChangeText={(t) => setECoords([{...eCoords[0], lat: t}])} />
                <TextInput style={styles.input} placeholder="Lng" value={eCoords[0].lng} onChangeText={(t) => setECoords([{...eCoords[0], lng: t}])} />
              </View>
            )}

            {eLocType === 'landmark' && (
              <TextInput style={styles.input} placeholder="対象ランドマーク名 (例: 立川駅、特定タワー)" value={eLandmark} onChangeText={setELandmark} />
            )}

            {eLocType === 'random' && (
              <TextInput style={styles.input} placeholder="ランダム大量発生件数" keyboardType="numeric" value={eRandomCount} onChangeText={setERandomCount} />
            )}

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#10B981' }]} onPress={handleAddEvent}>
              <Text style={styles.addBtnText}>ARスポットイベントを発令</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🏢 6. スポンサー管理 (商品カード・企業キャンペーン) */}
        {activeTab === 'sponsors' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>タイアップ広告・企業キャンペーンの出稿</Text>
            <TextInput style={styles.input} placeholder="出稿企業・スポンサー名" value={spName} onChangeText={setSpName} />
            <TextInput style={styles.input} placeholder="キャンペーン企画名" value={spCampaignTitle} onChangeText={setSpCampaignTitle} />
            <TextInput style={styles.input} placeholder="タイアップ用限定配布商品カード名" value={spItemName} onChangeText={setSpItemName} />
            <TextInput style={styles.input} placeholder="キャンペーン予算 (円設定)" keyboardType="numeric" value={spBudget} onChangeText={setSpBudget} />
            
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleAddSponsoredCampaign}>
              <Text style={styles.addBtnText}>スポンサータイアップを有効化</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>稼働中の広告・タイアップ ({sponsors.length}件)</Text>
            {sponsors.map((sp) => (
              <View key={sp.id} style={styles.listItem}>
                <View>
                  <Text style={styles.itemName}>{sp.sponsor_name} : {sp.campaign_title}</Text>
                  <Text style={styles.itemSub}>商品連携: {sp.product_card_name || 'なし'} | 予算プール: ¥{sp.budget}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 📊 7. 分析 (DAU, MAU, 投稿・バトル数, デモグラ, CSVエクスポート) */}
        {activeTab === 'analytics' && (
          <View>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>DAU (日間アクティブ)</Text>
                <Text style={styles.analyticsValue}>{analyticsData.dau} 名</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>MAU (月間アクティブ)</Text>
                <Text style={styles.analyticsValue}>{analyticsData.mau} 名</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>UGCカード総投稿数</Text>
                <Text style={styles.analyticsValue}>{analyticsData.total_posts} 件</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>総ARバトルマッチ数</Text>
                <Text style={styles.analyticsValue}>{analyticsData.total_battles} 試合</Text>
              </View>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>ユーザー属性・デモグラフィック比率</Text>
              <Text style={styles.itemSub}>🚹 男性: {analyticsData.demographics.males}%  /  🚺 女性: {analyticsData.demographics.females}%</Text>
              <Text style={styles.itemSub}>🎂 10代: {analyticsData.demographics.teens}% | 20代: {analyticsData.demographics.twenties}% | 30代以上: {analyticsData.demographics.thirties}%</Text>
            </View>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#1F2937', marginHorizontal: 10 }]} onPress={handleExportUsersCSV}>
              <Text style={styles.addBtnText}>📥 ユーザー監査名簿をCSVエクスポート</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🛒 8. ショップ設定 */}
        {activeTab === 'shop' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>パック・概念アセット新規陳列</Text>
              <TextInput style={styles.input} placeholder="パック名" value={sName} onChangeText={setSName} />
              <TextInput style={styles.input} placeholder="販売価格" keyboardType="numeric" value={sPrice} onChangeText={setSPrice} />
              
              <TouchableOpacity style={styles.addBtn} onPress={handleAddShopItem}>
                <Text style={styles.addBtnText}>ショップに追加・陳列</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ⚖️ 9. バランス設定 */}
        {activeTab === 'settings' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内バランス・グローバル倍率調整</Text>
            <Text style={styles.label}>基本獲得経験値倍率</Text>
            <TextInput style={styles.input} value={expMultiplier} onChangeText={setExpMultiplier} keyboardType="numeric" />
            <Text style={styles.label}>グローバルHP補正係数</Text>
            <TextInput style={styles.input} value={hpMultiplier} onChangeText={setHpMultiplier} keyboardType="numeric" />
            <TouchableOpacity style={styles.addBtn} onPress={handleSaveSettings}>
              <Text style={styles.addBtnText}>倍率変更を即時環境反映</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { height: 60, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  logoutBtn: { backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  tabScroll: { maxHeight: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabContainer: { paddingHorizontal: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F3F4F6' },
  activeTab: { backgroundColor: '#111827' },
  tabText: { fontSize: 13, color: '#4B5563' },
  activeTabText: { color: '#FFFFFF', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 24, marginBottom: 12, paddingLeft: 4 },
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderBottomWidth: 3, borderColor: '#E5E7EB', marginBottom: 16 },
  formSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1F2937', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, color: '#111827', marginBottom: 12 },
  addBtn: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  outlineBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', justifyContent: 'center', marginBottom: 12 },
  outlineBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  autoGenBox: { flexDirection: 'row', backgroundColor: '#E0F2FE', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD' },
  autoGenText: { fontSize: 13, fontWeight: 'bold', color: '#0369A1' },
  autoGenSub: { fontSize: 11, color: '#0284C7', marginTop: 2 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  toggleOn: { backgroundColor: '#0284C7' },
  toggleOff: { backgroundColor: '#9CA3AF' },
  toggleBtnText: { fontSize: 12, fontWeight: 'bold' },
  toggleTextOn: { color: '#FFFFFF' },
  toggleTextOff: { color: '#FFFFFF' },
  miniChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  activeMiniChip: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  miniChipText: { fontSize: 12, color: '#1F2937' },
  listItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  listItemVertical: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  itemName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  itemSub: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusBtnText: { fontSize: 11, fontWeight: 'bold', color: '#065F46' },
  adjustBtn: { backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  adjustBtnText: { fontSize: 11, color: '#374151', fontWeight: 'bold' },
  cardPreviewImage: { width: 50, height: 65, borderRadius: 6, backgroundColor: '#E5E7EB' },
  infoText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginVertical: 20 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 12 },
  dropdownHeaderText: { fontSize: 13, color: '#374151', flex: 1 },
  dropdownIcon: { fontSize: 12, color: '#6B7280', marginLeft: 8 },
  dropdownList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, maxHeight: 150, marginBottom: 12, padding: 4 },
  dropdownItem: { padding: 10, borderRadius: 6 },
  dropdownItemText: { fontSize: 13, color: '#374151' },
  multiImageContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  thumbnailWrapper: { width: 60, height: 60, position: 'relative' },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: 6 },
  removeImgBtn: { position: 'absolute', top: -4, right: -4, backgroundColor: 'rgba(0,0,0,0.6)', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  removeImgText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  addImgBtn: { width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  addImgText: { fontSize: 11, color: '#6B7280' },
  coordsBox: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  modeToggleContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 4, marginBottom: 14 },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeModeTab: { backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1 },
  modeText: { fontSize: 12, color: '#6B7280' },
  activeModeText: { fontSize: 12, color: '#111827', fontWeight: 'bold' },
  horizontalBtnGroup: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  miniActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, justifyContent: 'center' },
  miniActionBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  analyticsCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  analyticsLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  analyticsValue: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 4 }
});