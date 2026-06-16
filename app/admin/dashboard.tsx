import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import { BarChart3, Users, Store, ShieldAlert, Bell, Upload, Image as ImageIcon, Database, Layers, Download, HelpCircle } from 'lucide-react-native';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);

  // ==================== 1. 分析用データ ====================
  const [analyticsData, setAnalyticsData] = useState<any>({
    dau: 0, mau: 0, total_posts: 0, total_battles: 0,
    demographics: { males: 0, females: 0, teens: 0, twenties: 0, thirties: 0, overForties: 0, locations: {} }
  });

  // ==================== 2. ユーザー管理 ====================
  const [users, setUsers] = useState<any[]>([]);

  // ==================== 3. UGCカード管理 ====================
  const [ugcCards, setUgcCards] = useState<any[]>([]);

  // ==================== 4. 特権MINT ＆ ショップ統合 ====================
  const [mintDest, setMintDest] = useState<'direct' | 'shop'>('direct');
  const [shopItemType, setShopItemType] = useState<'single' | 'pack'>('single');
  const [cardGenMode, setCardGenMode] = useState<'manual' | 'ai'>('manual');
  const [cName, setCName] = useState('');
  const [cImage, setCImage] = useState('');
  const [cPackageImage, setCPackageImage] = useState('');
  const [cRarity, setCRarity] = useState('SR');
  const [cAttr, setCAttr] = useState('火');
  const [cHp, setCHp] = useState('');
  const [cAtk, setCAtk] = useState('');
  const [cDef, setCDef] = useState('');
  const [cSpd, setCSpd] = useState('');
  const [cSkillName, setCSkillName] = useState('');
  const [cAiPrompt, setCAiPrompt] = useState('');
  const [cStock, setCStock] = useState('100');
  const [cPrice, setCPrice] = useState('500');
  const [packCardCount, setPackCardCount] = useState('5');
  const [packDesc, setPackDesc] = useState('ランダムなカードが排出されるパックです。');

  // ==================== 5. ボス / マップ配置 ====================
  const [bosses, setBosses] = useState<any[]>([]);
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('1500');
  const [bAtk, setBAtk] = useState('100');
  const [bDef, setBDef] = useState('50');
  const [bLat, setBLat] = useState('35.6983');
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('1000');
  const [bSponsorName, setBSponsorName] = useState('');
  const [bElement, setBElement] = useState('闇');
  const [bossImageMode, setBossImageMode] = useState<'upload' | 'ai'>('upload');
  const [bossImageUrl, setBossImageUrl] = useState('');
  const [bossAiPrompt, setBossAiPrompt] = useState('');

  const [dropCardMode, setDropCardMode] = useState<'upload' | 'ai'>('ai');
  const [dropCardUrl, setDropCardUrl] = useState('');
  const [dropCardName, setDropCardName] = useState('');
  const [dropCardPrompt, setDropCardPrompt] = useState('');
  const [dropCardRarity, setDropCardRarity] = useState('UR');
  const [dropCardAttr, setDropCardAttr] = useState('闇');

  // ==================== 5-新規. ランダムボス設定 ====================
  const [randomBossEnabled, setRandomBossEnabled] = useState(false);
  const [randomBossInterval, setRandomBossInterval] = useState('1h');
  const [baseLat, setBaseLat] = useState('35.6983');
  const [baseLng, setBaseLng] = useState('139.4130');

  // ==================== 6. お知らせ配信 ====================
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [targetGender, setTargetGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [targetAge, setTargetAge] = useState<'ALL' | 'TEENS' | 'TWENTIES' | 'THIRTIES'>('ALL');
  const [targetLocation, setTargetLocation] = useState('');

  // ==================== 7. マスタ拡張用 ====================
  const [elementsList, setElementsList] = useState<string[]>([]);
  const [raritiesList, setRaritiesList] = useState<string[]>([]);
  const [newElement, setNewElement] = useState('');
  const [newRarity, setNewRarity] = useState('');

  // ==================== 💡 8. WebAR動的配信＆クライアント別オブジェクト管理 ====================
  const [arClientType, setArClientType] = useState<'global' | 'client_specific'>('global');
  const [arTargetClientId, setArTargetClientId] = useState(''); // promo_linksテーブルの対象UUID
  const [arDisplayMode, setArDisplayMode] = useState<'3d_model' | 'card_frame' | 'hybrid'>('card_frame');
  const [arAssetCustomUrl, setArAssetCustomUrl] = useState(''); // .glb等アセットのURL
  const [arMarkerCustomUrl, setArMarkerCustomUrl] = useState(''); // 💡 新規: マーカーファイルのURL
  const [arBtnPlacement, setArBtnPlacement] = useState<'bottom_center' | 'top_right' | 'hidden'>('bottom_center');
  const [arActionText, setArActionText] = useState('アプリにデータを同期');

  // 初回データ読み込み
  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
      fetchUsers();
      fetchUgcCards();
      fetchBosses();
      fetchMasterData();
      fetchRandomBossConfig();
      fetchArWebSettings();
    }, [])
  );

  // ==========================================
  // データフェッチ関数
  // ==========================================
  const fetchArWebSettings = async () => {
    try {
      const { data } = await supabase.from('system_config').select('*').eq('id', 'webar_dynamic_settings').single();
      if (data && data.config_data) {
        const c = data.config_data;
        if (c.arClientType) setArClientType(c.arClientType);
        if (c.arTargetClientId) setArTargetClientId(c.arTargetClientId);
        if (c.arDisplayMode) setArDisplayMode(c.arDisplayMode);
        if (c.arAssetCustomUrl) setArAssetCustomUrl(c.arAssetCustomUrl);
        if (c.arBtnPlacement) setArBtnPlacement(c.arBtnPlacement);
        if (c.arActionText) setArActionText(c.arActionText);
      }
    } catch (e) { console.log('AR設定フェッチ非活性', e); }
  };

  const fetchRandomBossConfig = async () => {
    try {
      const { data } = await supabase.from('system_config').select('*').eq('id', 'random_boss_settings').single();
      if (data && data.config_data) {
        setRandomBossEnabled(data.config_data.enabled ?? false);
        setRandomBossInterval(data.config_data.interval ?? '1h');
        if (data.config_data.base_lat) setBaseLat(data.config_data.base_lat.toString());
        if (data.config_data.base_lng) setBaseLng(data.config_data.base_lng.toString());
      }
    } catch (e) { console.log(e); }
  };

  const fetchAnalytics = async () => {
    try {
      const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
      const { data: profiles } = await supabase.from('profiles').select('*');
      let dau = 0; let mau = 0; let totalBattles = 0; const now = new Date();
      let males = 0; let females = 0;
      let teens = 0; let twenties = 0; let thirties = 0; let overForties = 0;
      let locations: Record<string, number> = {};

      profiles?.forEach((p: any) => {
        if (p.last_sign_in_at) {
          const lastSignIn = new Date(p.last_sign_in_at);
          const diffDays = (now.getTime() - lastSignIn.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1) dau++;
          if (diffDays <= 30) mau++;
        }
        totalBattles += (p.total_wins || 0) + (p.boss_defeats || 0);

        if (p.gender === 'male' || p.gender === '男性') males++;
        else if (p.gender === 'female' || p.gender === '女性') females++;

        const age = parseInt(p.age) || 0;
        if (age > 0 && age < 20) teens++;
        else if (age >= 20 && age < 30) twenties++;
        else if (age >= 30 && age < 40) thirties++;
        else if (age >= 40) overForties++;

        if (p.location) {
          locations[p.location] = (locations[p.location] || 0) + 1;
        }
      });

      setAnalyticsData({
        dau, mau, total_posts: totalCards || 0, total_battles: totalBattles,
        demographics: { males, females, teens, twenties, thirties, overForties, locations }
      });
    } catch (e) { console.log(e); }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setUsers(data);
  };

  const fetchUgcCards = async () => {
    try {
      let { data, error } = await supabase
        .from('cards')
        .select(`id, card_name, image_url, is_hidden, created_at, player_id, profiles(player_name)`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        const fallback = await supabase
          .from('cards')
          .select('id, card_name, image_url, is_hidden, created_at, player_id')
          .order('created_at', { ascending: false })
          .limit(50);
        data = fallback.data;
      }
      if (data) setUgcCards(data);
    } catch (err) {
      console.log('UGC 取得失敗:', err);
    }
  };

  const fetchBosses = async () => {
    const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setBosses(data);
  };

  const fetchMasterData = async () => {
    const { data } = await supabase.from('system_config').select('*').in('id', ['elements', 'rarities']);
    let els = ['火', '水', '雷', '風', '木', '土', '光', '闇'];
    let rars = ['N', 'R', 'SR', 'SSR', 'UR', 'DUST'];
    data?.forEach(d => {
      if (d.id === 'elements' && d.config_data.list) els = d.config_data.list;
      if (d.id === 'rarities' && d.config_data.list) rars = d.config_data.list;
    });
    setElementsList(els);
    setRaritiesList(rars);
  };

  // ==========================================
  // 画像アップロード・AI処理ヘルパー
  // ==========================================
  const pickImage = async (setter: any) => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const uploadBase64Image = async (base64String: string, pathPrefix: string) => {
    if (!base64String.startsWith('data:image')) return base64String;
    const fileName = `${pathPrefix}/${Date.now()}.jpg`;
    const base64Str = base64String.split(',')[1] || base64String;
    await supabase.storage.from('card_images').upload(fileName, decode(base64Str), { contentType: 'image/jpeg' });
    return supabase.storage.from('card_images').getPublicUrl(fileName).data.publicUrl;
  };

  // ==========================================
  // 💡 3Dオブジェクト(.glb)のアップロード
  // ==========================================
  const pickWebFile = async (accept: string) => {
    return await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.type = 'file';
      input.accept = accept;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.opacity = '0';
      input.style.width = '1px';
      input.style.height = '1px';

      input.onchange = () => {
        if (!resolved) {
          resolved = true;
          resolve(input.files?.[0] ?? null);
        }
        cleanup();
      };
      input.oncancel = cleanup;
      input.onblur = () => {
        if (!input.files?.length) {
          cleanup();
        }
      };

      document.body.appendChild(input);
      input.click();
    });
  };

  const handleUploadArAsset = async (promoId: string) => {
    if (!promoId || promoId === 'ALL') {
      Alert.alert('エラー', '対象のプロモID（クライアントUUID）を入力してください。');
      return;
    }
    try {
      let asset: any;
      if (Platform.OS === 'web') {
        const file = await pickWebFile('.glb,image/*');
        if (!file) return;
        asset = file;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/octet-stream', 'model/gltf-binary', 'image/*'],
          copyToCacheDirectory: true
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        asset = result.assets[0];
      }
      
      setLoading(true);

      let arrayBuffer;
      if (Platform.OS === 'web') {
        arrayBuffer = await asset.arrayBuffer();
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        arrayBuffer = decode(base64);
      }

      const fileName = `${promoId}/${Date.now()}_asset_${asset.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ar_assets')
        .upload(fileName, arrayBuffer, { contentType: asset.type || asset.mimeType || 'application/octet-stream', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('ar_assets').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('promo_links').update({ ar_asset_url: publicUrl, ar_display_mode: arDisplayMode }).eq('id', promoId);
      if (dbError) throw dbError;

      setArAssetCustomUrl(publicUrl);
      Alert.alert('アップロード成功', `3Dモデル/画像を紐付けました！`);
    } catch (e: any) {
      Alert.alert('アップロード失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 💡 ターゲットマーカー（.mind / 画像）のアップロード
  // ==========================================
  const handleUploadArMarker = async (promoId: string) => {
    if (!promoId || promoId === 'ALL') {
      Alert.alert('エラー', '対象のプロモID（クライアントUUID）を入力してください。');
      return;
    }
    try {
      let asset: any;
      if (Platform.OS === 'web') {
        const file = await pickWebFile('.mind,image/*');
        if (!file) return;
        asset = file;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/octet-stream', 'image/*'], // .mindファイルや画像を想定
          copyToCacheDirectory: true
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        asset = result.assets[0];
      }
      
      setLoading(true);

      let arrayBuffer;
      if (Platform.OS === 'web') {
        arrayBuffer = await asset.arrayBuffer();
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        arrayBuffer = decode(base64);
      }

      const fileName = `${promoId}/${Date.now()}_marker_${asset.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ar_markers')
        .upload(fileName, arrayBuffer, { contentType: asset.type || asset.mimeType || 'application/octet-stream', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('ar_markers').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('promo_links').update({ ar_marker_url: publicUrl }).eq('id', promoId);
      if (dbError) throw dbError;

      setArMarkerCustomUrl(publicUrl);
      Alert.alert('アップロード成功', `トリガーマーカー「${asset.name}」を紐付けました！`);
    } catch (e: any) {
      Alert.alert('アップロード失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 管理アクション関数
  // ==========================================
  const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
    const action = currentBanStatus ? 'BAN解除' : 'BAN';
    Alert.alert(`${action}の確認`, `本当にこのユーザーを${action}しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '実行', style: currentBanStatus ? 'default' : 'destructive', onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('profiles').update({ is_banned: !currentBanStatus }).eq('id', userId);
            if (error) throw error;
            Alert.alert('成功', `ユーザーを${action}しました。`);
            fetchUsers();
          } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
        }
      }
    ]);
  };

  const handleToggleHideCard = async (cardId: string, currentHiddenStatus: boolean) => {
    const action = currentHiddenStatus ? '表示' : '非表示';
    Alert.alert(`${action}の確認`, `このカードを${action}状態にしますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '実行', style: currentHiddenStatus ? 'default' : 'destructive', onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('cards').update({ is_hidden: !currentHiddenStatus }).eq('id', cardId);
            if (error) throw error;
            Alert.alert('成功', `カードを${action}にしました。`);
            fetchUgcCards();
          } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
        }
      }
    ]);
  };

  const handleMintAction = async () => {
    setLoading(true);
    try {
      let finalCardImageUrl = cImage;
      let finalPackageUrl = cPackageImage;
      const cardDataToInsert: any = {
        card_name: cName || '名もなき特権カード', element: cAttr || '火', rarity: cRarity || 'SR',
        status_hp: parseInt(cHp) || 100, status_atk: parseInt(cAtk) || 50, status_def: parseInt(cDef) || 50, status_spd: parseInt(cSpd) || 50,
        status_total: (parseInt(cHp)||100)+(parseInt(cAtk)||50)+(parseInt(cDef)||50)+(parseInt(cSpd)||50),
        skill_name: cSkillName || '通常攻撃',
      };

      if (shopItemType === 'single' && cardGenMode === 'ai' && cAiPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: cAiPrompt } });
        finalCardImageUrl = data?.imageUrl || 'https://via.placeholder.com/300x400.png?text=AI+Generated';
      } else if (shopItemType === 'single' && cImage) {
        finalCardImageUrl = await uploadBase64Image(cImage, 'mint');
      }

      if (mintDest === 'shop') {
        if (cPackageImage) finalPackageUrl = await uploadBase64Image(cPackageImage, 'packages');
        const itemStats = shopItemType === 'pack' ? { item_type: 'pack', count: parseInt(packCardCount) || 5 } : { item_type: 'single', ...cardDataToInsert };

        const { error: shopError } = await supabase.from('shop_items').insert([{
          name: cName,
          description: shopItemType === 'pack' ? packDesc : `属性: ${cAttr} / レアリティ: ${cRarity}`,
          price: parseInt(cPrice) || 500, stock: parseInt(cStock) || 100,
          package_image_url: finalPackageUrl || finalCardImageUrl,
          card_image_url: shopItemType === 'single' ? finalCardImageUrl : null,
          stats: itemStats
        }]);
        if (shopError) throw shopError;
        Alert.alert('成功', `ショップに${shopItemType === 'pack' ? 'パック商品' : '単体カード'}を出品しました！`);
      } else {
        const { error: fixError } = await supabase.from('fixed_cards').insert([{
          card_name: cName, trigger_type: 'admin_mint', image_url: finalCardImageUrl, stats: cardDataToInsert
        }]);
        if (fixError) throw fixError;
        Alert.alert('成功', '特権カードを生成・登録しました！');
      }
      setCName(''); setCImage(''); setCPackageImage(''); setCAiPrompt(''); setPackDesc('');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handleCreateBoss = async () => {
    setLoading(true);
    try {
      let finalBossImageUrl = bossImageUrl;
      let finalDropCardUrl = dropCardUrl;
      if (bossImageMode === 'ai' && bossAiPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: bossAiPrompt } });
        if (data?.imageUrl) finalBossImageUrl = data.imageUrl;
      } else if (bossImageUrl) {
        finalBossImageUrl = await uploadBase64Image(bossImageUrl, 'bosses');
      }

      if (dropCardMode === 'ai' && dropCardPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: dropCardPrompt } });
        if (data?.imageUrl) finalDropCardUrl = data.imageUrl;
      } else if (dropCardUrl) {
        finalDropCardUrl = await uploadBase64Image(dropCardUrl, 'boss_drops');
      }

      const { data: campData, error: campError } = await supabase.from('campaigns').insert([{
        title: `ボス出現: ${bName}`, sponsor_name: bSponsorName || '運営',
        target_lat: parseFloat(bLat), target_lng: parseFloat(bLng), radius_meters: parseInt(bRadius), is_active: true
      }]).select().single();
      if (campError) throw campError;

      const { error: dropError } = await supabase.from('fixed_cards').insert([{
        card_name: dropCardName || `【撃破報酬】${bName}`, trigger_type: 'boss_drop', image_url: finalDropCardUrl, sponsor_id: campData.id,
        stats: { element: dropCardAttr, rarity: dropCardRarity, hp: 100, atk: 50, def: 50, spd: 50 }
      }]);
      if (dropError) throw dropError;

      const { error: bossError } = await supabase.from('bosses').insert([{
        name: bName, hp: parseInt(bHp) || 1500, atk: parseInt(bAtk) || 100, def: parseInt(bDef) || 50,
        element: bElement, image_url: finalBossImageUrl, trigger_campaign_id: campData.id
      }]);
      if (bossError) throw bossError;

      Alert.alert('成功', 'ボスとドロップカードをマップに配置しました！');
      fetchBosses();
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handleUpdateRandomBossConfig = async () => {
    setLoading(true);
    try {
      const config_data = {
        enabled: randomBossEnabled,
        interval: randomBossInterval,
        base_lat: parseFloat(baseLat) || 35.6983,
        base_lng: parseFloat(baseLng) || 139.4130
      };
      const { error } = await supabase.from('system_config').upsert({ id: 'random_boss_settings', config_data });
      if (error) throw error;
      Alert.alert('成功', 'ランダムボスの出現パラメータを更新しました。');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const triggerInstantRandomBoss = async () => {
    setLoading(true);
    try {
      const prefix = ['次元の', '彷徨える', '極大の', 'アビス・', 'ヴォイド・', '災厄の', '覚醒せし'];
      const suffix = ['ゴーレム', 'ベヒモス', 'フェニックス', 'リヴァイアsan', 'ナイトメア', '機神龍', 'タイタン'];
      const randomName = prefix[Math.floor(Math.random() * prefix.length)] + suffix[Math.floor(Math.random() * suffix.length)];
      
      const randomElement = elementsList[Math.floor(Math.random() * elementsList.length)] || '闇';
      const randomRarity = ['SR', 'SSR', 'UR'][Math.floor(Math.random() * 3)];
      
      const randomHp = Math.floor(Math.random() * 2000) + 1000;
      const randomAtk = Math.floor(Math.random() * 150) + 50;
      const randomDrop = Math.floor(Math.random() * 100) + 30;

      const latOffset = (Math.random() - 0.5) * 0.04;
      const lngOffset = (Math.random() - 0.5) * 0.04;
      const finalLat = (parseFloat(baseLat) || 35.6983) + latOffset;
      const finalLng = (parseFloat(baseLng) || 139.4130) + lngOffset;

      const generatedBossPrompt = `A fantasy trading card game illustration of a giant monster creature, name is ${randomName}, hyper detailed, masterwork elemental of ${randomElement}, cyberpunk tech mixed with dark magic grid style, card art template asset`;
      const generatedDropPrompt = `A shiny cosmic artifact crystal weapon glowing inside a container, rewards token, ${randomRarity} trading card high rarity frame game asset`;

      let finalBossUrl = 'https://via.placeholder.com/300x400.png?text=AI+Boss';
      let finalDropUrl = 'https://via.placeholder.com/300x400.png?text=AI+Drop';

      try {
        const bossRes = await supabase.functions.invoke('generate-card-image', { body: { prompt: generatedBossPrompt } });
        if (bossRes.data?.imageUrl) finalBossUrl = bossRes.data.imageUrl;
        
        const dropRes = await supabase.functions.invoke('generate-card-image', { body: { prompt: generatedDropPrompt } });
        if (dropRes.data?.imageUrl) finalDropUrl = dropRes.data.imageUrl;
      } catch (aiErr) {
        console.log('AI自動散布タイムアウト、プレースホルダー適用。', aiErr);
      }

      const { data: campData, error: campError } = await supabase.from('campaigns').insert([{
        title: `【突発ランダム出現】${randomName}`, sponsor_name: 'システム自動生成',
        target_lat: finalLat, target_lng: finalLng, radius_meters: 1500, is_active: true
      }]).select().single();
      if (campError) throw campError;

      const { error: dropError } = await supabase.from('fixed_cards').insert([{
        card_name: `【戦果】${randomName}の結晶核`, trigger_type: 'boss_drop', image_url: finalDropUrl, sponsor_id: campData.id,
        stats: { element: randomElement, rarity: randomRarity, hp: 100, atk: 60, def: 40, spd: 80 }
      }]);
      if (dropError) throw dropError;

      const { error: bossError } = await supabase.from('bosses').insert([{
        name: randomName, hp: randomHp, atk: randomAtk, def: randomDrop,
        element: randomElement, image_url: finalBossUrl, trigger_campaign_id: campData.id
      }]);
      if (bossError) throw bossError;

      Alert.alert('自動生成成功', `マップ上に「${randomName}」を完全自動降臨させました！`);
      fetchBosses();
    } catch (err: any) {
      Alert.alert('エラー', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!annTitle || !annBody) return Alert.alert('エラー', 'タイトルと本文を入力してください');
    setLoading(true);
    try {
      const targetCriteria = { gender: targetGender, age: targetAge, location: targetLocation };
      const { error } = await supabase.from('messages').insert([{
        sender_id: 'SYSTEM',
        text: `📢【運営よりお知らせ】\n${annTitle}\n\n${annBody}\n\n(※対象: ${targetGender}/${targetAge}${targetLocation ? '/' + targetLocation : ''})`,
        metadata: targetCriteria
      }]);
      if (error) console.warn(error);
      Alert.alert('配信完了', '条件に合致するユーザーにお知らせを配信しました！');
      setAnnTitle(''); setAnnBody(''); setTargetLocation('');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handleAddMaster = async (type: 'element' | 'rarity') => {
    setLoading(true);
    try {
      if (type === 'element') {
        if (!newElement) return;
        const updated = [...elementsList, newElement];
        await supabase.from('system_config').upsert({ id: 'elements', config_data: { list: updated } });
        setElementsList(updated); setNewElement('');
        Alert.alert('追加完了', `「${newElement}」を属性に追加しました！`);
      } else {
        if (!newRarity) return;
        const updated = [...raritiesList, newRarity];
        await supabase.from('system_config').upsert({ id: 'rarities', config_data: { list: updated } });
        setRaritiesList(updated); setNewRarity('');
        Alert.alert('追加完了', `「${newRarity}」をレアリティに追加しました！`);
      }
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  // ==========================================
  // 💡 WebARダイナミック制御の更新処理
  // ==========================================
  const handleUpdateArConfig = async () => {
    setLoading(true);
    try {
      const config_data = {
        arClientType,
        arTargetClientId: arClientType === 'client_specific' ? arTargetClientId : 'ALL',
        arDisplayMode,
        arAssetCustomUrl,
        arBtnPlacement,
        arActionText
      };

      const { error } = await supabase.from('system_config').upsert({
        id: 'webar_dynamic_settings',
        config_data
      });

      if (error) throw error;
      Alert.alert('同期成功', 'WebARパラメータを更新しました。ブラウザ側にリアルタイム同期されます。');
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 💡 分析データをCSVでエクスポート
  // ==========================================
  const exportAnalyticsCSV = async () => {
    try {
      const csvContent = `分析レポート\nDAU,${analyticsData.dau}\nMAU,${analyticsData.mau}\n総投稿数,${analyticsData.total_posts}\n総バトル数,${analyticsData.total_battles}`;
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${Date.now()}.csv`;
        a.click();
      } else {
        const fileUri = `${FileSystem.documentDirectory}analytics_${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        await Sharing.shareAsync(fileUri);
      }
      Alert.alert('成功', 'CSVファイルをエクスポートしました！');
    } catch (e: any) {
      Alert.alert('エラー', `エクスポート失敗: ${e.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMMAND CENTER</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'analytics' && styles.activeTabBtn]} onPress={() => setActiveTab('analytics')}>
          <BarChart3 color={activeTab === 'analytics' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>分析</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'users' && styles.activeTabBtn]} onPress={() => setActiveTab('users')}>
          <Users color={activeTab === 'users' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>ユーザー</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'ugc' && styles.activeTabBtn]} onPress={() => setActiveTab('ugc')}>
          <Layers color={activeTab === 'ugc' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'ugc' && styles.activeTabText]}>UGC管理</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'mint' && styles.activeTabBtn]} onPress={() => setActiveTab('mint')}>
          <Store color={activeTab === 'mint' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'mint' && styles.activeTabText]}>生成/ショップ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'bosses' && styles.activeTabBtn]} onPress={() => setActiveTab('bosses')}>
          <ShieldAlert color={activeTab === 'bosses' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'bosses' && styles.activeTabText]}>ボス/マップ</Text>
        </TouchableOpacity>
        
        {/* 動的制御＆ファイルアップローダー付WebARタブ */}
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'ar' && styles.activeTabBtn]} onPress={() => setActiveTab('ar')}>
          <Layers color={activeTab === 'ar' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'ar' && styles.activeTabText]}>WebAR制御</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, activeTab === 'announcements' && styles.activeTabBtn]} onPress={() => setActiveTab('announcements')}>
          <Bell color={activeTab === 'announcements' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>お知らせ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'master' && styles.activeTabBtn]} onPress={() => setActiveTab('master')}>
          <Database color={activeTab === 'master' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'master' && styles.activeTabText]}>マスタ拡張</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content}>
        {/* ===================== 1. 分析 ===================== */}
        {activeTab === 'analytics' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>リアルタイム統計</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><Text style={styles.statLabel}>DAU (日間)</Text><Text style={styles.statValue}>{analyticsData.dau}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>MAU (月間)</Text><Text style={styles.statValue}>{analyticsData.mau}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>累計発行カード</Text><Text style={styles.statValue}>{analyticsData.total_posts}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>累計バトル数</Text><Text style={styles.statValue}>{analyticsData.total_battles}</Text></View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>ユーザー属性 (デモグラフィック)</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>男女比</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>男性: {analyticsData.demographics.males}人</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>女性: {analyticsData.demographics.females}人</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>年代分布</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>10代以下: {analyticsData.demographics.teens}人</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>20代: {analyticsData.demographics.twenties}人</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>30代: {analyticsData.demographics.thirties}人</Text>
                <Text style={{fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '700'}}>40代以上: {analyticsData.demographics.overForties}人</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, {flexDirection: 'row', justifyContent: 'center'}]} onPress={exportAnalyticsCSV}>
              <Download color="#FFF" size={20} style={{marginRight: 8}} />
              <Text style={styles.primaryBtnText}>全データをCSVでエクスポート</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== 2. ユーザー ===================== */}
        {activeTab === 'users' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>登録ユーザー一覧</Text>
            {users.map(u => (
              <View key={u.id} style={styles.listItemRow}>
                <View style={{flex: 1}}>
                  <View style={styles.row}>
                    <Text style={styles.listItemTitle}>{u.player_name || '名称未設定'} (Lv: {u.player_level || 1})</Text>
                    {u.is_banned && <Text style={styles.bannedBadge}>BANNED</Text>}
                  </View>
                  <Text style={styles.listItemSub}>勝利: {u.total_wins || 0} | 討伐: {u.boss_defeats || 0}</Text>
                  <Text style={styles.listItemSub}>ID: {u.id.substring(0, 10)}...</Text>
                </View>
                <TouchableOpacity style={[styles.actionBtn, u.is_banned ? styles.unbanBtn : styles.banBtn]} onPress={() => handleToggleBan(u.id, u.is_banned)} disabled={loading}>
                  <Text style={styles.actionBtnText}>{u.is_banned ? '解除' : 'BAN'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ===================== 3. UGC管理 ===================== */}
        {activeTab === 'ugc' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ユーザー生成カード (UGC) 管理</Text>
            <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>不適切なカードを非表示にできます。</Text>
            {ugcCards.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#94A3B8', marginVertical: 20}}>UGCカードがありません</Text>
            ) : (
              ugcCards.map(c => (
                <View key={c.id} style={styles.ugcItem}>
                  {c.image_url ? (
                    <Image source={{ uri: c.image_url }} style={styles.ugcThumb} />
                  ) : (
                    <View style={[styles.ugcThumb, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                      <ImageIcon color="#94A3B8" size={24} />
                    </View>
                  )}
                  <View style={{flex: 1, marginLeft: 12}}>
                    <View style={styles.row}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>{c.card_name || '名称不明'}</Text>
                      {c.is_hidden && <Text style={styles.bannedBadge}>非表示</Text>}
                    </View>
                    <Text style={styles.listItemSub}>作成者: {c.profiles?.player_name || c.player_id?.substring(0,8) || '不明'}</Text>
                    <Text style={styles.listItemSub}>作成日: {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionBtn, c.is_hidden ? styles.unbanBtn : styles.hideBtn]} onPress={() => handleToggleHideCard(c.id, c.is_hidden)} disabled={loading}>
                    <Text style={styles.actionBtnText}>{c.is_hidden ? '表示' : '非表示'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===================== 4. MINT & SHOP ===================== */}
        {activeTab === 'mint' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>カード生成 ＆ ショップ出品設定</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, mintDest === 'direct' && styles.activeRadio]} onPress={() => {setMintDest('direct'); setShopItemType('single');}}>
                <Text style={[styles.radioText, mintDest === 'direct' && styles.activeRadioText]}>特権MINT(直接配布)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, mintDest === 'shop' && styles.activeRadio]} onPress={() => setMintDest('shop')}>
                <Text style={[styles.radioText, mintDest === 'shop' && styles.activeRadioText]}>ショップ商品として出品</Text>
              </TouchableOpacity>
            </View>

            {mintDest === 'shop' && (
              <>
                <Text style={styles.label}>出品タイプ</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity style={[styles.radioBtn, shopItemType === 'single' && styles.activeRadio]} onPress={() => setShopItemType('single')}>
                    <Text style={[styles.radioText, shopItemType === 'single' && styles.activeRadioText]}>単体カード</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, shopItemType === 'pack' && styles.activeRadio]} onPress={() => setShopItemType('pack')}>
                    <Text style={[styles.radioText, shopItemType === 'pack' && styles.activeRadioText]}>カードパック (複数枚)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.label}>{shopItemType === 'pack' ? 'パック名' : 'カード名'}</Text>
            <TextInput style={styles.input} value={cName} onChangeText={setCName} placeholder="名称を入力" />

            {shopItemType === 'single' && (
              <>
                <Text style={styles.label}>レアリティ / 属性</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={cRarity} onChangeText={setCRarity} placeholder="例: UR" />
                  <TextInput style={[styles.input, {flex: 1}]} value={cAttr} onChangeText={setCAttr} placeholder="例: 火" />
                </View>
                <Text style={styles.label}>ステータス (HP/ATK/DEF/SPD)</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cHp} onChangeText={setCHp} placeholder="HP" keyboardType="numeric" />
                  <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cAtk} onChangeText={setCAtk} placeholder="ATK" keyboardType="numeric" />
                  <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cDef} onChangeText={setCDef} placeholder="DEF" keyboardType="numeric" />
                  <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cSpd} onChangeText={setCSpd} placeholder="SPD" keyboardType="numeric" />
                </View>
                <Text style={styles.label}>スキル名</Text>
                <TextInput style={styles.input} value={cSkillName} onChangeText={setCSkillName} placeholder="必殺技の名前" />
              </>
            )}

            {shopItemType === 'pack' && (
              <>
                <Text style={styles.label}>パック封入枚数 / パック説明文</Text>
                <TextInput style={[styles.input, {marginBottom: 8}]} value={packCardCount} onChangeText={setPackCardCount} placeholder="例: 5" keyboardType="numeric" />
                <TextInput style={[styles.input, {height: 80}]} value={packDesc} onChangeText={setPackDesc} placeholder="例: SR以上1枚確定パック！" multiline />
              </>
            )}

            {mintDest === 'shop' && (
              <>
                <Text style={styles.label}>販売価格 / 在庫数</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={cPrice} onChangeText={setCPrice} placeholder="価格" keyboardType="numeric" />
                  <TextInput style={[styles.input, {flex: 1}]} value={cStock} onChangeText={setCStock} placeholder="在庫" keyboardType="numeric" />
                </View>
                <Text style={styles.label}>パッケージ画像 (ショップ陳列用)</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setCPackageImage)}>
                  {cPackageImage ? <Image source={{uri: cPackageImage}} style={styles.previewImg} /> : <ImageIcon color="#94A3B8" size={32} />}
                </TouchableOpacity>
              </>
            )}

            {shopItemType === 'single' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>カードデザイン (AI生成 or アップロード)</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity style={[styles.radioBtn, cardGenMode === 'manual' && styles.activeRadio]} onPress={() => setCardGenMode('manual')}>
                    <Text style={[styles.radioText, cardGenMode === 'manual' && styles.activeRadioText]}>アップロード</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, cardGenMode === 'ai' && styles.activeRadio]} onPress={() => setCardGenMode('ai')}>
                    <Text style={[styles.radioText, cardGenMode === 'ai' && styles.activeRadioText]}>AI生成</Text>
                  </TouchableOpacity>
                </View>

                {cardGenMode === 'manual' ? (
                  <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setCImage)}>
                    {cImage ? <Image source={{uri: cImage}} style={styles.previewImg} /> : <Upload color="#94A3B8" size={32} />}
                  </TouchableOpacity>
                ) : (
                  <TextInput style={[styles.input, {height: 80}]} value={cAiPrompt} onChangeText={setCAiPrompt} placeholder="AI画像生成プロンプトを入力..." multiline />
                )}
              </>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleMintAction} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{mintDest === 'shop' ? 'ショップに出品する' : '特権カードを配布する'}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== 5. BOSS & MAP ===================== */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎲 ランダムボス自動出現システム</Text>
              <Text style={{color:'#64748B', fontSize: 12, marginBottom: 12}}>
                有効にすると、指定した時間ごとにシステムがボスを完全ランダム自動ビルドしてマップへ配置します。
              </Text>

              <Text style={styles.label}>自動出現状態</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity style={[styles.radioBtn, randomBossEnabled && styles.activeRadio]} onPress={() => setRandomBossEnabled(true)}>
                  <Text style={[styles.radioText, randomBossEnabled && styles.activeRadioText]}>稼働 (ON)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, !randomBossEnabled && styles.activeRadio]} onPress={() => setRandomBossEnabled(false)}>
                  <Text style={[styles.radioText, !randomBossEnabled && styles.activeRadioText]}>停止 (OFF)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>出現サイクル頻度</Text>
              <View style={[styles.radioGroup, {flexWrap: 'wrap'}]}>
                {['1h', '3h', '6h', '12h', '24h'].map((interval) => (
                  <TouchableOpacity 
                    key={interval} 
                    style={[styles.radioBtn, randomBossInterval === interval && styles.activeRadio, {minWidth: '28%', marginBottom: 6}]} 
                    onPress={() => setRandomBossInterval(interval)}
                  >
                    <Text style={[styles.radioText, randomBossInterval === interval && styles.activeRadioText]}>
                      {interval === '1h' ? '1時間毎' : interval === '3h' ? '3時間毎' : interval === '6h' ? '6時間毎' : interval === '12h' ? '12時間毎' : '24時間毎'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>出現大元中心地 (緯度/経度)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={baseLat} onChangeText={setBaseLat} placeholder="中心緯度" keyboardType="numeric" />
                <TextInput style={[styles.input, {flex: 1}]} value={baseLng} onChangeText={setBaseLng} placeholder="中心経度" keyboardType="numeric" />
              </View>

              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#10B981', marginTop: 16}]} onPress={handleUpdateRandomBossConfig} disabled={loading}>
                <Text style={styles.primaryBtnText}>ランダムボス出現設定を保存</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              
              <Text style={styles.label}>【即時デバッグ】即座にランダムボスを1体発生</Text>
              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#8B5CF6', marginTop: 8}]} onPress={triggerInstantRandomBoss} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>完全自動生成ボスをマップへ即時降臨</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>手動・協賛ボス固定配置マニュアル設定</Text>

              <Text style={styles.label}>ボス名 / 協賛名</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={bName} onChangeText={setBName} placeholder="ボス名" />
                <TextInput style={[styles.input, {flex: 1}]} value={bSponsorName} onChangeText={setBSponsorName} placeholder="協賛名" />
              </View>

              <Text style={styles.label}>ボス属性 / ステータス(HP/ATK/DEF)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1.2, marginHorizontal: 2}]} value={bElement} onChangeText={setBElement} placeholder="属性" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bHp} onChangeText={setBHp} placeholder="HP" keyboardType="numeric" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bAtk} onChangeText={setBAtk} placeholder="ATK" keyboardType="numeric" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bDef} onChangeText={setBDef} placeholder="DEF" keyboardType="numeric" />
              </View>

              <Text style={styles.label}>出現地点 (緯度/経度) & 半径(m)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bLat} onChangeText={setBLat} placeholder="緯度" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bLng} onChangeText={setBLng} placeholder="経度" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bRadius} onChangeText={setBRadius} placeholder="半径" keyboardType="numeric" />
              </View>

              <Text style={styles.label}>ボスのデザイン</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity style={[styles.radioBtn, bossImageMode === 'upload' && styles.activeRadio]} onPress={() => setBossImageMode('upload')}>
                  <Text style={[styles.radioText, bossImageMode === 'upload' && styles.activeRadioText]}>アップロード</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, bossImageMode === 'ai' && styles.activeRadio]} onPress={() => setBossImageMode('ai')}>
                  <Text style={[styles.radioText, bossImageMode === 'ai' && styles.activeRadioText]}>AI生成</Text>
                </TouchableOpacity>
              </View>
              {bossImageMode === 'upload' ? (
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setBossImageUrl)}>
                  {bossImageUrl ? <Image source={{uri: bossImageUrl}} style={styles.previewImg} /> : <ImageIcon color="#94A3B8" size={32} />}
                </TouchableOpacity>
              ) : (
                <TextInput style={[styles.input, {height: 80}]} value={bossAiPrompt} onChangeText={setBossAiPrompt} placeholder="AI用プロンプト (巨大なドラゴン...)" multiline />
              )}

              <View style={styles.divider} />
              <Text style={styles.cardTitle}>討伐ドロップカードの設定</Text>
              
              <Text style={styles.label}>ドロップカード名 / レアリティ / 属性</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 2, marginHorizontal: 2}]} value={dropCardName} onChangeText={setDropCardName} placeholder="カード名" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={dropCardRarity} onChangeText={setDropCardRarity} placeholder="レア" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={dropCardAttr} onChangeText={setDropCardAttr} placeholder="属性" />
              </View>

              <Text style={styles.label}>ドロップカードデザイン</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity style={[styles.radioBtn, dropCardMode === 'upload' && styles.activeRadio]} onPress={() => setDropCardMode('upload')}>
                  <Text style={[styles.radioText, dropCardMode === 'upload' && styles.activeRadioText]}>アップロード</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, dropCardMode === 'ai' && styles.activeRadio]} onPress={() => setDropCardMode('ai')}>
                  <Text style={[styles.radioText, dropCardMode === 'ai' && styles.activeRadioText]}>AI生成</Text>
                </TouchableOpacity>
              </View>
              {dropCardMode === 'upload' ? (
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setDropCardUrl)}>
                  {dropCardUrl ? <Image source={{uri: dropCardUrl}} style={styles.previewImg} /> : <ImageIcon color="#94A3B8" size={32} />}
                </TouchableOpacity>
              ) : (
                <TextInput style={[styles.input, {height: 80}]} value={dropCardPrompt} onChangeText={setDropCardPrompt} placeholder="AI画像生成プロンプト" multiline />
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateBoss} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>ボスと報酬カードを配置</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===================== 💡 8. WebAR制御（クライアント別 オブジェクト＆マーカー直登録版） ===================== */}
        {activeTab === 'ar' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🌐 クライアント別 WebARオブジェクト管理パネル</Text>
            <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>
              特定の企業・キャンペーンURLごとに、空間へ配置する「3Dモデル」や「トリガーマーカー」を個別に設定・上書きします。
            </Text>

            <Text style={styles.label}>1. 配信制御範囲の指定</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, arClientType === 'global' && styles.activeRadio]} onPress={() => setArClientType('global')}>
                <Text style={[styles.radioText, arClientType === 'global' && styles.activeRadioText]}>全体一括配信</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, arClientType === 'client_specific' && styles.activeRadio]} onPress={() => setArClientType('client_specific')}>
                <Text style={[styles.radioText, arClientType === 'client_specific' && styles.activeRadioText]}>特定コード・企業指定</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>2. 対象のプロモURL（クライアントUUID）を入力</Text>
            <TextInput 
              style={styles.input} 
              value={arTargetClientId} 
              onChangeText={setArTargetClientId} 
              placeholder="promo_links テーブルの UUID を指定" 
              disabled={arClientType === 'global'}
              autoCapitalize="none"
            />

            {/* 💡 マーカーのアップロード UI を追加 */}
            <Text style={styles.label}>3. トリガーマーカーのアップロード（.mind または 画像）</Text>
            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#8B5CF6', marginTop: 8, marginBottom: 12 }]} 
              onPress={() => handleUploadArMarker(arTargetClientId)}
              disabled={loading || arClientType === 'global'}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>🎯 マーカーファイルを選択して紐付け</Text>}
            </TouchableOpacity>

            {arMarkerCustomUrl ? (
              <View style={{ backgroundColor: '#F5F3FF', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: '#6D28D9', fontWeight: 'bold' }}>🔗 反映中のマーカーURL:</Text>
                <Text style={{ fontSize: 11, color: '#4C1D95', marginTop: 4 }} numberOfLines={2}>{arMarkerCustomUrl}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>4. ARオブジェクトのアップロード（.glb 3Dモデル または 画像）</Text>
            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#10B981', marginTop: 8, marginBottom: 12 }]} 
              onPress={() => handleUploadArAsset(arTargetClientId)}
              disabled={loading || arClientType === 'global'}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>📁 表示オブジェクトを選択して紐付け</Text>}
            </TouchableOpacity>

            {arAssetCustomUrl ? (
              <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontWeight: 'bold' }}>🔗 反映中のカスタムオブジェクトURL:</Text>
                <Text style={{ fontSize: 11, color: '#2563EB', marginTop: 4 }} numberOfLines={2}>{arAssetCustomUrl}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.label}>5. レンダリング種別（表示形式）</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, arDisplayMode === 'card_frame' && styles.activeRadio]} onPress={() => setArDisplayMode('card_frame')}>
                <Text style={[styles.radioText, arDisplayMode === 'card_frame' && styles.activeRadioText]}>2Dカード枠浮遊</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, arDisplayMode === '3d_model' && styles.activeRadio]} onPress={() => setArDisplayMode('3d_model')}>
                <Text style={[styles.radioText, arDisplayMode === '3d_model' && styles.activeRadioText]}>等身大3Dモデル</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>6. アプリ誘導コンフィグ（画面上のボタン配置）</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, arBtnPlacement === 'bottom_center' && styles.activeRadio]} onPress={() => setArBtnPlacement('bottom_center')}>
                <Text style={[styles.radioText, arBtnPlacement === 'bottom_center' && styles.activeRadioText]}>下部中央固定</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, arBtnPlacement === 'hidden' && styles.activeRadio]} onPress={() => setArBtnPlacement('hidden')}>
                <Text style={[styles.radioText, arBtnPlacement === 'hidden' && styles.activeRadioText]}>非表示（OFF）</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>配置ボタンのアクション文言</Text>
            <TextInput 
              style={styles.input} 
              value={arActionText} 
              onChangeText={setArActionText} 
              placeholder="例: 限定カードをGET！" 
            />

            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#EC4899', marginTop: 30}]} onPress={handleUpdateArConfig} disabled={loading}>
              <Text style={styles.primaryBtnText}>この構成をWebAR全体に即時同期</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== 6. お知らせ ===================== */}
        {activeTab === 'announcements' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>お知らせ配信 (セグメント指定)</Text>
            
            <Text style={styles.label}>配信ターゲット: 性別</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, targetGender === 'ALL' && styles.activeRadio]} onPress={() => setTargetGender('ALL')}><Text style={[styles.radioText, targetGender === 'ALL' && styles.activeRadioText]}>全員</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, targetGender === 'MALE' && styles.activeRadio]} onPress={() => setTargetGender('MALE')}><Text style={[styles.radioText, targetGender === 'MALE' && styles.activeRadioText]}>男性のみ</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, targetGender === 'FEMALE' && styles.activeRadio]} onPress={() => setTargetGender('FEMALE')}><Text style={[styles.radioText, targetGender === 'FEMALE' && styles.activeRadioText]}>女性のみ</Text></TouchableOpacity>
            </View>

            <Text style={styles.label}>配信ターゲット: 年代</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, targetAge === 'ALL' && styles.activeRadio]} onPress={() => setTargetAge('ALL')}><Text style={[styles.radioText, targetAge === 'ALL' && styles.activeRadioText]}>全年代</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, targetAge === 'TEENS' && styles.activeRadio]} onPress={() => setTargetAge('TEENS')}><Text style={[styles.radioText, targetAge === 'TEENS' && styles.activeRadioText]}>10代</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, targetAge === 'TWENTIES' && styles.activeRadio]} onPress={() => setTargetAge('TWENTIES')}><Text style={[styles.radioText, targetAge === 'TWENTIES' && styles.activeRadioText]}>20代</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, targetAge === 'THIRTIES' && styles.activeRadio]} onPress={() => setTargetAge('THIRTIES')}><Text style={[styles.radioText, targetAge === 'THIRTIES' && styles.activeRadioText]}>30代以上</Text></TouchableOpacity>
            </View>

            <Text style={styles.label}>配信ターゲット: エリア (空白で全エリア)</Text>
            <TextInput style={[styles.input, {marginBottom: 16}]} value={targetLocation} onChangeText={setTargetLocation} placeholder="例: 東京" />

            <View style={styles.divider} />

            <Text style={styles.label}>お知らせタイトル</Text>
            <TextInput style={styles.input} value={annTitle} onChangeText={setAnnTitle} placeholder="例: 新しいボスが出現しました！" />
            <Text style={styles.label}>お知らせ本文</Text>
            <TextInput style={[styles.input, {height: 120}]} value={annBody} onChangeText={setAnnBody} placeholder="お知らせの詳細内容を記述..." multiline />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendAnnouncement} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>この条件で配信する</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== 7. マスタ拡張 ===================== */}
        {activeTab === 'master' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>データベース拡張 (属性 / レアリティ)</Text>
            <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>システムに新しい属性やレアリティを追加します。</Text>
            
            <Text style={styles.label}>現在の属性一覧</Text>
            <Text style={styles.listItemSub}>{elementsList.join(' / ')}</Text>
            <View style={[styles.row, {marginTop: 8, marginBottom: 24}]}>
              <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={newElement} onChangeText={setNewElement} placeholder="新しい属性を追加 (例: 毒)" />
              <TouchableOpacity style={[styles.primaryBtn, {marginTop: 0, paddingVertical: 14}]} onPress={() => handleAddMaster('element')}>
                <Text style={styles.primaryBtnText}>追加</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>現在のレアリティ一覧</Text>
            <Text style={styles.listItemSub}>{raritiesList.join(' / ')}</Text>
            <View style={[styles.row, {marginTop: 8}]}>
              <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={newRarity} onChangeText={setNewRarity} placeholder="新しいレアを追加 (例: EX)" />
              <TouchableOpacity style={[styles.primaryBtn, {marginTop: 0, paddingVertical: 14}]} onPress={() => handleAddMaster('rarity')}>
                <Text style={styles.primaryBtnText}>追加</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  tabScroll: { flexDirection: 'row', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 10, maxHeight: 60 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10 },
  activeTabBtn: { backgroundColor: '#0F172A' },
  tabText: { marginLeft: 6, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  statValue: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 12, color: '#0F172A', fontWeight: '500', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  radioGroup: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  radioBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  activeRadio: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  radioText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  activeRadioText: { color: '#2563EB' },
  imagePicker: { backgroundColor: '#F1F5F9', height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  primaryBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 },
  listItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  listItemSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  bannedBadge: { backgroundColor: '#FEE2E2', color: '#EF4444', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  banBtn: { backgroundColor: '#EF4444' },
  unbanBtn: { backgroundColor: '#10B981' },
  hideBtn: { backgroundColor: '#F59E0B' },
  ugcItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  ugcThumb: { width: 50, height: 70, borderRadius: 8, resizeMode: 'cover' },
});