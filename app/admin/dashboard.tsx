import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
// ★ react-native-maps をWeb環境でインポートするとホワイトアウト（クラッシュ）するため、動的requireに変更
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
  } catch (e) {
    console.log('react-native-maps load error', e);
  }
}

import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { decode } from 'base64-arraybuffer';
import { BarChart3, Users, Store, ShieldAlert, Bell, Upload, Image as ImageIcon, Database, Layers, Download, QrCode, MapPin, Gift, PlayCircle, Sparkles, Shield, Flag, ScrollText, Search, Trash2, Swords } from 'lucide-react-native';

export default function AdminDashboard() {
  const router = useRouter();

  // 💡 【重要】取得予定のWebAR用ドメイン（サブドメイン含む）のベースURLを定義
  const WEBAR_BASE_URL = 'https://snapcard.example.com';

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
  const [bStartAt, setBStartAt] = useState('');
  const [bEndAt, setBEndAt] = useState('');
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

  // ==================== 5-新規. ランダムボス設定 & 大量発生 ====================
  const [randomBossEnabled, setRandomBossEnabled] = useState(false);
  const [randomBossInterval, setRandomBossInterval] = useState('1h');
  const [spawnType, setSpawnType] = useState<'radius' | 'nationwide' | 'municipality'>('radius');
  const [baseLat, setBaseLat] = useState('35.6983');
  const [baseLng, setBaseLng] = useState('139.4130');
  const [targetMunicipality, setTargetMunicipality] = useState('東京都');
  const [isMassiveSpawn, setIsMassiveSpawn] = useState(false);
  const [massiveSpawnCount, setMassiveSpawnCount] = useState('50');
  const [massiveStartAt, setMassiveStartAt] = useState('');
  const [massiveEndAt, setMassiveEndAt] = useState('');

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
  
  // 属性相性入力用ステート
  const [strongAgainstInput, setStrongAgainstInput] = useState('');
  const [weakAgainstInput, setWeakAgainstInput] = useState('');

  const [directTargetGender, setDirectTargetGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [directTargetAge, setDirectTargetAge] = useState<'ALL' | 'TEENS' | 'TWENTIES' | 'THIRTIES'>('ALL');
  const [directTargetLocation, setDirectTargetLocation] = useState('');

  // ==================== 8. WebAR動的配信＆クライアント別オブジェクト管理 ====================
  const [arClientType, setArClientType] = useState<'global' | 'client_specific'>('global');
  const [arTargetClientId, setArTargetClientId] = useState('');
  const [arDisplayMode, setArDisplayMode] = useState<'3d_model' | 'card_frame' | 'hybrid'>('card_frame');
  const [arMarkerCustomUrl, setArMarkerCustomUrl] = useState('');
  const [arBtnPlacement, setArBtnPlacement] = useState<'bottom_center' | 'top_right' | 'hidden'>('bottom_center');
  const [arActionText, setArActionText] = useState('アプリにデータを同期');
  const [arDeployMode, setArDeployMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [arScheduledAt, setArScheduledAt] = useState('');

  // 🌟 新規追加: 報酬タイプ (カード付与 か ボス出現 か)
  const [arRewardType, setArRewardType] = useState<'card' | 'boss'>('card');

  // カード用ステート
  const [arAssetMode, setArAssetMode] = useState<'upload' | 'ai'>('upload');
  const [arAssetCustomUrl, setArAssetCustomUrl] = useState('');
  const [arAssetAiPrompt, setArAssetAiPrompt] = useState('');
  const [arAssetName, setArAssetName] = useState('');
  const [arAssetRarity, setArAssetRarity] = useState('N');
  const [arAssetAttr, setArAssetAttr] = useState('無');
  const [arAssetHp, setArAssetHp] = useState('100');
  const [arAssetAtk, setArAssetAtk] = useState('50');
  const [arAssetDef, setArAssetDef] = useState('50');
  const [arAssetSpd, setArAssetSpd] = useState('50');

  const [arWinAssetMode, setArWinAssetMode] = useState<'upload' | 'ai'>('upload');
  const [arWinAssetUrl, setArWinAssetUrl] = useState('');
  const [arWinAssetAiPrompt, setArWinAssetAiPrompt] = useState('');
  const [arWinRate, setArWinRate] = useState('0.1');
  const [arActionTextWin, setArActionTextWin] = useState('大当たり！クーポンを獲得！');
  const [arWinAssetName, setArWinAssetName] = useState('');
  const [arWinAssetRarity, setArWinAssetRarity] = useState('SR');
  const [arWinAssetAttr, setArWinAssetAttr] = useState('光');
  const [arWinAssetHp, setArWinAssetHp] = useState('500');
  const [arWinAssetAtk, setArWinAssetAtk] = useState('200');
  const [arWinAssetDef, setArWinAssetDef] = useState('200');
  const [arWinAssetSpd, setArWinAssetSpd] = useState('200');

  // 🌟 新規追加: ボスバトル報酬用ステート
  const [arBossMode, setArBossMode] = useState<'upload' | 'ai'>('upload');
  const [arBossImageUrl, setArBossImageUrl] = useState('');
  const [arBossAiPrompt, setArBossAiPrompt] = useState('');
  const [arBossName, setArBossName] = useState('');
  const [arBossHp, setArBossHp] = useState('1500');
  const [arBossAtk, setArBossAtk] = useState('100');
  const [arBossDef, setArBossDef] = useState('50');
  const [arBossElement, setArBossElement] = useState('闇');

  const [newShopName, setNewShopName] = useState('');
  const [newShopLocation, setNewShopLocation] = useState('');
  const [generatedShopData, setGeneratedShopData] = useState<{ id: string; url: string; qr: string } | null>(null);

  // ==================== 9. チーム管理 ====================
  const [teams, setTeams] = useState<any[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // ==================== 10. 陣取り＆特殊ルール管理 ====================
  const [territories, setTerritories] = useState<any[]>([]);
  const [territoryRules, setTerritoryRules] = useState<any[]>([]);
  
  // 陣取りイベント管理用のステート
  const [ruleName, setRuleName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleRequireFixed, setRuleRequireFixed] = useState(true);
  const [ruleEventStart, setRuleEventStart] = useState('');
  const [ruleEventEnd, setRuleEventEnd] = useState('');
  const [ruleEventDesc, setRuleEventDesc] = useState('');
  const [ruleTargetRarity, setRuleTargetRarity] = useState('');

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
      fetchTeams();
      fetchTerritories();
      fetchRules();
    }, [])
  );

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
        if (c.arDeployMode) setArDeployMode(c.arDeployMode);
        if (c.arScheduledAt) setArScheduledAt(c.arScheduledAt);
        if (c.rewardType) setArRewardType(c.rewardType);
        
        if (c.arBaseStats) {
          setArAssetName(c.arBaseStats.name || ''); setArAssetRarity(c.arBaseStats.rarity || 'N'); setArAssetAttr(c.arBaseStats.element || '無');
          setArAssetHp(c.arBaseStats.hp?.toString() || '100'); setArAssetAtk(c.arBaseStats.atk?.toString() || '50');
          setArAssetDef(c.arBaseStats.def?.toString() || '50'); setArAssetSpd(c.arBaseStats.spd?.toString() || '50');
        }
        if (c.arWinStats) {
          setArWinAssetName(c.arWinStats.name || ''); setArWinAssetRarity(c.arWinStats.rarity || 'SR'); setArWinAssetAttr(c.arWinStats.element || '光');
          setArWinAssetHp(c.arWinStats.hp?.toString() || '500'); setArWinAssetAtk(c.arWinStats.atk?.toString() || '200');
          setArWinAssetDef(c.arWinStats.def?.toString() || '200'); setArWinAssetSpd(c.arWinStats.spd?.toString() || '200');
        }
        if (c.bossSettings) {
          setArBossName(c.bossSettings.name || '');
          setArBossImageUrl(c.bossSettings.image_url || '');
          setArBossHp(c.bossSettings.hp?.toString() || '1500');
          setArBossAtk(c.bossSettings.atk?.toString() || '100');
          setArBossDef(c.bossSettings.def?.toString() || '50');
          setArBossElement(c.bossSettings.element || '闇');
        }
      }
    } catch (e) { console.log('AR設定フェッチ非活性', e); }
  };

  const fetchRandomBossConfig = async () => {
    try {
      const { data } = await supabase.from('system_config').select('*').eq('id', 'random_boss_settings').single();
      if (data && data.config_data) {
        setRandomBossEnabled(data.config_data.enabled ?? false);
        setRandomBossInterval(data.config_data.interval ?? '1h');
        setSpawnType(data.config_data.spawn_type ?? 'radius');
        setTargetMunicipality(data.config_data.municipality ?? '東京都');
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

  const fetchTeams = async () => {
    try {
      let { data, error } = await supabase.from('teams').select('*, profiles(player_name)').order('created_at', { ascending: false });
      
      if (error) {
        const fallback = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        data = fallback.data;
      }
      
      if (data) {
        const scoredTeams = data.map((t: any) => ({
          ...t,
          display_name: t.name || t.team_name || '名称未設定',
          activity_score: (t.member_count || 1) * 100 + (t.total_points || Math.floor(Math.random() * 500)),
        })).sort((a: any, b: any) => b.activity_score - a.activity_score);
        setTeams(scoredTeams);
      }
    } catch (e) { console.log('Team fetch error:', e); }
  };

  const fetchTerritories = async () => {
    try {
      let { data, error } = await supabase.from('territories').select('*, profiles(player_name)').order('created_at', { ascending: false });
      if (error) {
        const fallback = await supabase.from('territories').select('*').order('created_at', { ascending: false });
        data = fallback.data;
      }
      if (data) setTerritories(data);
    } catch (e) { console.log('Territories fetch error:', e); }
  };

  const fetchRules = async () => {
    try {
      const { data } = await supabase.from('territory_rules').select('*').order('created_at', { ascending: false });
      if (data) setTerritoryRules(data);
    } catch (e) { console.log('Rules fetch error:', e); }
  };

  // --- アクション関連 ---
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

  const pickWebFile = async (accept: string) => {
    return await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.opacity = '0';
      input.style.width = '1px';
      input.style.height = '1px';
      input.style.pointerEvents = 'none';

      input.onchange = () => {
        resolve(input.files?.[0] ?? null);
        if (input.parentNode) input.parentNode.removeChild(input);
      };
      document.body.appendChild(input);
      input.click();
    });
  };

  const pickWebDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'] });
      if (result.type === 'success') return result;
    } catch (_) {}
    const file = await pickWebFile('*/*');
    if (!file) return { type: 'cancel' as const };
    return {
      type: 'success' as const,
      uri: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      file
    } as const;
  };

  const getArrayBufferFromAsset = async (asset: any) => {
    if (Platform.OS === 'web') {
      if (asset.arrayBuffer) return await asset.arrayBuffer();
      if (asset.file?.arrayBuffer) return await asset.file.arrayBuffer();
      if (asset.uri) {
        const response = await fetch(asset.uri);
        return await response.arrayBuffer();
      }
      throw new Error('Web のファイルを読み込めませんでした');
    }
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    return decode(base64);
  };

  // 🌟 ARアセットアップロード（種別指定）
  const handleUploadArAsset = async (promoId: string, assetType: 'base' | 'win' | 'boss') => {
    try {
      const result = Platform.OS === 'web'
        ? await pickWebDocument()
        : await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (result.type !== 'success') return;
      const asset: any = result;

      if (!promoId || promoId === 'ALL') {
        Alert.alert('エラー', '対象のプロモID（クライアントUUID）を入力してください。');
        return;
      }
      setLoading(true);

      const arrayBuffer = await getArrayBufferFromAsset(asset);
      const prefix = assetType === 'win' ? 'win_' : assetType === 'boss' ? 'boss_' : '';
      const fileName = `${promoId}/${Date.now()}_${prefix}asset_${asset.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ar_assets')
        .upload(fileName, arrayBuffer, { contentType: asset.type || asset.mimeType || 'application/octet-stream', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('ar_assets').getPublicUrl(fileName);
      
      if (assetType === 'win') {
        setArWinAssetUrl(publicUrl);
        Alert.alert('アップロード成功', `🎁 報酬用アセットをアップロードしました`);
      } else if (assetType === 'boss') {
        setArBossImageUrl(publicUrl);
        Alert.alert('アップロード成功', `😈 ボス用アセットをアップロードしました`);
      } else {
        setArAssetCustomUrl(publicUrl);
        Alert.alert('アップロード成功', `通常時の3Dモデル/画像をアップロードしました`);
      }
    } catch (e: any) {
      Alert.alert('アップロード失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 🌟 ARアセットAI生成（種別指定）
  const handleGenerateArAssetAi = async (assetType: 'base' | 'win' | 'boss') => {
    const prompt = assetType === 'win' ? arWinAssetAiPrompt : assetType === 'boss' ? arBossAiPrompt : arAssetAiPrompt;
    if (!prompt) return Alert.alert('エラー', 'プロンプトを入力してください');
    
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt } });
      if (data?.imageUrl) {
        if (assetType === 'win') {
          setArWinAssetUrl(data.imageUrl);
          Alert.alert('生成成功', '🎁 報酬アセットをAIで生成しました！');
        } else if (assetType === 'boss') {
          setArBossImageUrl(data.imageUrl);
          Alert.alert('生成成功', '😈 ボスアセットをAIで生成しました！');
        } else {
          setArAssetCustomUrl(data.imageUrl);
          Alert.alert('生成成功', '通常アセットをAIで生成しました！');
        }
      } else {
        throw new Error('AI生成に失敗しました');
      }
    } catch (e: any) {
      Alert.alert('生成エラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadArMarker = async (promoId: string) => {
    try {
      const result = Platform.OS === 'web'
        ? await pickWebDocument()
        : await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (result.type !== 'success') return;
      const asset: any = result;

      if (!promoId || promoId === 'ALL') {
        Alert.alert('エラー', '対象のプロモIDを入力してください。');
        return;
      }
      setLoading(true);

      const arrayBuffer = await getArrayBufferFromAsset(asset);
      const fileName = `${promoId}/${Date.now()}_marker_${asset.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ar_markers')
        .upload(fileName, arrayBuffer, { contentType: asset.type || asset.mimeType || 'application/octet-stream', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('ar_markers').getPublicUrl(fileName);
      setArMarkerCustomUrl(publicUrl);
      Alert.alert('アップロード成功', `トリガーマーカーを紐付けました！`);
    } catch (e: any) {
      Alert.alert('アップロード失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

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
          name: cName, description: shopItemType === 'pack' ? packDesc : `属性: ${cAttr} / レアリティ: ${cRarity}`,
          price: parseInt(cPrice) || 500, stock: parseInt(cStock) || 100,
          package_image_url: finalPackageUrl || finalCardImageUrl,
          card_image_url: shopItemType === 'single' ? finalCardImageUrl : null,
          stats: itemStats
        }]);
        if (shopError) throw shopError;
        Alert.alert('成功', `ショップに${shopItemType === 'pack' ? 'パック商品' : '単体カード'}を出品しました！`);
      } else {
        const { data: insertedFixed, error: fixError } = await supabase.from('fixed_cards').insert([{
          card_name: cName, trigger_type: 'admin_mint', image_url: finalCardImageUrl, stats: cardDataToInsert
        }]).select().single();
        if (fixError) throw fixError;

        if (mintDest === 'direct') {
          const { data: allProfiles } = await supabase.from('profiles').select('*').limit(10000);
          const matched = (allProfiles || []).filter((p: any) => {
            if (directTargetGender === 'MALE' && !(p.gender === 'male' || p.gender === '男性')) return false;
            if (directTargetGender === 'FEMALE' && !(p.gender === 'female' || p.gender === '女性')) return false;
            const age = parseInt(p.age) || 0;
            if (directTargetAge === 'TEENS' && !(age > 0 && age < 20)) return false;
            if (directTargetAge === 'TWENTIES' && !(age >= 20 && age < 30)) return false;
            if (directTargetAge === 'THIRTIES' && !(age >= 30)) return false;
            if (directTargetLocation && p.location && !p.location.includes(directTargetLocation)) return false;
            return true;
          });

          // 🚨【修正箇所】: 直接 cards テーブルに入れるのではなく、rewards（報酬ボックス）に入れるように変更
          const rewardsToInsert = matched.map((p: any) => ({
            player_id: p.id,
            title: `🎁 運営からのプレゼント: ${cName}`,
            description: `【属性: ${cAttr} / レアリティ: ${cRarity}】の限定カードが届きました！`,
            reward_type: 'card',
            reward_data: {
              card_name: `【特典】${cName || '名もなき特権カード'}`,
              image_url: finalCardImageUrl,
              feature: `運営直配布`,
              skill_name: cardDataToInsert.skill_name,
              status_hp: cardDataToInsert.status_hp,
              status_atk: cardDataToInsert.status_atk,
              status_def: cardDataToInsert.status_def,
              status_spd: cardDataToInsert.status_spd,
              status_total: cardDataToInsert.status_total,
              rarity: cRarity || 'SR',
              element: cAttr || '火'
            },
            is_claimed: false
          }));

          if (rewardsToInsert.length > 0) {
            const { error: rewardError } = await supabase.from('rewards').insert(rewardsToInsert);
            if (rewardError) throw rewardError;

            // お知らせメッセージも送信
            const messages = matched.map((p: any) => ({
              sender_id: 'SYSTEM', text: `🎁 報酬ボックスにプレゼントが届いています: ${cName}`,
              metadata: { type: 'direct_gift', card_name: cName, fixed_card_id: insertedFixed?.id || null, recipient_id: p.id }
            }));
            await supabase.from('messages').insert(messages);
          }
        }
        Alert.alert('成功', '条件に合致するユーザーの「報酬ボックス」に特権カードを配布しました！');
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
        target_lat: parseFloat(bLat), target_lng: parseFloat(bLng), radius_meters: parseInt(bRadius),
        start_at: bStartAt || null, end_at: bEndAt || null, is_active: true
      }]).select().single();
      if (campError) throw campError;

      // 💡 ここは「設定」を保存する場所なので、固定カード情報(fixed_cards)として登録しておき、
      // 実際のバトル画面等で勝利したときに `rewards` テーブルへ挿入する仕組みになります。
      await supabase.from('fixed_cards').insert([{
        card_name: dropCardName || `【撃破報酬】${bName}`, trigger_type: 'boss_drop', image_url: finalDropCardUrl, sponsor_id: campData.id,
        stats: { element: dropCardAttr, rarity: dropCardRarity, hp: 100, atk: 50, def: 50, spd: 50 }
      }]);

      await supabase.from('bosses').insert([{
        name: bName, hp: parseInt(bHp) || 1500, atk: parseInt(bAtk) || 100, def: parseInt(bDef) || 50,
        element: bElement, image_url: finalBossImageUrl, trigger_campaign_id: campData.id
      }]);

      Alert.alert('成功', 'ボスとドロップカードをマップに配置しました！\n(討伐報酬はプレイヤー側のアプリで処理されます)');
      fetchBosses();
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handleUpdateRandomBossConfig = async () => {
    setLoading(true);
    try {
      const config_data = {
        enabled: randomBossEnabled, interval: randomBossInterval,
        spawn_type: spawnType, municipality: targetMunicipality,
        base_lat: parseFloat(baseLat) || 35.6983, base_lng: parseFloat(baseLng) || 139.4130
      };
      const { error } = await supabase.from('system_config').upsert({ id: 'random_boss_settings', config_data });
      if (error) throw error;
      Alert.alert('成功', 'ランダムボスの出現パラメータを更新しました。');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const getRandomCoords = () => {
    let lat = parseFloat(baseLat) || 35.6983;
    let lng = parseFloat(baseLng) || 139.4130;

    if (spawnType === 'nationwide') {
      lat = 24 + Math.random() * 22;
      lng = 128 + Math.random() * 17;
    } else if (spawnType === 'municipality') {
      const mockDict: Record<string, {lat: number, lng: number}> = {
        '東京都': {lat: 35.689, lng: 139.691},
        '大阪府': {lat: 34.686, lng: 135.52},
        '北海道': {lat: 43.064, lng: 141.346},
        '福岡県': {lat: 33.606, lng: 130.418},
      };
      const base = mockDict[targetMunicipality] || {lat, lng};
      lat = base.lat + (Math.random() - 0.5) * 0.2;
      lng = base.lng + (Math.random() - 0.5) * 0.2;
    } else {
      lat += (Math.random() - 0.5) * 0.04;
      lng += (Math.random() - 0.5) * 0.04;
    }
    return { finalLat: lat, finalLng: lng };
  };

  const triggerInstantRandomBoss = async () => {
    setLoading(true);
    try {
      const count = isMassiveSpawn ? (parseInt(massiveSpawnCount) || 10) : 1;
      const prefix = ['次元の', '彷徨える', '極大の', 'アビス・', 'ヴォイド・', '災厄の', '覚醒せし'];
      const suffix = ['ゴーレム', 'ベヒモス', 'フェニックス', 'リヴァイアsan', 'ナイトメア', '機神龍', 'タイタン'];
      
      const promises = [];

      for (let i = 0; i < count; i++) {
        promises.push((async () => {
          const randomName = prefix[Math.floor(Math.random() * prefix.length)] + suffix[Math.floor(Math.random() * suffix.length)];
          const randomElement = elementsList[Math.floor(Math.random() * elementsList.length)] || '闇';
          const randomRarity = ['SR', 'SSR', 'UR'][Math.floor(Math.random() * 3)];
          
          const { finalLat, finalLng } = getRandomCoords();

          let finalBossUrl = 'https://via.placeholder.com/300x400.png?text=Massive+Boss';
          let finalDropUrl = 'https://via.placeholder.com/300x400.png?text=Massive+Drop';

          if (!isMassiveSpawn) {
            const generatedBossPrompt = `A fantasy trading card game illustration of a giant monster creature, name is ${randomName}, hyper detailed, masterwork elemental of ${randomElement}, cyberpunk tech mixed with dark magic grid style, card art template asset`;
            const generatedDropPrompt = `A shiny cosmic artifact crystal weapon glowing inside a container, rewards token, ${randomRarity} trading card high rarity frame game asset`;
            try {
              const bossRes = await supabase.functions.invoke('generate-card-image', { body: { prompt: generatedBossPrompt } });
              if (bossRes.data?.imageUrl) finalBossUrl = bossRes.data.imageUrl;
              const dropRes = await supabase.functions.invoke('generate-card-image', { body: { prompt: generatedDropPrompt } });
              if (dropRes.data?.imageUrl) finalDropUrl = dropRes.data.imageUrl;
            } catch (aiErr) { console.log('AI自動生成エラー', aiErr); }
          }

          const { data: campData, error: campError } = await supabase.from('campaigns').insert([{
            title: `【突発出現】${randomName}`, sponsor_name: isMassiveSpawn ? 'フェス運営' : 'システム自動生成',
            target_lat: finalLat, target_lng: finalLng, radius_meters: 1500, 
            start_at: isMassiveSpawn ? (massiveStartAt || null) : null,
            end_at: isMassiveSpawn ? (massiveEndAt || null) : null,
            is_active: true
          }]).select().single();
          if (campError) throw campError;

          // 💡 ここも設定の保存のみ
          await supabase.from('fixed_cards').insert([{
            card_name: `【戦果】${randomName}の結晶核`, trigger_type: 'boss_drop', image_url: finalDropUrl, sponsor_id: campData.id,
            stats: { element: randomElement, rarity: randomRarity, hp: 100, atk: 60, def: 40, spd: 80 }
          }]);

          await supabase.from('bosses').insert([{
            name: randomName, hp: Math.floor(Math.random() * 2000) + 1000, atk: Math.floor(Math.random() * 150) + 50, def: 50,
            element: randomElement, image_url: finalBossUrl, trigger_campaign_id: campData.id
          }]);
        })());
      }

      await Promise.all(promises);
      Alert.alert('自動生成成功', `${count}体のボスをマップへ配置しました！`);
      fetchBosses();
    } catch (err: any) { Alert.alert('エラー', err.message); } finally { setLoading(false); }
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

  const handleAddElementRelation = async () => {
    if (!newElement.trim()) {
      Alert.alert('エラー', '属性名を入力してください');
      return;
    }

    setLoading(true);
    const strongArray = strongAgainstInput.split(',').map(s => s.trim()).filter(s => s !== '');
    const weakArray = weakAgainstInput.split(',').map(s => s.trim()).filter(s => s !== '');

    try {
      const { error: relationError } = await supabase
        .from('element_relations')
        .upsert({
          element_name: newElement.trim(),
          strong_against: strongArray,
          weak_against: weakArray
        }, { onConflict: 'element_name' });

      if (relationError) throw relationError;

      if (!elementsList.includes(newElement.trim())) {
        const updated = [...elementsList, newElement.trim()];
        await supabase.from('system_config').upsert({ id: 'elements', config_data: { list: updated } });
        setElementsList(updated);
      }

      Alert.alert('成功', `属性「${newElement}」の相性データを保存・更新しました！`);
      setNewElement(''); setStrongAgainstInput(''); setWeakAgainstInput('');
    } catch (error: any) {
      Alert.alert('保存エラー', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🌟 AR設定の同期保存（個別 or グローバル）
  const handleUpdateArConfig = async () => {
    if (arClientType === 'client_specific' && !arTargetClientId) {
      Alert.alert('エラー', '個別指定時は対象のクライアントUUIDが必要です。');
      return;
    }
    setLoading(true);

    const arBaseStats = {
      name: arAssetName || 'ARカード', rarity: arAssetRarity, element: arAssetAttr,
      hp: parseInt(arAssetHp)||100, atk: parseInt(arAssetAtk)||50, def: parseInt(arAssetDef)||50, spd: parseInt(arAssetSpd)||50
    };
    
    // 💡 ボス勝利時の報酬カードとしても利用される
    const arWinStats = {
      name: arWinAssetName || '大当りARカード', rarity: arWinAssetRarity, element: arWinAssetAttr,
      hp: parseInt(arWinAssetHp)||500, atk: parseInt(arWinAssetAtk)||200, def: parseInt(arWinAssetDef)||200, spd: parseInt(arWinAssetSpd)||200
    };

    const bossSettings = {
      name: arBossName,
      image_url: arBossImageUrl,
      hp: parseInt(arBossHp) || 1500,
      atk: parseInt(arBossAtk) || 100,
      def: parseInt(arBossDef) || 50,
      element: arBossElement,
    };

    try {
      if (arClientType === 'client_specific') {
        const { error } = await supabase.from('promo_links').update({
          ar_asset_url: arAssetCustomUrl || null,
          ar_win_asset_url: arWinAssetUrl || null,
          win_rate: parseFloat(arWinRate) || 0,
          ar_action_text_win: arActionTextWin,
          ar_display_mode: arDisplayMode,
          ar_marker_url: arMarkerCustomUrl || null,
          ar_base_stats: arBaseStats,
          ar_win_stats: arWinStats,
          reward_type: arRewardType,
          boss_name: arBossName,
          boss_image_url: arBossImageUrl,
          boss_stats: bossSettings
        }).eq('id', arTargetClientId);

        if (error) throw error;
        Alert.alert('同期成功', `店舗 [${arTargetClientId.substring(0,8)}] の確率・報酬・アセットおよびカードステータスを個別同期しました。`);
      } else {
        const config_data = {
          arClientType, arTargetClientId: 'ALL',
          arDisplayMode, arAssetCustomUrl, arBtnPlacement, arActionText, arDeployMode,
          arScheduledAt: arDeployMode === 'scheduled' ? arScheduledAt : null,
          arBaseStats, arWinStats,
          rewardType: arRewardType,
          bossSettings
        };
        const { error } = await supabase.from('system_config').upsert({ id: 'webar_dynamic_settings', config_data });
        if (error) throw error;
        Alert.alert('同期成功', 'グローバル一括WebARパラメータ(報酬タイプ・ステータス含む)を更新しました。');
      }
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handlePreviewAr = () => {
    const previewUrl = `${WEBAR_BASE_URL}/ar_preview.html?mode=${arDisplayMode}&reward_type=${arRewardType}&asset=${encodeURIComponent(arAssetCustomUrl)}&text=${encodeURIComponent(arActionText)}&win_asset=${encodeURIComponent(arWinAssetUrl)}&win_text=${encodeURIComponent(arActionTextWin)}&rate=${arWinRate}`;
    Linking.openURL(previewUrl);
  };

  // 🌟 QR発行とURL表示
  const handleGenerateShopQr = async () => {
    if (!newShopName) {
      Alert.alert('エラー', '店舗名（キャンペーン名）を入力してください。');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('promo_links').insert([{
        client_name: newShopName,
        note: newShopLocation || '場所未設定',
        is_active: true
      }]).select('id').single();

      if (error) throw error;

      const shopId = data.id;
      const arUrl = `${WEBAR_BASE_URL}/ar.php?shop_id=${shopId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(arUrl)}`;

      setGeneratedShopData({ id: shopId, url: arUrl, qr: qrUrl });
      setArTargetClientId(shopId);
      setArClientType('client_specific');
      
      setNewShopName('');
      setNewShopLocation('');
      Alert.alert('発行成功', '新規店舗のQRコードとUUIDが生成されました！\n続けて下のパネルからアセットを設定できます。');

    } catch (e: any) {
      Alert.alert('発行失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (e: any) { Alert.alert('エラー', `エクスポート失敗: ${e.message}`); }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    Alert.alert('チーム解散確認', `本当にチーム「${name}」を強制解散させますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '解散する', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await supabase.from('teams').delete().eq('id', id);
            Alert.alert('成功', 'チームを解散させました。');
            fetchTeams();
          } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const filteredTeams = teams.filter(t => 
    (t.display_name && t.display_name.toLowerCase().includes(teamSearchQuery.toLowerCase())) || 
    (t.id && t.id.toLowerCase().includes(teamSearchQuery.toLowerCase()))
  );

  const handleDeleteTerritory = async (id: string) => {
    Alert.alert('陣地削除確認', `この陣地を強制的に撤去しますか？\n(不適切な場所などの対処)`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '撤去する', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await supabase.from('territories').delete().eq('id', id);
            Alert.alert('成功', '陣地を撤去しました。');
            fetchTerritories();
          } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const handleSaveRule = async () => {
    if (!ruleName || !ruleKeyword) return Alert.alert('エラー', 'ルール名と対象キーワードを入力してください');
    setLoading(true);
    try {
      await supabase.from('territory_rules').insert([{
        rule_name: ruleName,
        target_keyword: ruleKeyword,
        require_fixed_card: ruleRequireFixed,
        required_rarity: ruleTargetRarity || null,
        start_at: ruleEventStart || null,
        end_at: ruleEventEnd || null,
        description: ruleEventDesc || null,
        is_active: true
      }]);
      Alert.alert('成功', 'イベント/特殊ルールを追加しました');
      setRuleName(''); setRuleKeyword('');
      setRuleEventStart(''); setRuleEventEnd('');
      setRuleEventDesc(''); setRuleTargetRarity('');
      fetchRules();
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  const handleDeleteRule = async (id: string) => {
    Alert.alert('削除確認', 'このルールを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await supabase.from('territory_rules').delete().eq('id', id);
            fetchRules();
          } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const getTeamColor = (ownerId: string | null) => {
    if (!ownerId) return 'rgba(100, 116, 139, 0.5)';
    const colors = ['rgba(239, 68, 68, 0.5)', 'rgba(59, 130, 246, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(245, 158, 11, 0.5)', 'rgba(139, 92, 246, 0.5)'];
    let hash = 0;
    for (let i = 0; i < ownerId.length; i++) {
      hash = ownerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getLeafletHtml = (territoriesList: any[]) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${territoriesList.length > 0 && territoriesList[0].latitude ? territoriesList[0].latitude : 35.6983}, ${territoriesList.length > 0 && territoriesList[0].longitude ? territoriesList[0].longitude : 139.4130}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var getTeamColor = function(ownerId) {
          if (!ownerId) return 'rgba(100, 116, 139, 0.5)';
          var colors = ['rgba(239, 68, 68, 0.5)', 'rgba(59, 130, 246, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(245, 158, 11, 0.5)', 'rgba(139, 92, 246, 0.5)'];
          var hash = 0;
          for (var i = 0; i < ownerId.length; i++) {
            hash = ownerId.charCodeAt(i) + ((hash << 5) - hash);
          }
          return colors[Math.abs(hash) % colors.length];
        };

        var territories = ${JSON.stringify(territoriesList)};
        territories.forEach(function(t) {
          if (t.latitude && t.longitude) {
            var color = getTeamColor(t.owner_id);
            var borderColor = color.replace('0.5)', '1.0)');
            L.circle([t.latitude, t.longitude], {
              color: borderColor,
              fillColor: color,
              fillOpacity: 0.5,
              radius: t.radius || 500
            }).addTo(map);
            L.marker([t.latitude, t.longitude]).addTo(map)
              .bindPopup("<b>所有者: " + (t.profiles?.player_name || (t.owner_id ? t.owner_id.substring(0,8) : '不明')) + "</b><br>防衛力: " + (t.defense_power || 0));
          }
        });
      </script>
    </body>
    </html>
  `;

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
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'teams' && styles.activeTabBtn]} onPress={() => setActiveTab('teams')}>
          <Shield color={activeTab === 'teams' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'teams' && styles.activeTabText]}>チーム</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'territories' && styles.activeTabBtn]} onPress={() => setActiveTab('territories')}>
          <Flag color={activeTab === 'territories' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'territories' && styles.activeTabText]}>陣取り監視</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'rules' && styles.activeTabBtn]} onPress={() => setActiveTab('rules')}>
          <ScrollText color={activeTab === 'rules' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>ルール・イベント</Text>
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
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'ar' && styles.activeTabBtn]} onPress={() => setActiveTab('ar')}>
          <QrCode color={activeTab === 'ar' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'ar' && styles.activeTabText]}>WebAR制御</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'announcements' && styles.activeTabBtn]} onPress={() => setActiveTab('announcements')}>
          <Bell color={activeTab === 'announcements' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>お知らせ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'master' && styles.activeTabBtn]} onPress={() => setActiveTab('master')}>
          <Database color={activeTab === 'master' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'master' && styles.activeTabText]}>マスタ</Text>
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

        {/* ===================== 9. チーム管理 ===================== */}
        {activeTab === 'teams' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>チーム管理・スコアリング</Text>
            <View style={[styles.row, {marginBottom: 16}]}>
              <Search color="#94A3B8" size={20} style={{position: 'absolute', left: 14, zIndex: 1}} />
              <TextInput 
                style={[styles.input, {flex: 1, paddingLeft: 42}]} 
                placeholder="チーム名やIDで検索..." 
                value={teamSearchQuery} 
                onChangeText={setTeamSearchQuery} 
              />
            </View>
            <Text style={{color:'#64748B', fontSize: 12, marginBottom: 12}}>
              ※スコアは人数とアクティビティに基づき算出されたランキング順に表示されます。
            </Text>
            {filteredTeams.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#94A3B8', marginVertical: 20}}>該当するチームがありません</Text>
            ) : (
              filteredTeams.map((t, index) => (
                <View key={t.id} style={styles.listItemRow}>
                  <View style={{flex: 1}}>
                    <View style={styles.row}>
                      <Text style={{fontWeight: '900', color: '#3B82F6', marginRight: 8, fontSize: 16}}>#{index + 1}</Text>
                      <Text style={styles.listItemTitle}>{t.display_name}</Text>
                    </View>
                    <Text style={styles.listItemSub} numberOfLines={1}>{t.description || '説明なし'}</Text>
                    <Text style={[styles.listItemSub, {color: '#0F172A', marginTop: 4}]}>
                      👥 メンバー数: {t.member_count || 1} | 🏆 スコア: {t.activity_score || 0}
                    </Text>
                    <Text style={{fontSize: 10, color: '#94A3B8', marginTop: 4}}>ID: {t.id}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionBtn, styles.banBtn]} onPress={() => handleDeleteTeam(t.id, t.display_name)} disabled={loading}>
                    <Text style={styles.actionBtnText}>解散</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===================== 10. 陣取りゲーム(テリトリー)管理 ===================== */}
        {activeTab === 'territories' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>陣取り状況監視＆管理</Text>
            <Text style={{color:'#64748B', fontSize: 12, marginBottom: 16}}>
              マップ上に配置された陣地を監視し、不適切な場所にある陣地を強制的に撤去できます。
              ※PC・モバイルの両方でピンチアウト・ズーム操作による詳細マップ確認が可能です。
            </Text>
            
            <View style={{ height: 400, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
              {Platform.OS === 'web' ? (
                <iframe 
                  srcDoc={getLeafletHtml(territories)} 
                  style={{ width: '100%', height: '100%', borderWidth: 0 } as any} 
                  title="Territories Map"
                />
              ) : MapView ? (
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: territories.length > 0 && territories[0].latitude ? territories[0].latitude : 35.6983,
                    longitude: territories.length > 0 && territories[0].longitude ? territories[0].longitude : 139.4130,
                    latitudeDelta: 0.1,
                    longitudeDelta: 0.1,
                  }}
                  zoomEnabled={true}
                  scrollEnabled={true}
                  pitchEnabled={true}
                >
                  {territories.map((t) => {
                    if (t.latitude && t.longitude) {
                      return (
                        <Circle
                          key={`circle-${t.id}`}
                          center={{ latitude: t.latitude, longitude: t.longitude }}
                          radius={t.radius || 500}
                          fillColor={getTeamColor(t.owner_id)}
                          strokeColor={getTeamColor(t.owner_id).replace('0.5', '1.0')}
                          strokeWidth={2}
                        />
                      );
                    }
                    return null;
                  })}
                  {territories.map((t) => {
                    if (t.latitude && t.longitude) {
                      return (
                        <Marker
                          key={`marker-${t.id}`}
                          coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                          title={`所有者: ${t.profiles?.player_name || t.owner_id?.substring(0,8)}`}
                          description={`防衛力: ${t.defense_power || 0}`}
                        />
                      );
                    }
                    return null;
                  })}
                </MapView>
              ) : (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text>マップの読み込みに失敗しました</Text></View>
              )}
            </View>

            {territories.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#94A3B8', marginVertical: 20}}>現在確保されている陣地はありません</Text>
            ) : (
              territories.map((t) => (
                <View key={t.id} style={styles.listItemRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.listItemTitle}>所有者: {t.profiles?.player_name || t.owner_id?.substring(0,8)}</Text>
                    <Text style={[styles.listItemSub, {color: '#10B981', fontWeight: 'bold'}]}>🛡️ 防衛力: {t.defense_power || 0}</Text>
                    <Text style={styles.listItemSub}>📍 座標: {t.latitude?.toFixed(4)}, {t.longitude?.toFixed(4)}</Text>
                    <Text style={{fontSize: 10, color: '#94A3B8', marginTop: 4}}>設置日: {new Date(t.created_at).toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity style={{padding: 10}} onPress={() => handleDeleteTerritory(t.id)} disabled={loading}>
                    <Trash2 color="#EF4444" size={24} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===================== 11. 特殊ルール・陣取りイベント管理 ===================== */}
        {activeTab === 'rules' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>陣取りイベント・特殊ルール設定</Text>
            <Text style={{color:'#64748B', fontSize: 12, marginBottom: 16}}>
              特定のエリア（キーワード）での陣取りに対し、「期間」や「特定カード/レアリティ」の制限を付与してイベントを作成します。
            </Text>

            <View style={{backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24}}>
              <Text style={styles.label}>新規ルールの追加 (陣取りイベント管理)</Text>
              <TextInput style={styles.input} value={ruleName} onChangeText={setRuleName} placeholder="ルール・イベント名 (例: 立川市 夏の陣)" />
              <TextInput style={[styles.input, {marginTop: 8}]} value={ruleKeyword} onChangeText={setRuleKeyword} placeholder="対象キーワード (例: 東京都立川市)" />
              
              <Text style={styles.label}>イベント開始日時 / 終了日時 (任意)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={ruleEventStart} onChangeText={setRuleEventStart} placeholder="開始 (例: 2026-06-20T12:00)" />
                <TextInput style={[styles.input, {flex: 1}]} value={ruleEventEnd} onChangeText={setRuleEventEnd} placeholder="終了 (例: 2026-06-25T23:59)" />
              </View>

              <Text style={styles.label}>イベント詳細・説明</Text>
              <TextInput style={[styles.input, {height: 80, textAlignVertical: 'top'}]} value={ruleEventDesc} onChangeText={setRuleEventDesc} placeholder="イベントの詳細内容を記載..." multiline />

              <Text style={styles.label}>参加条件・制限</Text>
              <TextInput style={[styles.input, {marginBottom: 12}]} value={ruleTargetRarity} onChangeText={setRuleTargetRarity} placeholder="特定のレアリティ限定 (例: UR, 未入力で制限なし)" />

              <View style={[styles.row, {marginTop: 0}]}>
                <Text style={[styles.label, {flex: 1, marginTop: 0}]}>協賛(固定)カードを必須にする</Text>
                <TouchableOpacity 
                  style={{width: 50, height: 28, borderRadius: 14, backgroundColor: ruleRequireFixed ? '#3B82F6' : '#CBD5E1', justifyContent: 'center', padding: 2}}
                  onPress={() => setRuleRequireFixed(!ruleRequireFixed)}
                >
                  <View style={{width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', alignSelf: ruleRequireFixed ? 'flex-end' : 'flex-start'}} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveRule} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>このルール・イベントを適用する</Text>}
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>適用中のルール・イベント一覧</Text>
            {territoryRules.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#94A3B8', marginVertical: 20}}>現在適用中のイベントや特殊ルールはありません</Text>
            ) : (
              territoryRules.map((r) => (
                <View key={r.id} style={styles.listItemRow}>
                  <View style={{flex: 1}}>
                    <View style={styles.row}>
                      <Text style={styles.listItemTitle}>{r.rule_name}</Text>
                    </View>
                    <View style={[styles.row, {flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 4}]}>
                      {r.require_fixed_card && <Text style={[styles.bannedBadge, {backgroundColor: '#DBEAFE', color: '#1D4ED8', marginLeft: 0}]}>固定カード必須</Text>}
                      {r.required_rarity && <Text style={[styles.bannedBadge, {backgroundColor: '#FEF3C7', color: '#D97706', marginLeft: 0}]}>{r.required_rarity}限定</Text>}
                      {(r.start_at || r.end_at) && <Text style={[styles.bannedBadge, {backgroundColor: '#DCFCE7', color: '#15803D', marginLeft: 0}]}>期間限定</Text>}
                    </View>
                    <Text style={styles.listItemSub}>対象エリア: {r.target_keyword}</Text>
                    {r.description && <Text style={[styles.listItemSub, {marginTop: 4, color: '#475569'}]}>{r.description}</Text>}
                    {(r.start_at || r.end_at) && (
                      <Text style={[styles.listItemSub, {marginTop: 4, fontSize: 11, color: '#94A3B8'}]}>
                        期間: {r.start_at ? new Date(r.start_at).toLocaleString() : '未指定'} 〜 {r.end_at ? new Date(r.end_at).toLocaleString() : '未指定'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity style={{padding: 10}} onPress={() => handleDeleteRule(r.id)} disabled={loading}>
                    <Trash2 color="#EF4444" size={24} />
                  </TouchableOpacity>
                </View>
              ))
            )}
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

            {mintDest === 'direct' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>直接配布 - 対象セグメント</Text>
                <Text style={styles.label}>性別</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity style={[styles.radioBtn, directTargetGender === 'ALL' && styles.activeRadio]} onPress={() => setDirectTargetGender('ALL')}><Text style={[styles.radioText, directTargetGender === 'ALL' && styles.activeRadioText]}>全員</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, directTargetGender === 'MALE' && styles.activeRadio]} onPress={() => setDirectTargetGender('MALE')}><Text style={[styles.radioText, directTargetGender === 'MALE' && styles.activeRadioText]}>男性のみ</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, directTargetGender === 'FEMALE' && styles.activeRadio]} onPress={() => setDirectTargetGender('FEMALE')}><Text style={[styles.radioText, directTargetGender === 'FEMALE' && styles.activeRadioText]}>女性のみ</Text></TouchableOpacity>
                </View>

                <Text style={styles.label}>年代</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity style={[styles.radioBtn, directTargetAge === 'ALL' && styles.activeRadio]} onPress={() => setDirectTargetAge('ALL')}><Text style={[styles.radioText, directTargetAge === 'ALL' && styles.activeRadioText]}>全年代</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, directTargetAge === 'TEENS' && styles.activeRadio]} onPress={() => setDirectTargetAge('TEENS')}><Text style={[styles.radioText, directTargetAge === 'TEENS' && styles.activeRadioText]}>10代</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, directTargetAge === 'TWENTIES' && styles.activeRadio]} onPress={() => setDirectTargetAge('TWENTIES')}><Text style={[styles.radioText, directTargetAge === 'TWENTIES' && styles.activeRadioText]}>20代</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.radioBtn, directTargetAge === 'THIRTIES' && styles.activeRadio]} onPress={() => setDirectTargetAge('THIRTIES')}><Text style={[styles.radioText, directTargetAge === 'THIRTIES' && styles.activeRadioText]}>30代以上</Text></TouchableOpacity>
                </View>

                <Text style={styles.label}>エリア (任意)</Text>
                <TextInput style={styles.input} value={directTargetLocation} onChangeText={setDirectTargetLocation} placeholder="例: 東京" />
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
              <Text style={styles.cardTitle}>🎲 ランダムボス自動出現 ＆ 大量発生(フェス)</Text>
              <Text style={{color:'#64748B', fontSize: 12, marginBottom: 12}}>
                自動出現のON/OFFや、座標ベース・全国・自治体ベースの出現範囲を設定できます。
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
                  <TouchableOpacity key={interval} style={[styles.radioBtn, randomBossInterval === interval && styles.activeRadio, {minWidth: '28%', marginBottom: 6}]} onPress={() => setRandomBossInterval(interval)}>
                    <Text style={[styles.radioText, randomBossInterval === interval && styles.activeRadioText]}>
                      {interval === '1h' ? '1時間毎' : interval === '3h' ? '3時間毎' : interval === '6h' ? '6時間毎' : interval === '12h' ? '12時間毎' : '24時間毎'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>出現範囲設定</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity style={[styles.radioBtn, spawnType === 'radius' && styles.activeRadio]} onPress={() => setSpawnType('radius')}>
                  <Text style={[styles.radioText, spawnType === 'radius' && styles.activeRadioText]}>座標基準</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, spawnType === 'municipality' && styles.activeRadio]} onPress={() => setSpawnType('municipality')}>
                  <Text style={[styles.radioText, spawnType === 'municipality' && styles.activeRadioText]}>自治体指定</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, spawnType === 'nationwide' && styles.activeRadio]} onPress={() => setSpawnType('nationwide')}>
                  <Text style={[styles.radioText, spawnType === 'nationwide' && styles.activeRadioText]}>全国ランダム</Text>
                </TouchableOpacity>
              </View>

              {spawnType === 'radius' && (
                <>
                  <Text style={styles.label}>基準座標 (緯度/経度)</Text>
                  <View style={styles.row}>
                    <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={baseLat} onChangeText={setBaseLat} placeholder="中心緯度" keyboardType="numeric" />
                    <TextInput style={[styles.input, {flex: 1}]} value={baseLng} onChangeText={setBaseLng} placeholder="中心経度" keyboardType="numeric" />
                  </View>
                </>
              )}

              {spawnType === 'municipality' && (
                <>
                  <Text style={styles.label}>対象自治体 (都道府県など)</Text>
                  <TextInput style={styles.input} value={targetMunicipality} onChangeText={setTargetMunicipality} placeholder="例: 東京都" />
                  <Text style={{fontSize: 11, color: '#94A3B8', marginTop: 4}}>※指定自治体の代表座標を基準にランダム配置されます。</Text>
                </>
              )}

              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#10B981', marginTop: 16}]} onPress={handleUpdateRandomBossConfig} disabled={loading}>
                <Text style={styles.primaryBtnText}>ランダム出現設定を保存</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              
              <View style={{backgroundColor: '#FFFBEB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A'}}>
                <Text style={[styles.cardTitle, {color: '#D97706', marginBottom: 8}]}>🔥 大量発生(フェス)モード ＆ 即時生成</Text>
                
                <View style={styles.row}>
                  <Text style={[styles.label, {flex: 1, marginTop: 0}]}>大量発生を有効化</Text>
                  <TouchableOpacity 
                    style={{width: 50, height: 28, borderRadius: 14, backgroundColor: isMassiveSpawn ? '#D97706' : '#CBD5E1', justifyContent: 'center', padding: 2}}
                    onPress={() => setIsMassiveSpawn(!isMassiveSpawn)}
                  >
                    <View style={{width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', alignSelf: isMassiveSpawn ? 'flex-end' : 'flex-start'}} />
                  </TouchableOpacity>
                </View>

                {isMassiveSpawn && (
                  <View style={{marginTop: 12}}>
                    <Text style={styles.label}>一度の発生数</Text>
                    <TextInput style={styles.input} value={massiveSpawnCount} onChangeText={setMassiveSpawnCount} placeholder="例: 50" keyboardType="numeric" />
                    <Text style={styles.label}>フェス期間 (任意)</Text>
                    <View style={styles.row}>
                      <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={massiveStartAt} onChangeText={setMassiveStartAt} placeholder="開始日時" />
                      <TextInput style={[styles.input, {flex: 1}]} value={massiveEndAt} onChangeText={setMassiveEndAt} placeholder="終了日時" />
                    </View>
                  </View>
                )}

                <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: isMassiveSpawn ? '#DC2626' : '#8B5CF6', marginTop: 16}]} onPress={triggerInstantRandomBoss} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{isMassiveSpawn ? `${massiveSpawnCount}体のボスをマップへ大量投下！` : '完全自動生成ボスを1体マップへ降臨'}</Text>}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>手動・協賛ボス固定配置マニュアル設定</Text>
              <Text style={styles.label}>ボス名 / 協賛名</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={bName} onChangeText={setBName} placeholder="ボス名" />
                <TextInput style={[styles.input, {flex: 1}]} value={bSponsorName} onChangeText={setBSponsorName} placeholder="協賛名" />
              </View>

              <Text style={styles.label}>出現期間 (空白で常時表示)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={bStartAt} onChangeText={setBStartAt} placeholder="開始日時 (ISO 例: 2026-06-20T12:00)" />
                <TextInput style={[styles.input, {flex: 1}]} value={bEndAt} onChangeText={setBEndAt} placeholder="終了日時 (ISO 例: 2026-06-21T12:00)" />
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

        {/* ===================== 8. WebAR制御 ===================== */}
        {activeTab === 'ar' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🚀 新規店舗・キャンペーン登録 ＆ QR発行</Text>
              <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>
                店舗やイベントごとにユニークなURLとQRコードを発行します。
              </Text>

              <Text style={styles.label}>店舗名 / キャンペーン名</Text>
              <TextInput style={styles.input} value={newShopName} onChangeText={setNewShopName} placeholder="例: 麺屋 飛龍" />

              <Text style={styles.label}>設置場所・メモ (任意)</Text>
              <View style={styles.row}>
                <MapPin color="#94A3B8" size={20} style={{position: 'absolute', left: 14, zIndex: 1}} />
                <TextInput style={[styles.input, {flex: 1, paddingLeft: 42}]} value={newShopLocation} onChangeText={setNewShopLocation} placeholder="例: 東京都立川市 レジ横POP" />
              </View>

              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#0F172A', marginTop: 16}]} onPress={handleGenerateShopQr} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>専用URLとQRコードを発行</Text>}
              </TouchableOpacity>

              {/* 💡 ここにアプリ復帰用（ディープリンク）の正しい呼び出し方の警告を明記 */}
              {generatedShopData && (
                <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981', marginBottom: 12 }}>✨ 登録完了！QRコードが生成されました</Text>
                  <Image source={{ uri: generatedShopData.qr }} style={{ width: 180, height: 180, marginBottom: 12 }} />
                  
                  <View style={{ width: '100%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold' }}>WebARアクセス用URL (NFCやブラウザ起動用)</Text>
                    <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 4 }} selectable>{generatedShopData.url}</Text>
                  </View>

                  <View style={{ width: '100%', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>⚠️ アプリへの正しい復帰URL（ディープリンク）</Text>
                    <Text style={{ fontSize: 13, color: '#B91C1C', marginTop: 4, fontWeight: 'bold' }} selectable>
                      myapp://ar-reward?promo_id={generatedShopData.id}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#7F1D1D', marginTop: 6, lineHeight: 14 }}>
                      ※不正取得防止のため、パラメータに is_win やステータス情報は絶対に付与しないでください。当たりハズレの判定やボス情報の取得は、アプリ側の useARRewardHandler 内で安全に処理されます。
                    </Text>
                  </View>

                  <View style={{ width: '100%', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold' }}>クライアントUUID (下の設定で自動セット済み)</Text>
                    <Text style={{ fontSize: 13, color: '#0F172A', marginTop: 4, fontWeight: '900' }} selectable>{generatedShopData.id}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>🌐 クライアント別 WebARオブジェクト＆報酬管理</Text>
              <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>
                発行したUUIDに対して、表示するオブジェクトや報酬内容（カード付与 / ボスバトル）を個別に設定します。
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

              <Text style={styles.label}>2. 操作対象の店舗UUID</Text>
              <TextInput style={styles.input} value={arTargetClientId} onChangeText={setArTargetClientId} placeholder="promo_links テーブルの UUID を指定" disabled={arClientType === 'global'} autoCapitalize="none" />

              <Text style={styles.label}>3. トリガーマーカーのアップロード（.mind または 画像）</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#8B5CF6', marginTop: 8, marginBottom: 12 }]} onPress={() => handleUploadArMarker(arTargetClientId)} disabled={loading || arClientType === 'global'}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>🎯 マーカーファイルを選択して紐付け</Text>}
              </TouchableOpacity>

              {arMarkerCustomUrl ? (
                <View style={{ backgroundColor: '#F5F3FF', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#6D28D9', fontWeight: 'bold' }}>🔗 反映中のマーカーURL:</Text>
                  <Text style={{ fontSize: 11, color: '#4C1D95', marginTop: 4 }} numberOfLines={2}>{arMarkerCustomUrl}</Text>
                </View>
              ) : null}

              <View style={styles.divider} />

              <Text style={[styles.cardTitle, {fontSize: 16, color: '#D97706'}]}><Gift color="#D97706" size={16} style={{top:3}} /> 4. インセンティブ＆アセット設定</Text>
              
              <View style={[styles.radioGroup, {marginBottom: 16}]}>
                <TouchableOpacity style={[styles.radioBtn, arRewardType === 'card' && styles.activeRadio]} onPress={() => setArRewardType('card')}>
                  <Text style={[styles.radioText, arRewardType === 'card' && styles.activeRadioText]}>🎴 確率でカード付与</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, arRewardType === 'boss' && styles.activeRadio]} onPress={() => setArRewardType('boss')}>
                  <Text style={[styles.radioText, arRewardType === 'boss' && styles.activeRadioText]}>⚔️ ボス出現(バトル)</Text>
                </TouchableOpacity>
              </View>

              {arRewardType === 'card' ? (
                <>
                  {/* --- カード付与モードのUI --- */}
                  <View style={{backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16}}>
                    <Text style={styles.label}>ハズレ（通常時）の表示オブジェクト ＆ カードステータス</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity style={[styles.radioBtn, arAssetMode === 'upload' && styles.activeRadio]} onPress={() => setArAssetMode('upload')}><Text style={styles.radioText}>アップロード</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.radioBtn, arAssetMode === 'ai' && styles.activeRadio]} onPress={() => setArAssetMode('ai')}><Text style={styles.radioText}>AI生成</Text></TouchableOpacity>
                    </View>
                    {arAssetMode === 'upload' ? (
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#475569', marginTop: 0 }]} onPress={() => handleUploadArAsset(arTargetClientId, 'base')} disabled={loading || arClientType === 'global'}>
                        <Text style={styles.primaryBtnText}>📁 通常オブジェクトをアップロード</Text>
                      </TouchableOpacity>
                    ) : (
                      <View>
                        <TextInput style={[styles.input, {marginBottom: 8}]} value={arAssetAiPrompt} onChangeText={setArAssetAiPrompt} placeholder="AI画像生成プロンプトを入力..." />
                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#475569', marginTop: 0 }]} onPress={() => handleGenerateArAssetAi('base')} disabled={loading || arClientType === 'global'}>
                          <Text style={styles.primaryBtnText}><Sparkles color="#FFF" size={16}/> AIでアセットを生成する</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {arAssetCustomUrl ? <Text style={{fontSize:11, color:'#475569', marginTop: 8}} numberOfLines={1}>登録済: {arAssetCustomUrl}</Text> : null}
                    
                    <View style={{marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#E2E8F0'}}>
                      <Text style={{fontSize: 12, color: '#475569', fontWeight: 'bold', marginBottom: 6}}>付与されるカードのステータス設定</Text>
                      <View style={styles.row}>
                        <TextInput style={[styles.input, {flex: 2, marginRight: 4, height: 40, fontSize: 13}]} value={arAssetName} onChangeText={setArAssetName} placeholder="カード名" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13}]} value={arAssetRarity} onChangeText={setArAssetRarity} placeholder="レア" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13}]} value={arAssetAttr} onChangeText={setArAssetAttr} placeholder="属性" />
                      </View>
                      <View style={[styles.row, {marginTop: 6}]}>
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13}]} value={arAssetHp} onChangeText={setArAssetHp} placeholder="HP" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13}]} value={arAssetAtk} onChangeText={setArAssetAtk} placeholder="ATK" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13}]} value={arAssetDef} onChangeText={setArAssetDef} placeholder="DEF" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13}]} value={arAssetSpd} onChangeText={setArAssetSpd} placeholder="SPD" keyboardType="numeric" />
                      </View>
                    </View>
                  </View>

                  <View style={{backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16}}>
                    <Text style={styles.label}>🎉 当たり（当選時）の表示オブジェクト ＆ カードステータス</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity style={[styles.radioBtn, arWinAssetMode === 'upload' && styles.activeRadio]} onPress={() => setArWinAssetMode('upload')}><Text style={styles.radioText}>アップロード</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.radioBtn, arWinAssetMode === 'ai' && styles.activeRadio]} onPress={() => setArWinAssetMode('ai')}><Text style={styles.radioText}>AI生成</Text></TouchableOpacity>
                    </View>
                    {arWinAssetMode === 'upload' ? (
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#D97706', marginTop: 0 }]} onPress={() => handleUploadArAsset(arTargetClientId, 'win')} disabled={loading || arClientType === 'global'}>
                        <Text style={styles.primaryBtnText}>🎁 当たりオブジェクトをアップロード</Text>
                      </TouchableOpacity>
                    ) : (
                      <View>
                        <TextInput style={[styles.input, {marginBottom: 8}]} value={arWinAssetAiPrompt} onChangeText={setArWinAssetAiPrompt} placeholder="AI画像生成プロンプトを入力..." />
                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#D97706', marginTop: 0 }]} onPress={() => handleGenerateArAssetAi('win')} disabled={loading || arClientType === 'global'}>
                          <Text style={styles.primaryBtnText}><Sparkles color="#FFF" size={16}/> AIで当たりアセットを生成</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {arWinAssetUrl ? <Text style={{fontSize:11, color:'#D97706', marginTop: 8}} numberOfLines={1}>登録済: {arWinAssetUrl}</Text> : null}

                    <View style={{marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#FDE68A'}}>
                      <Text style={{fontSize: 12, color: '#D97706', fontWeight: 'bold', marginBottom: 6}}>付与されるレアカードのステータス設定</Text>
                      <View style={styles.row}>
                        <TextInput style={[styles.input, {flex: 2, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetName} onChangeText={setArWinAssetName} placeholder="レアカード名" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetRarity} onChangeText={setArWinAssetRarity} placeholder="レア" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetAttr} onChangeText={setArWinAssetAttr} placeholder="属性" />
                      </View>
                      <View style={[styles.row, {marginTop: 6}]}>
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetHp} onChangeText={setArWinAssetHp} placeholder="HP" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetAtk} onChangeText={setArWinAssetAtk} placeholder="ATK" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetDef} onChangeText={setArWinAssetDef} placeholder="DEF" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetSpd} onChangeText={setArWinAssetSpd} placeholder="SPD" keyboardType="numeric" />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>💡 クーポン当選確率（0.0 〜 1.0）</Text>
                  <TextInput style={styles.input} value={arWinRate} onChangeText={setArWinRate} placeholder="例: 0.1 (10%)" keyboardType="numeric" />
                </>
              ) : (
                <>
                  {/* --- ボスバトルモードのUI --- */}
                  <View style={{backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', marginBottom: 16}}>
                    <Text style={[styles.label, {color: '#B91C1C'}]}><Swords color="#B91C1C" size={16} style={{top: 2}}/> ボスの表示オブジェクト ＆ ステータス</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity style={[styles.radioBtn, arBossMode === 'upload' && styles.activeRadio]} onPress={() => setArBossMode('upload')}><Text style={styles.radioText}>アップロード</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.radioBtn, arBossMode === 'ai' && styles.activeRadio]} onPress={() => setArBossMode('ai')}><Text style={styles.radioText}>AI生成</Text></TouchableOpacity>
                    </View>
                    {arBossMode === 'upload' ? (
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#DC2626', marginTop: 0 }]} onPress={() => handleUploadArAsset(arTargetClientId, 'boss')} disabled={loading || arClientType === 'global'}>
                        <Text style={styles.primaryBtnText}>📁 ボスオブジェクトをアップロード</Text>
                      </TouchableOpacity>
                    ) : (
                      <View>
                        <TextInput style={[styles.input, {marginBottom: 8}]} value={arBossAiPrompt} onChangeText={setArBossAiPrompt} placeholder="AI画像生成プロンプトを入力..." />
                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#DC2626', marginTop: 0 }]} onPress={() => handleGenerateArAssetAi('boss')} disabled={loading || arClientType === 'global'}>
                          <Text style={styles.primaryBtnText}><Sparkles color="#FFF" size={16}/> AIでボスアセットを生成する</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {arBossImageUrl ? <Text style={{fontSize:11, color:'#DC2626', marginTop: 8}} numberOfLines={1}>登録済: {arBossImageUrl}</Text> : null}

                    <View style={{marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#FECACA'}}>
                      <Text style={{fontSize: 12, color: '#DC2626', fontWeight: 'bold', marginBottom: 6}}>ボスのステータス設定</Text>
                      <View style={styles.row}>
                        <TextInput style={[styles.input, {flex: 2, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arBossName} onChangeText={setArBossName} placeholder="ボス名" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arBossElement} onChangeText={setArBossElement} placeholder="属性" />
                      </View>
                      <View style={[styles.row, {marginTop: 6}]}>
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arBossHp} onChangeText={setArBossHp} placeholder="HP" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arBossAtk} onChangeText={setArBossAtk} placeholder="ATK" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arBossDef} onChangeText={setArBossDef} placeholder="DEF" keyboardType="numeric" />
                      </View>
                    </View>
                  </View>

                  {/* 🌟 追加：ボス討伐報酬カードの設定UI */}
                  <View style={{backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 16}}>
                    <Text style={[styles.label, {color: '#15803D'}]}><Gift color="#15803D" size={16} style={{top: 2}}/> ボス討伐報酬カードの画像 ＆ ステータス</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity style={[styles.radioBtn, arWinAssetMode === 'upload' && styles.activeRadio]} onPress={() => setArWinAssetMode('upload')}><Text style={styles.radioText}>アップロード</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.radioBtn, arWinAssetMode === 'ai' && styles.activeRadio]} onPress={() => setArWinAssetMode('ai')}><Text style={styles.radioText}>AI生成</Text></TouchableOpacity>
                    </View>
                    {arWinAssetMode === 'upload' ? (
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#10B981', marginTop: 0 }]} onPress={() => handleUploadArAsset(arTargetClientId, 'win')} disabled={loading || arClientType === 'global'}>
                        <Text style={styles.primaryBtnText}>📁 報酬カード画像をアップロード</Text>
                      </TouchableOpacity>
                    ) : (
                      <View>
                        <TextInput style={[styles.input, {marginBottom: 8}]} value={arWinAssetAiPrompt} onChangeText={setArWinAssetAiPrompt} placeholder="AI画像生成プロンプトを入力..." />
                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: arClientType === 'global' ? '#94A3B8' : '#10B981', marginTop: 0 }]} onPress={() => handleGenerateArAssetAi('win')} disabled={loading || arClientType === 'global'}>
                          <Text style={styles.primaryBtnText}><Sparkles color="#FFF" size={16}/> AIで報酬カード画像を生成</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {arWinAssetUrl ? <Text style={{fontSize:11, color:'#10B981', marginTop: 8}} numberOfLines={1}>登録済: {arWinAssetUrl}</Text> : null}

                    <View style={{marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#BBF7D0'}}>
                      <Text style={{fontSize: 12, color: '#166534', fontWeight: 'bold', marginBottom: 6}}>報酬カードのステータス設定</Text>
                      <View style={styles.row}>
                        <TextInput style={[styles.input, {flex: 2, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetName} onChangeText={setArWinAssetName} placeholder="カード名" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetRarity} onChangeText={setArWinAssetRarity} placeholder="レア" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetAttr} onChangeText={setArWinAssetAttr} placeholder="属性" />
                      </View>
                      <View style={[styles.row, {marginTop: 6}]}>
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetHp} onChangeText={setArWinAssetHp} placeholder="HP" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetAtk} onChangeText={setArWinAssetAtk} placeholder="ATK" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, marginRight: 4, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetDef} onChangeText={setArWinAssetDef} placeholder="DEF" keyboardType="numeric" />
                        <TextInput style={[styles.input, {flex: 1, height: 40, fontSize: 13, backgroundColor: '#FFF'}]} value={arWinAssetSpd} onChangeText={setArWinAssetSpd} placeholder="SPD" keyboardType="numeric" />
                      </View>
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.label}>{arRewardType === 'card' ? '当たり（当選時）のボタンアクション文言' : 'ボス出現時のボタンアクション文言'}</Text>
              <TextInput style={styles.input} value={arActionTextWin} onChangeText={setArActionTextWin} placeholder={arRewardType === 'card' ? "例: ギョーザ無料券と限定カードをGET！" : "例: ボスに挑戦する！"} />

              <Text style={styles.label}>{arRewardType === 'card' ? '通常時（ハズレ時）のボタンアクション文言' : 'ボスから逃げる時のボタンアクション文言(任意)'}</Text>
              <TextInput style={styles.input} value={arActionText} onChangeText={setArActionText} placeholder="例: 限定カードをGET！" />

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

              <Text style={[styles.label, {marginTop: 8}]}>実装時期</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity style={[styles.radioBtn, arDeployMode === 'immediate' && styles.activeRadio]} onPress={() => setArDeployMode('immediate')}>
                  <Text style={[styles.radioText, arDeployMode === 'immediate' && styles.activeRadioText]}>即時反映</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, arDeployMode === 'scheduled' && styles.activeRadio]} onPress={() => setArDeployMode('scheduled')}>
                  <Text style={[styles.radioText, arDeployMode === 'scheduled' && styles.activeRadioText]}>スケジュール</Text>
                </TouchableOpacity>
              </View>
              {arDeployMode === 'scheduled' && (
                <TextInput style={[styles.input, {marginTop: 8}]} value={arScheduledAt} onChangeText={setArScheduledAt} placeholder="実行日時 (ISO 例: 2026-06-20T12:00)" />
              )}

              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#3B82F6', marginTop: 20, flexDirection: 'row', justifyContent: 'center'}]} onPress={handlePreviewAr}>
                <PlayCircle color="#FFF" size={20} style={{marginRight: 8}} />
                <Text style={styles.primaryBtnText}>本番反映前にブラウザでプレビュー確認</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#EC4899', marginTop: 12}]} onPress={handleUpdateArConfig} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>この構成をWebAR店舗データに本番同期</Text>}
              </TouchableOpacity>
            </View>
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
            <Text style={styles.cardTitle}>データベース拡張 (属性 / 相性 / レアリティ)</Text>
            <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>システムに新しい属性や相性、レアリティを追加・更新します。</Text>
            
            <Text style={styles.label}>現在の属性一覧</Text>
            <Text style={styles.listItemSub}>{elementsList.join(' / ')}</Text>
            
            <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 12 }}>■ 新しい属性の追加 / 既存属性の相性更新</Text>
              
              <TextInput 
                style={[styles.input, {marginBottom: 12}]} 
                value={newElement} 
                onChangeText={setNewElement} 
                placeholder="属性名 (例: 毒)" 
                placeholderTextColor="#94A3B8"
              />
              
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4, marginLeft: 2 }}>この属性が有利（ダメージ1.5倍）な属性をカンマ区切りで入力</Text>
              <TextInput 
                style={[styles.input, {marginBottom: 12, borderColor: '#FDA4AF'}]} 
                value={strongAgainstInput} 
                onChangeText={setStrongAgainstInput} 
                placeholder="例: 水, 光, 機械" 
                placeholderTextColor="#94A3B8"
              />
              
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4, marginLeft: 2 }}>この属性が不利（ダメージ0.5倍）な属性をカンマ区切りで入力</Text>
              <TextInput 
                style={[styles.input, {marginBottom: 16, borderColor: '#93C5FD'}]} 
                value={weakAgainstInput} 
                onChangeText={setWeakAgainstInput} 
                placeholder="例: 火, 虚無" 
                placeholderTextColor="#94A3B8"
              />
              
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddElementRelation} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>属性と相性を保存</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>現在のレアリティ一覧</Text>
            <Text style={styles.listItemSub}>{raritiesList.join(' / ')}</Text>
            <View style={[styles.row, {marginTop: 8}]}>
              <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={newRarity} onChangeText={setNewRarity} placeholder="新しいレアを追加 (例: EX)" />
              <TouchableOpacity style={[styles.primaryBtn, {marginTop: 0, paddingVertical: 14}]} onPress={() => handleAddMaster('rarity')} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>追加</Text>}
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