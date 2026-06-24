import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView, Platform, FlatList, Image } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { ShieldAlert, Trophy, Activity, Swords, Map as MapIcon, Flag, Zap, X, MapPin, Clock } from 'lucide-react-native';

// Web環境でのクラッシュを防ぐ動的インポート
let MapView: any;
let Marker: any;
let Polygon: any;
let PROVIDER_GOOGLE: any;
let WebView: any;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polygon = Maps.Polygon;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  WebView = require('react-native-webview').WebView;
} else {
  MapView = ({ children }: any) => (
    <View style={styles.webMapFallback}>
      <MapIcon color="#64748B" size={32} style={{ marginBottom: 8 }} />
      <Text style={{ color: '#64748B', fontWeight: 'bold' }}>Web版ではマップを表示できません</Text>
      <View style={{ display: 'none' }}>{children}</View>
    </View>
  );
  Marker = ({ children }: any) => <View>{children}</View>;
  Polygon = () => <View />;
  WebView = () => (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#FFFFFF' }}>Web版ではARを表示できません</Text>
    </View>
  );
}

// 属性相性テーブル
const ELEMENT_RELATIONS: Record<string, { strong: string[], weak: string[] }> = {
  '火': { strong: ['木', 'サイバー', 'プラスチック'], weak: ['水', '黄金', '虚無'] },
  '水': { strong: ['火', '黄金', '資本'], weak: ['雷', 'プラスチック', '大気汚染'] },
  '雷': { strong: ['水', 'サイバー', '機械'], weak: ['木', '虚無', '時間'] },
  'サイバー': { strong: ['資本', 'プラスチック', '時間'], weak: ['火', '雷', '混沌'] },
  '資本': { strong: ['社畜', '黄金', '火'], weak: ['サイバー', '光', '虚無'] },
  'カフェイン': { strong: ['社畜', 'サイバー', '雷'], weak: ['水', '虚無', '時間'] },
  '社畜': { strong: ['資本', 'プラスチック', '火'], weak: ['カフェイン', '混沌', '光'] },
  '虚無': { strong: ['火', '雷', '資本'], weak: ['光', '量子', '時間'] },
};

function getDamageMultiplier(attackerEl: string, defenderEl: string): { multiplier: number, label: string } {
  const relation = ELEMENT_RELATIONS[attackerEl];
  if (!relation) return { multiplier: 1.0, label: '' }; 
  if (relation.strong.includes(defenderEl)) return { multiplier: 1.5, label: '💥【有利】' }; 
  if (relation.weak.includes(defenderEl)) return { multiplier: 0.5, label: '🛡️【不利】' };
  return { multiplier: 1.0, label: '' };
}

// 🌟 マップのカスタムスタイル（表示変更用）
const BOSS_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#241010" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8f5a5a" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#241010" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#4a1c1c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0a0202" }] }
];

const TERRITORY_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#0d1b2a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#778da9" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1b263b" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

// 🌟 HSLカラーをHSLA(透明度付き)に変換するヘルパー
const makeHsla = (color: string | null, alpha: number) => {
  if (!color) return null;
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  if (color.startsWith('#')) {
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `${color}${alphaHex}`;
  }
  return color;
};

export default function BattleScreen() {
  const mapRef = useRef<any>(null); // 🌟 マップ制御用のRefを追加
  const [myId, setMyId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null); // 🌟 所属チーム情報
  const [playerStats, setPlayerStats] = useState({ totalWins: 0, bossDefeats: 0 });
  const [battleLog, setBattleLog] = useState<any[]>([]);
  const [isBattling, setIsBattling] = useState(false);
  
  // マップ・ボス・GPS関連
  const [loadingMap, setLoadingMap] = useState(false);
  const [detectedBoss, setDetectedBoss] = useState<any>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('現在地を取得中...');
  const [currentPostalCode, setCurrentPostalCode] = useState<string>('');
  const [mapMode, setMapMode] = useState<'normal' | 'boss' | 'territory'>('normal'); // 🌟 マップの表示モード
  
  // 陣取り関連
  const [territories, setTerritories] = useState<any[]>([]);
  const [startPoint, setStartPoint] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isTerritoryModalVisible, setTerritoryModalVisible] = useState(false);
  const [isAttackModalVisible, setAttackModalVisible] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  
  const [myHighRareCards, setMyHighRareCards] = useState<any[]>([]);
  const [selectedSacrifices, setSelectedSacrifices] = useState<string[]>([]);
  
  // 特殊ルール（協賛カード限定エリア等）
  const [activeRule, setActiveRule] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useFocusEffect(
    useCallback(() => { initBattleData(); }, [])
  );

  const initBattleData = async () => {
    setLoadingMap(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        setMyProfile(profile);
        setPlayerStats({ totalWins: profile.total_wins, bossDefeats: profile.boss_defeats });
      }

      // 🌟 チーム情報の取得（陣地の色分け・登録用）
      const { data: memberData } = await supabase
        .from('team_members')
        .select('*, teams(*)')
        .eq('player_id', user.id)
        .eq('status', 'approved')
        .single();
      if (memberData && memberData.teams) {
        setMyTeam(memberData.teams);
      }

      const { data: cards } = await supabase.from('cards')
        .select('*')
        .eq('player_id', user.id)
        .eq('is_active', true)
        .or('level.gte.5,status_total.gte.300,is_fixed.eq.true'); 
      if (cards) setMyHighRareCards(cards);
    }
    await checkLocationAndFetchData();
    setLoadingMap(false);
  };

  const checkLocationAndFetchData = async () => {
    try {
      const locationPerm = await Location.requestForegroundPermissionsAsync();
      if (!locationPerm.granted) return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });

      // 1. 逆ジオコーディング（住所取得）
      let addressString = '不明なエリア';
      let postal = '';
      if (Platform.OS !== 'web') {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode.length > 0) {
          const g = geocode[0];
          postal = g.postalCode || '';
          addressString = `${g.region || ''}${g.city || ''}${g.street || ''}`;
          if (addressString === '') addressString = '詳細不明なエリア';
          setCurrentAddress(addressString);
          setCurrentPostalCode(postal);
        }
      }

      // 2. 特殊ルールの判定
      await evaluateSpecialRules(addressString, postal);

      // 3. ボス検知
      const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true).not('target_lat', 'is', null);
      let foundBoss = null;
      if (campaigns) {
        const nearbyCampaign = campaigns.find((c: any) => getDistance(latitude, longitude, c.target_lat, c.target_lng) <= (c.radius_meters || 100));
        if (nearbyCampaign) {
          const { data: boss } = await supabase.from('bosses').select('*, fixed_cards(*)').eq('trigger_campaign_id', nearbyCampaign.id).single();
          if (boss) foundBoss = { ...boss, campaign_title: nearbyCampaign.title, sponsor_name: nearbyCampaign.sponsor_name, lat: nearbyCampaign.target_lat, lng: nearbyCampaign.target_lng, element: boss.element || '火' };
        }
      }
      setDetectedBoss(foundBoss);

      // 4. 周辺の陣地取得
      const { data: terrData } = await supabase.from('territories').select('*').order('created_at', { ascending: false }).limit(50);
      if (terrData) setTerritories(terrData);

      // 🌟 カメラと表示モードの自動調整（ピンチアウト阻害を防ぐため animateToRegion を使用）
      if (foundBoss) {
        setMapMode('boss');
        // ボスがいる場合は少し広域を見せる
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 1000);
      } else {
        setMapMode('normal');
        // 平常時は現在地付近をズーム（初回のみ）
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
      }

    } catch (e) { console.log("Map Fetch Error:", e); }
  };

  const evaluateSpecialRules = async (address: string, postal: string) => {
    try {
      const { data: rules } = await supabase.from('territory_rules').select('*').eq('is_active', true);
      if (!rules) return;

      const now = new Date();
      const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

      const matchedRule = rules.find((rule: any) => {
        const matchLocation = address.includes(rule.target_keyword) || postal.includes(rule.target_keyword);
        if (!matchLocation) return false;
        if (rule.start_time && rule.end_time) {
          return currentTimeString >= rule.start_time && currentTimeString <= rule.end_time;
        }
        return true;
      });
      setActiveRule(matchedRule || null);
    } catch (e) { console.log("Rule Evaluation Error"); }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  // ==========================================
  // 🗺️ 陣取り（テリトリー）アクション
  // ==========================================
  const markStartPoint = () => {
    if (!currentLocation) return;
    setStartPoint({ lat: currentLocation.lat, lng: currentLocation.lng, address: currentAddress });
    
    // 🌟 陣取り開始時にマップスタイルを変更し、カメラを引いて領域を見やすくする
    setMapMode('territory');
    mapRef.current?.animateToRegion({ 
      latitude: currentLocation.lat, longitude: currentLocation.lng, 
      latitudeDelta: 0.02, longitudeDelta: 0.02 
    }, 1000);

    Alert.alert('起点マーカー設置', `「${currentAddress}」を起点として記録しました。別の場所に移動して陣地を展開してください。`);
  };

  const cancelStartPoint = () => {
    setStartPoint(null);
    setMapMode(detectedBoss ? 'boss' : 'normal');
    if (currentLocation) {
      mapRef.current?.animateToRegion({ 
        latitude: currentLocation.lat, longitude: currentLocation.lng, 
        latitudeDelta: detectedBoss ? 0.02 : 0.005, longitudeDelta: detectedBoss ? 0.02 : 0.005 
      }, 1000);
    }
  };

  const openTerritoryModal = () => {
    if (!startPoint || !currentLocation) return;
    const dist = getDistance(startPoint.lat, startPoint.lng, currentLocation.lat, currentLocation.lng);
    if (dist < 5) {
      Alert.alert('距離が近すぎます', '開始位置から最低5メートルは離れてください。');
      return;
    }
    setSelectedSacrifices([]);
    setTerritoryModalVisible(true);
  };

  const confirmTerritoryCreation = async () => {
    if (selectedSacrifices.length !== 2) {
      Alert.alert('エラー', '捧げるカードを「2枚」選んでください。');
      return;
    }
    const card1 = myHighRareCards.find(c => c.id === selectedSacrifices[0]);
    const card2 = myHighRareCards.find(c => c.id === selectedSacrifices[1]);
    const totalDefense = card1.status_total + card2.status_total;

    Alert.alert(
      "陣地の展開", 
      `「${startPoint?.address}」〜「${currentAddress}」を含む領域を制圧し、防衛力[${totalDefense}]の陣地を展開しますか？\n※捧げたカードは手持ちから消滅します。`,
      [
        { text: "キャンセル", style: "cancel" },
        { text: "生贄に捧げる", style: "destructive", onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').insert([{
                player_id: myId,
                player_name: myProfile?.player_name || '匿名エージェント',
                // 🌟 チーム情報を保存してマップで色分けできるようにする
                team_id: myTeam?.id || null,
                team_name: myTeam?.name || '',
                team_color: myTeam?.team_color || '',
                start_lat: startPoint?.lat, start_lng: startPoint?.lng,
                end_lat: currentLocation?.lat, end_lng: currentLocation?.lng,
                start_address: startPoint?.address,
                end_address: currentAddress,
                defense_power: totalDefense,
                card1_name: card1.card_name, card2_name: card2.card_name
              }]);
              await supabase.from('cards').update({ is_active: false }).in('id', selectedSacrifices);
              Alert.alert('展開完了', '強大な陣地をマップ上に展開しました！');
              setTerritoryModalVisible(false);
              cancelStartPoint(); // モードとカメラを元に戻す
              initBattleData();
            } catch (err) { Alert.alert('エラー', '通信に失敗しました。'); }
            setLoadingMap(false);
        }}
      ]
    );
  };

  const handleTerritoryPress = (territory: any) => {
    setSelectedTerritory(territory);
    setSelectedSacrifices([]);
    setAttackModalVisible(true);
  };

  const overwriteTerritory = async () => {
    if (selectedSacrifices.length !== 2) return;
    const c1 = myHighRareCards.find(c => c.id === selectedSacrifices[0]);
    const c2 = myHighRareCards.find(c => c.id === selectedSacrifices[1]);
    const myAttackPower = c1.status_total + c2.status_total;

    if (myAttackPower <= selectedTerritory.defense_power) {
      Alert.alert('戦力不足', `相手の防衛力[${selectedTerritory.defense_power}]に対し、あなたの戦力は[${myAttackPower}]です。`);
      return;
    }

    Alert.alert(
      "圧倒的制圧", 
      `この陣地を無血開城させますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        { text: "強奪する", style: "destructive", onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').update({
                player_id: myId, player_name: myProfile?.player_name || '匿名',
                // 🌟 上書き時に自分のチームカラーで染め上げる
                team_id: myTeam?.id || null,
                team_name: myTeam?.name || '',
                team_color: myTeam?.team_color || '',
                defense_power: myAttackPower,
                card1_name: c1.card_name, card2_name: c2.card_name
              }).eq('id', selectedTerritory.id);
              await supabase.from('cards').update({ is_active: false }).in('id', selectedSacrifices);
              Alert.alert('制圧完了', '陣地を奪い取りました！');
              setAttackModalVisible(false);
              initBattleData();
            } catch(e) {}
            setLoadingMap(false);
        }}
      ]
    );
  };

  const attackTerritoryByBattle = async () => {
    setAttackModalVisible(false);
    setIsBattling(true); setBattleLog([]);
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).single();
    if (!myCard) { Alert.alert('出撃不可', '出撃カードがありません。'); setIsBattling(false); return; }

    const defStats = Math.floor(selectedTerritory.defense_power / 4);
    const bossMonster = { 
      id: 'TERRITORY_DEF', card_name: `【防衛結界】${selectedTerritory.card1_name} & ${selectedTerritory.card2_name}`, 
      skill_name: '絶対防壁', status_hp: defStats * 2, status_atk: defStats, status_def: defStats, status_spd: 50, 
      level: 10, rarity: '🏰', element: '虚無'
    };
    
    simulateBattle(myCard, bossMonster, false, async (isWin) => {
      if (isWin) {
        await supabase.from('territories').delete().eq('id', selectedTerritory.id);
        Alert.alert("結界破壊！", "見事バトルに勝利し、相手の陣地を破壊しました！");
        initBattleData();
      } else { Alert.alert("敗北", "防衛結界の前に敗れ去りました..."); }
    });
  };

  // ==========================================
  // ⚔️ 既存バトルシステム
  // ==========================================
  const startPvpBattle = async () => {
    setIsBattling(true); setBattleLog([]);
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).single();
    if (!myCard) { setIsBattling(false); return; }
    
    const minS = Math.floor(myCard.status_total * 0.75);
    const maxS = Math.floor(myCard.status_total * 1.25);
    const { data: oppCards } = await supabase.from('cards').select('*').neq('player_id', myId).eq('is_active', true).gte('status_total', minS).lte('status_total', maxS).limit(10);
    if (!oppCards || oppCards.length === 0) { Alert.alert('索敵中', '同格のライバルが見つかりませんでした。'); setIsBattling(false); return; }
    
    const oppCard = oppCards[Math.floor(Math.random() * oppCards.length)];
    simulateBattle(myCard, oppCard, false, async (isWin) => {
      if (isWin) {
        const newWins = playerStats.totalWins + 1;
        await supabase.from('profiles').update({ total_wins: newWins }).eq('id', myId);
        setPlayerStats(prev => ({ ...prev, totalWins: newWins }));
        await supabase.rpc('gain_card_exp', { target_card_id: myCard.id, exp_to_add: 120 });
      } else {
        await supabase.rpc('gain_card_exp', { target_card_id: myCard.id, exp_to_add: 30 });
      }
    });
  };

  const startBossBattle = async () => {
    if (!detectedBoss) return;
    setIsBattling(true); setBattleLog([]);
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).single();
    if (!myCard) { setIsBattling(false); return; }
    
    const bossMonster = { 
      id: 'BOSS', card_name: `【エリアボス】${detectedBoss.name}`, skill_name: 'カタストロフィ', 
      status_hp: detectedBoss.hp, status_atk: detectedBoss.atk, status_def: detectedBoss.def, status_spd: 40, 
      level: 10, rarity: '👑', element: detectedBoss.element || '闇'
    };
    
    simulateBattle(myCard, bossMonster, true, async (isWin) => {
      if (isWin) {
        const newDefs = playerStats.bossDefeats + 1;
        await supabase.from('profiles').update({ boss_defeats: newDefs }).eq('id', myId);
        setPlayerStats(prev => ({ ...prev, bossDefeats: newDefs }));
        const reward = detectedBoss.fixed_cards;
        if(reward) await supabase.from('cards').insert([{ player_id: myId, card_name: reward.card_name, image_url: reward.image_url, status_total: reward.stats.hp + reward.stats.atk + reward.stats.def + reward.stats.spd, rarity: "P", is_fixed: true, element: detectedBoss.element }]);
        Alert.alert("👹 ボス討伐！", `限定カードを獲得！`);
      }
    });
  };

  const simulateBattle = (p1: any, p2: any, isBossMode: boolean, callback: (isWin: boolean) => void) => {
    let log: any[] = [];
    log.push({ text: `🏁 【BATTLE START】\n${p1.card_name} [${p1.element || '無'}] VS ${p2.card_name} [${p2.element || '無'}]`, isSpecial: true });
    
    let first = p1.status_spd >= p2.status_spd ? p1 : p2;
    let second = p1.status_spd >= p2.status_spd ? p2 : p1;
    let winner = null;
    let p1Hp = p1.status_hp; let p2Hp = p2.status_hp;

    for (let turn = 1; turn <= 5; turn++) {
      const res1 = getDamageMultiplier(first.element || '無', second.element || '無');
      let dmg1 = Math.floor((Math.max(1, first.status_atk - Math.floor(second.status_def / 2)) + Math.floor(Math.random() * 10)) * res1.multiplier);
      if (first === p1) p2Hp -= dmg1; else p1Hp -= dmg1;
      log.push({ text: `[T-${turn}] ${first.card_name}の攻撃！\n${dmg1} のダメージ！${res1.label}`, isSpecial: false });
      if (p1Hp <= 0 || p2Hp <= 0) { winner = p1Hp <= 0 ? p2 : p1; break; }

      const res2 = getDamageMultiplier(second.element || '無', first.element || '無');
      let dmg2 = Math.floor((Math.max(1, second.status_atk - Math.floor(first.status_def / 2)) + Math.floor(Math.random() * 10)) * res2.multiplier);
      if (second === p1) p2Hp -= dmg2; else p1Hp -= dmg2;
      log.push({ text: `[T-${turn}] ${second.card_name}の攻撃！\n${dmg2} のダメージ！${res2.label}`, isSpecial: false });
      if (p1Hp <= 0 || p2Hp <= 0) { winner = p1Hp <= 0 ? p2 : p1; break; }
    }

    if (!winner) log.push({ text: "⏳ 規定ターン経過。引き分け。", isSpecial: false });
    else log.push({ text: `🏆 決着！ 勝者：${winner.card_name}！`, isSpecial: true });
    
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < log.length) { setBattleLog(prev => [...prev, log[currentLogIndex]]); currentLogIndex++; }
      else { clearInterval(interval); setIsBattling(false); callback(winner === p1); }
    }, 800);
  };

  const toggleSacrifice = (item: any) => {
    if (activeRule && activeRule.require_fixed_card && !item.is_fixed) {
      Alert.alert('ルール違反', `現在このエリアは「${activeRule.rule_name}」の対象です。陣取りには特別な「協賛カード等」が必要です。`);
      return;
    }
    if (selectedSacrifices.includes(item.id)) {
      setSelectedSacrifices(prev => prev.filter(i => i !== item.id));
    } else {
      if (selectedSacrifices.length >= 2) Alert.alert('制限', '選べる生贄は2枚までです。');
      else setSelectedSacrifices(prev => [...prev, item.id]);
    }
  };

  // 🌟 現在のモードに応じたマップスタイルを取得
  const getMapStyle = () => {
    if (mapMode === 'boss') return BOSS_MAP_STYLE;
    if (mapMode === 'territory') return TERRITORY_MAP_STYLE;
    return [];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.addressHeader}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MapPin color="#64748B" size={14} style={{marginRight: 4}}/>
          <Text style={styles.addressText} numberOfLines={1}>{currentPostalCode} {currentAddress}</Text>
        </View>
        {activeRule && (
          <View style={styles.ruleBadge}>
            <Clock color="#FFFFFF" size={12} style={{marginRight: 4}}/>
            <Text style={styles.ruleBadgeText}>特殊ルール適用中: {activeRule.rule_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsDashboard}>
        <View style={styles.statItem}><Trophy color="#F59E0B" size={20} /><Text style={styles.statValue}>{playerStats.totalWins}</Text><Text style={styles.statLabel}>PvP勝利</Text></View>
        <View style={styles.divider} />
        <View style={styles.statItem}><Activity color="#EF4444" size={20} /><Text style={styles.statValue}>{playerStats.bossDefeats}</Text><Text style={styles.statLabel}>ボス討伐</Text></View>
        <View style={styles.divider} />
        <View style={styles.statItem}><Flag color="#3B82F6" size={20} /><Text style={styles.statValue}>{territories.filter(t=>t.player_id===myId).length}</Text><Text style={styles.statLabel}>支配陣地</Text></View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 リアルマップ：陣取り(テリトリー) ＆ ボス</Text>
          {loadingMap ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ padding: 20 }} />
          ) : (
            <View style={styles.mapPanel}>
              {/* 🌟 regionプロパティを外し、ピンチアウトを可能に。スタイルは動的切り替え */}
              <MapView 
                ref={mapRef}
                provider={PROVIDER_GOOGLE} 
                style={styles.map} 
                showsUserLocation={true}
                customMapStyle={getMapStyle()}
              >
                {detectedBoss && (
                  <Marker coordinate={{ latitude: detectedBoss.lat, longitude: detectedBoss.lng }}>
                    <View style={styles.bossMarker}><Text style={{ fontSize: 24 }}>👹</Text></View>
                  </Marker>
                )}
                {startPoint && (
                  <Marker coordinate={startPoint}>
                    <View style={styles.startMarker}><Flag color="#FFF" size={16}/></View>
                  </Marker>
                )}
                {territories.map((t) => {
                  const isMine = t.player_id === myId;
                  // 🌟 チームカラーの適用（無い場合のフォールバック含む）
                  const teamColor = t.team_color || (isMine ? '#3B82F6' : '#EF4444');
                  const teamName = t.team_name || (isMine ? '自陣' : '敵陣');
                  const fillColor = makeHsla(teamColor, 0.3) || (isMine ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)');
                  
                  const coords = [
                    { latitude: t.start_lat, longitude: t.start_lng },
                    { latitude: t.start_lat, longitude: t.end_lng },
                    { latitude: t.end_lat, longitude: t.end_lng },
                    { latitude: t.end_lat, longitude: t.start_lng },
                  ];
                  const centerLat = (t.start_lat + t.end_lat) / 2;
                  const centerLng = (t.start_lng + t.end_lng) / 2;

                  return (
                    <React.Fragment key={`terr-group-${t.id}`}>
                      {/* 🌟 陣地の塗りつぶし */}
                      <Polygon 
                        coordinates={coords} 
                        fillColor={fillColor}
                        strokeColor={teamColor} strokeWidth={2}
                        tappable={true} onPress={() => handleTerritoryPress(t)}
                      />
                      {/* 🌟 陣地中央のチームマーカー */}
                      <Marker coordinate={{ latitude: centerLat, longitude: centerLng }} onPress={() => handleTerritoryPress(t)}>
                        <View style={[styles.teamBadge, { backgroundColor: teamColor }]}>
                          <Text style={styles.teamBadgeText}>{teamName}</Text>
                        </View>
                      </Marker>
                    </React.Fragment>
                  );
                })}
              </MapView>

              {detectedBoss && (
                <View style={styles.bossInfoOverlay}>
                  <View style={styles.bossHeader}>
                    <Text style={styles.sponsorTag}>{detectedBoss.sponsor_name} [{detectedBoss.element}]</Text>
                    <Text style={styles.bossName}>{detectedBoss.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.bossAttackBtn} onPress={startBossBattle} disabled={isBattling}>
                    <Swords color="#FFFFFF" size={18} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.territoryControls}>
                {!startPoint ? (
                  <TouchableOpacity style={styles.terrBtn} onPress={markStartPoint}>
                    <Flag color="#FFF" size={18} style={{marginRight: 6}}/>
                    <Text style={styles.terrBtnText}>現在地を「起点」にする</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity style={[styles.terrBtn, {backgroundColor: '#10B981', flex: 1}]} onPress={openTerritoryModal}>
                      <Zap color="#FFF" size={18} style={{marginRight: 6}}/>
                      <Text style={styles.terrBtnText}>陣地を展開(終点確定)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.terrBtn, {backgroundColor: '#64748B', paddingHorizontal: 15}]} onPress={cancelStartPoint}>
                      <X color="#FFF" size={18}/>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚔️ 全国オンライン対戦</Text>
          <View style={styles.pvpPanel}>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#0F172A' }, isBattling && styles.disabledButton]} onPress={startPvpBattle} disabled={isBattling}>
              <Text style={styles.btnText}>{isBattling ? '戦闘計算中...' : '対戦相手を自動検索'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {battleLog.length > 0 && (
          <View style={styles.logSection}>
            <Text style={styles.logSectionTitle}>⚡ バトル実況ログ</Text>
            {battleLog.map((log, index) => (
              <View key={index} style={[styles.logBox, log.isSpecial && styles.specialLogBox]}>
                <Text style={[styles.logText, log.isSpecial && styles.specialLogText]}>{log.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* --- 陣地展開モーダル --- */}
      <Modal visible={isTerritoryModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>陣地の展開（生贄選択）</Text>
            <Text style={styles.addressRouteText}>{startPoint?.address} {'\n'} 〜 {currentAddress}</Text>
            
            {activeRule && activeRule.require_fixed_card && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>⚠️ このエリア/時間帯は特殊ルールが適用されています。{"\n"}企業協賛・スポンサーカード等の特別なカードしか生贄にできません。</Text>
              </View>
            )}
            
            <FlatList
              data={myHighRareCards}
              keyExtractor={item => item.id}
              numColumns={2}
              style={{maxHeight: 280, marginBottom: 20}}
              renderItem={({item}) => {
                const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                return (
                  <TouchableOpacity 
                    style={[styles.miniCard, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]}
                    onPress={() => toggleSacrifice(item)}
                    activeOpacity={isRestricted ? 1 : 0.7}
                  >
                    <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                    <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                    {item.is_fixed && <Text style={{fontSize: 9, color: '#EF4444', fontWeight:'bold'}}>協賛カード</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.cancelBtn, {flex: 1}]} onPress={() => setTerritoryModalVisible(false)}>
                <Text style={styles.cancelBtnText}>やめる</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, {flex: 2}, selectedSacrifices.length !== 2 && {backgroundColor: '#94A3B8'}]} 
                onPress={confirmTerritoryCreation} disabled={selectedSacrifices.length !== 2}
              >
                <Text style={styles.confirmBtnText}>2枚を捧げて展開する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- 陣地強奪モーダル --- */}
      <Modal visible={isAttackModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>敵陣地の検知</Text>
            <View style={styles.terrInfoBox}>
              <Text style={styles.addressRouteText} numberOfLines={2}>{selectedTerritory?.start_address} {'\n'}〜 {selectedTerritory?.end_address}</Text>
              <Text style={styles.terrOwner}>所有者: {selectedTerritory?.player_name}</Text>
              <Text style={styles.terrDefense}>防衛力: {selectedTerritory?.defense_power}</Text>
            </View>

            {selectedTerritory?.player_id === myId ? (
              <Text style={styles.modalDesc}>これはあなたの支配領域です。</Text>
            ) : (
              <>
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0F172A', marginBottom: 20}]} onPress={attackTerritoryByBattle}>
                  <Text style={styles.confirmBtnText}>出撃カードで結界を破壊する(バトル)</Text>
                </TouchableOpacity>
                <Text style={styles.label}>または圧倒的財力で上書き強奪</Text>
                <FlatList
                  data={myHighRareCards}
                  keyExtractor={item => item.id}
                  horizontal
                  style={{marginBottom: 20}}
                  renderItem={({item}) => {
                    const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                    return (
                      <TouchableOpacity 
                        style={[styles.miniCard, {width: 90, marginRight: 8}, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]}
                        onPress={() => toggleSacrifice(item)}
                      >
                        <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                        <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity 
                  style={[styles.confirmBtn, {backgroundColor: '#EF4444'}, selectedSacrifices.length !== 2 && {backgroundColor: '#FCA5A5'}]} 
                  onPress={overwriteTerritory} disabled={selectedSacrifices.length !== 2}
                >
                  <Text style={styles.confirmBtnText}>2枚を捧げて強奪する</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.cancelBtn, {marginTop: 20}]} onPress={() => setAttackModalVisible(false)}><Text style={styles.cancelBtnText}>閉じる</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingBottom: 85 },
  addressHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  addressText: { color: '#475569', fontSize: 12, fontWeight: '700', flex: 1 },
  ruleBadge: { flexDirection: 'row', backgroundColor: '#EF4444', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4, alignItems: 'center' },
  ruleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  statsDashboard: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 14, marginHorizontal: 16, marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  statItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  statValue: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 4 },
  statLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  scrollArea: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { color: '#64748B', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  mapPanel: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', height: 450, position: 'relative' },
  webMapFallback: { flex: 1, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  map: { width: '100%', height: '100%' },
  bossMarker: { backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#EF4444' },
  startMarker: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  
  // 🌟 追加: チームマーカー用スタイル
  teamBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
  teamBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  bossInfoOverlay: { position: 'absolute', top: 15, left: 15, right: 15, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  bossHeader: { flex: 1 },
  sponsorTag: { color: '#EF4444', fontSize: 10, fontWeight: '800', backgroundColor: '#FFEEEE', paddingHorizontal: 8, borderRadius: 8, alignSelf: 'flex-start' },
  bossName: { color: '#1E293B', fontSize: 15, fontWeight: '900', marginTop: 4 },
  bossAttackBtn: { paddingHorizontal: 16, height: 44, backgroundColor: '#EF4444', borderRadius: 12, justifyContent: 'center' },
  territoryControls: { position: 'absolute', bottom: 15, left: 15, right: 15 },
  terrBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  terrBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  pvpPanel: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryButton: { flexDirection: 'row', width: '100%', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: '#CBD5E1' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  logSection: { padding: 20, backgroundColor: '#FFFFFF' },
  logSectionTitle: { color: '#475569', fontSize: 12, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  logBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', padding: 16, borderRadius: 16, marginBottom: 12 },
  specialLogBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  logText: { color: '#334155', fontSize: 14, fontWeight: '500' },
  specialLogText: { color: '#1E40AF', fontWeight: '800' },
  
  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalHeader: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  modalDesc: { color: '#64748B', fontSize: 13, marginBottom: 16 },
  addressRouteText: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, color: '#3B82F6', fontWeight: '800', fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 20 },
  warningBox: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 16 },
  warningText: { color: '#B91C1C', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  label: { color: '#475569', fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  terrInfoBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  terrOwner: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  terrDefense: { fontSize: 16, fontWeight: '900', color: '#EF4444' },
  miniCard: { flex: 1, margin: 4, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  selectedMiniCard: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  miniCardImg: { width: '100%', height: 80, borderRadius: 8, marginBottom: 6, resizeMode: 'cover' },
  miniCardName: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  confirmBtn: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  cancelBtn: { backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '800', fontSize: 15 },
});