import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView, Platform, FlatList, Image, Animated, Easing, Linking } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { ShieldAlert, Trophy, Activity, Swords, Map as MapIcon, Flag, Zap, X, MapPin, Clock, Flame, Shield, Heart, Zap as FastZap, Scan, Camera as CameraIcon } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// =====================================================================
// 🌟 Web環境でのビルドクラッシュを防ぎつつ、Web用マップを表示する実装
// =====================================================================
let MapView: any;
let Marker: any;
let Polygon: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  // モバイル（実機）環境：ネイティブのreact-native-mapsを読み込む
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polygon = Maps.Polygon;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} else {
  // Web環境：Vercelエラーを回避し、iframe(OpenStreetMap)でマップを擬似表示する
  MapView = React.forwardRef(({ children, region }: any, ref) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: () => {} }));
    // 座標がない場合は立川エリアをデフォルトに
    const lat = region?.latitude || 35.698;
    const lng = region?.longitude || 139.413;
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', position: 'relative', overflow: 'hidden' }}>
        {/* @ts-ignore - Web用標準iframe */}
        <iframe 
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01}%2C${lat-0.01}%2C${lng+0.01}%2C${lat+0.01}&layer=mapnik`}
          style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', opacity: 0.6 }}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
          {children}
        </View>
      </View>
    );
  });
  MapView.displayName = 'MapView';

  Marker = ({ children, onPress }: any) => (
    <TouchableOpacity onPress={onPress} style={{ margin: 10 }}>
      {children}
    </TouchableOpacity>
  );
  Polygon = () => null; // Webでは陣地のポリゴン描画はスキップ
}

// 動的属性テーブル用の型定義
type ElementRelationMap = Record<string, { strong: string[], weak: string[] }>;

// DBから取得した相性テーブルを参照して計算
function getDamageMultiplier(attackerEl: string, defenderEl: string, relations: ElementRelationMap): { multiplier: number, label: string } {
  const relation = relations[attackerEl];
  if (!relation) return { multiplier: 1.0, label: '' }; 
  
  if (relation.strong && relation.strong.includes(defenderEl)) return { multiplier: 1.5, label: '💥【有利】' }; 
  if (relation.weak && relation.weak.includes(defenderEl)) return { multiplier: 0.5, label: '🛡️【不利】' };
  
  return { multiplier: 1.0, label: '' };
}

// マップのカスタムスタイル
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
  const mapRef = useRef<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState({ totalWins: 0, bossDefeats: 0 });
  const [battleLog, setBattleLog] = useState<any[]>([]);
  const [isBattling, setIsBattling] = useState(false);
  
  const [elementRelations, setElementRelations] = useState<ElementRelationMap>({});
  
  // マップ・ボス・GPS関連
  const [loadingMap, setLoadingMap] = useState(false);
  const [detectedBoss, setDetectedBoss] = useState<any>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('現在地を取得中...');
  const [currentPostalCode, setCurrentPostalCode] = useState<string>('');
  const [mapMode, setMapMode] = useState<'normal' | 'boss' | 'territory'>('normal');
  
  // 陣取り関連
  const [territories, setTerritories] = useState<any[]>([]);
  const [startPoint, setStartPoint] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isTerritoryModalVisible, setTerritoryModalVisible] = useState(false);
  const [isAttackModalVisible, setAttackModalVisible] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  
  const [myHighRareCards, setMyHighRareCards] = useState<any[]>([]);
  const [selectedSacrifices, setSelectedSacrifices] = useState<string[]>([]);
  
  // 特殊ルール
  const [activeRule, setActiveRule] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  // エフェクト・非同期リザルト用ステート
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isAsyncResultModalVisible, setAsyncResultModalVisible] = useState(false);
  const [asyncResultData, setAsyncResultData] = useState<any>(null);

  // AR・キャンペーン関連のステート
  const [campaignList, setCampaignList] = useState<any[]>([]);
  const [isCampaignModalVisible, setCampaignModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  useFocusEffect(
    useCallback(() => { initBattleData(); }, [])
  );

  const initBattleData = async () => {
    setLoadingMap(true);

    try {
      const { data: relationsData, error: relError } = await supabase.from('element_relations').select('*');
      if (!relError && relationsData) {
        const formattedMap: ElementRelationMap = {};
        relationsData.forEach((row: any) => {
          formattedMap[row.element_name] = { strong: row.strong_against || [], weak: row.weak_against || [] };
        });
        setElementRelations(formattedMap);
      }
    } catch(err) { console.warn(err); }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMyId(user.id);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profile) {
        setMyProfile(profile);
        setPlayerStats({ totalWins: profile.total_wins, bossDefeats: profile.boss_defeats });
      }

      const { data: memberData } = await supabase.from('team_members').select('*, teams(*)').eq('player_id', user.id).eq('status', 'approved').maybeSingle();
      if (memberData && memberData.teams) setMyTeam(memberData.teams);

      const { data: cards } = await supabase.from('cards').select('*').eq('player_id', user.id).eq('is_active', true).or('level.gte.5,status_total.gte.300,is_fixed.eq.true'); 
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

      await evaluateSpecialRules(addressString, postal);

      const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
      let foundBoss = null;
      if (campaigns) {
        setCampaignList(campaigns);

        const targetCampaigns = campaigns.filter((c: any) => c.target_lat !== null);
        const nearbyCampaign = targetCampaigns.find((c: any) => getDistance(latitude, longitude, c.target_lat, c.target_lng) <= (c.radius_meters || 100));
        
        if (nearbyCampaign) {
          const { data: boss } = await supabase.from('bosses').select('*, fixed_cards(*)').eq('trigger_campaign_id', nearbyCampaign.id).maybeSingle();
          if (boss) foundBoss = { ...boss, campaign_title: nearbyCampaign.title, sponsor_name: nearbyCampaign.sponsor_name, lat: nearbyCampaign.target_lat, lng: nearbyCampaign.target_lng, element: boss.element || '火' };
        }
      }
      setDetectedBoss(foundBoss);

      const { data: terrData } = await supabase.from('territories').select('*').order('created_at', { ascending: false }).limit(50);
      if (terrData) setTerritories(terrData);

      if (foundBoss) {
        setMapMode('boss');
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 1000);
      } else {
        setMapMode('normal');
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

  const openWebAR = async (url: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('エラー', 'このURLは開けません: ' + url);
      }
    } catch (error) {
      Alert.alert('エラー', 'ブラウザの起動に失敗しました。');
    }
  };

  const handleStartScan = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('権限エラー', 'QRコードをスキャンするにはカメラへのアクセス許可が必要です。');
        return;
      }
    }
    setCampaignModalVisible(false);
    setScannerVisible(true);
  };

  const markStartPoint = () => {
    if (!currentLocation) return;
    setStartPoint({ lat: currentLocation.lat, lng: currentLocation.lng, address: currentAddress });
    setMapMode('territory');
    mapRef.current?.animateToRegion({ latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 1000);
    Alert.alert('起点マーカー設置', `「${currentAddress}」を起点として記録しました。別の場所に移動して陣地を展開してください。`);
  };

  const cancelStartPoint = () => {
    setStartPoint(null);
    setMapMode(detectedBoss ? 'boss' : 'normal');
    if (currentLocation) {
      mapRef.current?.animateToRegion({ latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: detectedBoss ? 0.02 : 0.005, longitudeDelta: detectedBoss ? 0.02 : 0.005 }, 1000);
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
    if (selectedSacrifices.length !== 2) return;
    const card1 = myHighRareCards.find(c => c.id === selectedSacrifices[0]);
    const card2 = myHighRareCards.find(c => c.id === selectedSacrifices[1]);
    const totalDefense = card1.status_total + card2.status_total;

    Alert.alert(
      "陣地の展開", 
      `「${startPoint?.address}」〜「${currentAddress}」を制圧し、防衛力[${totalDefense}]の陣地を展開しますか？\n※捧げたカードは消失します。`,
      [
        { text: "キャンセル", style: "cancel" },
        { text: "生贄に捧げる", style: "destructive", onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').insert([{
                player_id: myId, player_name: myProfile?.player_name || '匿名エージェント',
                team_id: myTeam?.id || null, team_name: myTeam?.name || '', team_color: myTeam?.team_color || '',
                start_lat: startPoint?.lat, start_lng: startPoint?.lng, end_lat: currentLocation?.lat, end_lng: currentLocation?.lng,
                start_address: startPoint?.address, end_address: currentAddress, defense_power: totalDefense, card1_name: card1.card_name, card2_name: card2.card_name
              }]);
              await supabase.from('cards').update({ is_active: false }).in('id', selectedSacrifices);
              Alert.alert('展開完了', '強大な陣地をマップ上に展開しました！');
              setTerritoryModalVisible(false); cancelStartPoint(); initBattleData();
            } catch (err) { Alert.alert('エラー', '通信に失敗しました。'); }
            setLoadingMap(false);
        }}
      ]
    );
  };

  const handleTerritoryPress = (territory: any) => {
    setSelectedTerritory(territory); setSelectedSacrifices([]); setAttackModalVisible(true);
  };

  const overwriteTerritory = async () => {
    if (selectedSacrifices.length !== 2) return;
    const c1 = myHighRareCards.find(c => c.id === selectedSacrifices[0]);
    const c2 = myHighRareCards.find(c => c.id === selectedSacrifices[1]);
    const myAttackPower = c1.status_total + c2.status_total;

    if (myAttackPower <= selectedTerritory.defense_power) {
      Alert.alert('戦力不足', `防衛力[${selectedTerritory.defense_power}]に対し、あなたの戦力は[${myAttackPower}]です。`); return;
    }

    Alert.alert("圧倒的制圧", `この陣地を無血開城させますか？`, [
        { text: "キャンセル", style: "cancel" },
        { text: "強奪する", style: "destructive", onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').update({
                player_id: myId, player_name: myProfile?.player_name || '匿名', team_id: myTeam?.id || null, team_name: myTeam?.name || '', team_color: myTeam?.team_color || '',
                defense_power: myAttackPower, card1_name: c1.card_name, card2_name: c2.card_name
              }).eq('id', selectedTerritory.id);
              await supabase.from('cards').update({ is_active: false }).in('id', selectedSacrifices);
              Alert.alert('制圧完了', '陣地を奪い取りました！');
              setAttackModalVisible(false); initBattleData();
            } catch(e) {}
            setLoadingMap(false);
        }}
    ]);
  };

  const attackTerritoryByBattle = async () => {
    setAttackModalVisible(false); setIsBattling(true); setBattleLog([]);
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).maybeSingle();
    if (!myCard) { Alert.alert('出撃不可', '出撃可能なカードがありません。カード一覧からアクティブにしてください。'); setIsBattling(false); return; }

    const defStats = Math.floor(selectedTerritory.defense_power / 4);
    const bossMonster = { 
      id: 'TERRITORY_DEF', card_name: `【防衛結界】${selectedTerritory.card1_name} & ${selectedTerritory.card2_name}`, skill_name: '絶対防壁', 
      status_hp: defStats * 2, status_atk: defStats, status_def: defStats, status_spd: 50, level: 10, rarity: '🏰', element: '虚無'
    };
    
    simulateBattle(myCard, bossMonster, false, async (isWin) => {
      if (isWin) {
        await supabase.from('territories').delete().eq('id', selectedTerritory.id);
        Alert.alert("結界破壊！", "見事バトルに勝利し、相手の陣地を破壊しました！"); initBattleData();
      } else { Alert.alert("敗北", "防衛結界の前に敗れ去りました..."); }
    });
  };

  const startPvpBattle = async () => {
    setIsBattling(true); 
    setBattleLog([]);
    
    const { data: myCard, error: myError } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).maybeSingle();
    if (myError || !myCard) { 
      Alert.alert('出撃エラー', 'アクティブな出撃カードがありません。\nマイページから出撃させたいカードを選択してください。'); 
      setIsBattling(false); 
      return; 
    }
    
    const minS = Math.floor(myCard.status_total * 0.75); 
    const maxS = Math.floor(myCard.status_total * 1.25);
    
    const { data: oppCards, error: oppError } = await supabase.from('cards')
      .select('*')
      .neq('player_id', myId)
      .eq('is_active', true)
      .gte('status_total', minS)
      .lte('status_total', maxS)
      .limit(10);
      
    if (oppError || !oppCards || oppCards.length === 0) { 
      Alert.alert('検索結果', '現在、同格のライバルが見つかりませんでした。\n時間をおいて再度お試しください。'); 
      setIsBattling(false); 
      return; 
    }
    
    Alert.alert('マッチング成功！', '同格のライバルを発見しました。\nバトルを開始しますか？', [
      { text: 'キャンセル', style: 'cancel', onPress: () => setIsBattling(false) },
      { text: 'バトル開始！', onPress: () => {
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
        }
      }
    ]);
  };

  const startBossBattle = async () => {
    if (!detectedBoss) return;
    setIsBattling(true); setBattleLog([]);
    const { data: myCard } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true).maybeSingle();
    if (!myCard) { Alert.alert('出撃不可', '出撃可能なアクティブカードがありません。'); setIsBattling(false); return; }
    
    const bossMonster = { 
      id: 'BOSS', card_name: `【エリアボス】${detectedBoss.name}`, skill_name: 'カタストロフィ', 
      status_hp: detectedBoss.hp, status_atk: detectedBoss.atk, status_def: detectedBoss.def, status_spd: detectedBoss.spd || 40, level: 10, rarity: '👑', element: detectedBoss.element || '闇'
    };
    
    simulateBattle(myCard, bossMonster, true, async (isWin) => {
      if (isWin) {
        const newDefs = playerStats.bossDefeats + 1;
        await supabase.from('profiles').update({ boss_defeats: newDefs }).eq('id', myId);
        setPlayerStats(prev => ({ ...prev, bossDefeats: newDefs }));
        
        const reward = detectedBoss.fixed_cards;
        if (reward) {
          await supabase.from('rewards').insert([{ 
            player_id: myId, 
            title: `🎁 ボス討伐報酬: ${reward.card_name}`,
            description: `エリアボス「${detectedBoss.name}」を見事討伐した報酬の限定カードです！`,
            reward_type: 'card',
            reward_data: {
              card_name: reward.card_name, image_url: reward.image_url,
              status_total: reward.stats.hp + reward.stats.atk + reward.stats.def + reward.stats.spd,
              status_hp: reward.stats.hp, status_atk: reward.stats.atk, status_def: reward.stats.def, status_spd: reward.stats.spd,
              rarity: reward.stats.rarity || 'P', element: detectedBoss.element || '火', is_fixed: true
            },
            is_claimed: false
          }]);
        }
        Alert.alert("👹 ボス討伐！", `限定カードを獲得しました！\n「報酬」ボックスから受け取ってください。`);
      }
    });
  };

  const simulateBattle = (p1: any, p2: any, isBossMode: boolean, callback: (isWin: boolean) => void) => {
    let log: any[] = [];
    log.push({ text: `🏁 【BATTLE START】\n${p1.card_name} [${p1.element || '無'}] VS ${p2.card_name} [${p2.element || '無'}]`, isSpecial: true });
    
    let first = p1.status_spd >= p2.status_spd ? p1 : p2; let second = p1.status_spd >= p2.status_spd ? p2 : p1;
    let winner = null; let p1Hp = p1.status_hp; let p2Hp = p2.status_hp;

    for (let turn = 1; turn <= 5; turn++) {
      const res1 = getDamageMultiplier(first.element || '無', second.element || '無', elementRelations);
      let dmg1 = Math.floor((Math.max(1, first.status_atk - Math.floor(second.status_def / 2)) + Math.floor(Math.random() * 10)) * res1.multiplier);
      if (first === p1) p2Hp -= dmg1; else p1Hp -= dmg1;
      log.push({ text: `[T-${turn}] ${first.card_name}の攻撃！\n${dmg1} のダメージ！${res1.label}`, isSpecial: false });
      if (p1Hp <= 0 || p2Hp <= 0) { winner = p1Hp <= 0 ? p2 : p1; break; }

      const res2 = getDamageMultiplier(second.element || '無', first.element || '無', elementRelations);
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

  const startAsyncBossBattle = async () => {
    if (!detectedBoss) return;
    if (myHighRareCards.length === 0) { Alert.alert('デッキエラー', '討伐に派遣できるカードがありません。'); return; }

    setIsBattling(true); setBattleLog([]);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const sortedCards = [...myHighRareCards].sort((a, b) => b.status_total - a.status_total);
    const topCards = sortedCards.slice(0, 5);
    const myDeckPower = topCards.reduce((sum, card) => sum + card.status_total, 0);
    const bossPower = detectedBoss.hp + detectedBoss.atk + detectedBoss.def + (detectedBoss.spd || 0);

    const myFinalPower = Math.floor(myDeckPower * (0.8 + Math.random() * 0.4));
    const bossFinalPower = Math.floor(bossPower * (0.9 + Math.random() * 0.2));
    const isWin = myFinalPower >= bossFinalPower;

    setAsyncResultData({ isWin, myDeckPower, myFinalPower, bossPower, bossFinalPower, bossName: detectedBoss.name });

    if (isWin) {
      const newDefs = playerStats.bossDefeats + 1;
      await supabase.from('profiles').update({ boss_defeats: newDefs }).eq('id', myId);
      setPlayerStats(prev => ({ ...prev, bossDefeats: newDefs }));
      
      const reward = detectedBoss.fixed_cards;
      if (reward) {
        await supabase.from('rewards').insert([{ 
            player_id: myId, title: `🎁 デッキ討伐報酬: ${reward.card_name}`,
            description: `エリアボス「${detectedBoss.name}」をデッキの力で討伐した報酬の限定カードです！`,
            reward_type: 'card',
            reward_data: {
              card_name: reward.card_name, image_url: reward.image_url,
              status_total: reward.stats.hp + reward.stats.atk + reward.stats.def + reward.stats.spd,
              status_hp: reward.stats.hp, status_atk: reward.stats.atk, status_def: reward.stats.def, status_spd: reward.stats.spd,
              rarity: reward.stats.rarity || 'P', element: detectedBoss.element || '火', is_fixed: true
            },
            is_claimed: false
        }]);
      }
    }
    
    setIsBattling(false); setAsyncResultModalVisible(true);
  };

  const toggleSacrifice = (item: any) => {
    if (activeRule && activeRule.require_fixed_card && !item.is_fixed) {
      Alert.alert('ルール違反', `「${activeRule.rule_name}」のため協賛カード等が必要です。`); return;
    }
    if (selectedSacrifices.includes(item.id)) setSelectedSacrifices(prev => prev.filter(i => i !== item.id));
    else {
      if (selectedSacrifices.length >= 2) Alert.alert('制限', '選べる生贄は2枚までです。');
      else setSelectedSacrifices(prev => [...prev, item.id]);
    }
  };

  const getMapStyle = () => {
    if (mapMode === 'boss') return BOSS_MAP_STYLE;
    if (mapMode === 'territory') return TERRITORY_MAP_STYLE;
    return [];
  };

  const getBossFeatureStyle = (boss: any) => {
    const stats = { HP: boss.hp, ATK: boss.atk, DEF: boss.def, SPD: boss.spd || 0 };
    const maxStat = Object.keys(stats).reduce((a, b) => stats[a as keyof typeof stats] > stats[b as keyof typeof stats] ? a : b);
    const total = boss.hp + boss.atk + boss.def + (boss.spd || 0);
    
    let color = '#EF4444'; let icon = <Flame color="#FFF" size={24} />; let label = '攻撃特化';
    if (maxStat === 'HP') { color = '#10B981'; icon = <Heart color="#FFF" size={24}/>; label = '体力特化'; }
    if (maxStat === 'DEF') { color = '#3B82F6'; icon = <Shield color="#FFF" size={24}/>; label = '防御特化'; }
    if (maxStat === 'SPD') { color = '#F59E0B'; icon = <FastZap color="#FFF" size={24}/>; label = '敏捷特化'; }

    return { color, icon, label, isSuper: total > 2000 };
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

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 リアルマップ：陣取り(テリトリー) ＆ ボス</Text>
          {loadingMap ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ padding: 20 }} />
          ) : (
            <View style={styles.mapPanel}>
              <MapView 
                ref={mapRef}
                provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE} 
                style={styles.map} 
                showsUserLocation={true}
                customMapStyle={getMapStyle()}
              >
                {detectedBoss && (
                  <Marker coordinate={{ latitude: detectedBoss.lat, longitude: detectedBoss.lng }}>
                    <Animated.View style={[styles.bossMarker, { transform: [{ scale: pulseAnim }], borderColor: getBossFeatureStyle(detectedBoss).color }]}>
                      <Text style={{ fontSize: 24 }}>👹</Text>
                    </Animated.View>
                  </Marker>
                )}
                {startPoint && (
                  <Marker coordinate={startPoint}>
                    <View style={styles.startMarker}><Flag color="#FFF" size={16}/></View>
                  </Marker>
                )}
                {territories.map((t) => {
                  const isMine = t.player_id === myId;
                  const teamColor = t.team_color || (isMine ? '#3B82F6' : '#EF4444');
                  const teamName = t.team_name || (isMine ? '自陣' : '敵陣');
                  const fillColor = makeHsla(teamColor, 0.3) || (isMine ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)');
                  const coords = [{ latitude: t.start_lat, longitude: t.start_lng }, { latitude: t.start_lat, longitude: t.end_lng }, { latitude: t.end_lat, longitude: t.end_lng }, { latitude: t.end_lat, longitude: t.start_lng }];
                  const centerLat = (t.start_lat + t.end_lat) / 2; const centerLng = (t.start_lng + t.end_lng) / 2;

                  return (
                    <React.Fragment key={`terr-group-${t.id}`}>
                      <Polygon coordinates={coords} fillColor={fillColor} strokeColor={teamColor} strokeWidth={2} tappable={true} onPress={() => handleTerritoryPress(t)} />
                      <Marker coordinate={{ latitude: centerLat, longitude: centerLng }} onPress={() => handleTerritoryPress(t)}>
                        <View style={[styles.teamBadge, { backgroundColor: teamColor }]}><Text style={styles.teamBadgeText}>{teamName}</Text></View>
                      </Marker>
                    </React.Fragment>
                  );
                })}
              </MapView>

              {detectedBoss && (() => {
                const feature = getBossFeatureStyle(detectedBoss);
                return (
                  <Animated.View style={[styles.bossInfoOverlay, feature.isSuper && { transform: [{ scale: pulseAnim }], shadowColor: feature.color, shadowOpacity: 0.8, shadowRadius: 10 }]}>
                    <View style={styles.bossHeader}>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                        <Text style={[styles.sponsorTag, {backgroundColor: feature.color, color: '#FFF'}]}>{feature.label}</Text>
                        <Text style={styles.elementTag}>[{detectedBoss.element}]</Text>
                        {feature.isSuper && <Text style={styles.superWarning}>⚠️ SUPER BOSS</Text>}
                      </View>
                      <Text style={styles.bossName}>{detectedBoss.name}</Text>
                      <Text style={styles.bossStatsDetail}>HP:{detectedBoss.hp} ATK:{detectedBoss.atk} DEF:{detectedBoss.def}</Text>
                    </View>

                    {isBattling ? (
                      <View style={{alignItems: 'center', justifyContent: 'center', padding: 10}}><ActivityIndicator color={feature.color} /><Text style={{fontSize: 10, color: feature.color, marginTop: 4, fontWeight: 'bold'}}>通信演算中...</Text></View>
                    ) : (
                      <>
                        <View style={styles.bossActionRow}>
                          <TouchableOpacity style={[styles.bossAttackBtn, {backgroundColor: feature.color}]} onPress={startBossBattle}>
                            <Swords color="#FFFFFF" size={16} style={{marginRight: 4}}/>
                            <Text style={styles.bossBtnText}>交戦</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.bossAsyncBtn, {borderColor: feature.color}]} onPress={startAsyncBossBattle}>
                            <FastZap color={feature.color} size={16} style={{marginRight: 4}}/>
                            <Text style={[styles.bossBtnText, {color: feature.color}]}>デッキ討伐</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity 
                          style={[styles.bossArBtn, { backgroundColor: '#10B981' }]} 
                          onPress={() => openWebAR(`https://example.com/ar?boss_id=${detectedBoss.id}`)}
                        >
                          <CameraIcon color="#FFF" size={16} style={{marginRight: 6}}/>
                          <Text style={styles.bossBtnText}>ARで次元の歪みを探索</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </Animated.View>
                );
              })()}

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
            <Text style={styles.logSectionTitle}>⚡ 同期バトル実況ログ</Text>
            {battleLog.map((log, index) => (
              <View key={index} style={[styles.logBox, log.isSpecial && styles.specialLogBox]}>
                <Text style={[styles.logText, log.isSpecial && styles.specialLogText]}>{log.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.floatingArBtn}
        onPress={() => setCampaignModalVisible(true)}
      >
        <Scan color="#FFFFFF" size={28} />
        <Text style={styles.floatingArBtnText}>AR探索</Text>
      </TouchableOpacity>

      {/* ==========================================
          🌟 ARキャンペーン一覧・詳細モーダル
      ========================================== */}
      <Modal visible={isCampaignModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>開催中のARイベント</Text>
              <TouchableOpacity onPress={() => {setCampaignModalVisible(false); setSelectedCampaign(null);}}>
                <X color="#64748B" size={24}/>
              </TouchableOpacity>
            </View>

            {!selectedCampaign ? (
              <FlatList
                data={campaignList}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                  <TouchableOpacity style={styles.campaignItem} onPress={() => setSelectedCampaign(item)}>
                    <Text style={styles.campaignTitle}>{item.title}</Text>
                    <Text style={styles.campaignSponsor}>{item.sponsor_name}</Text>
                    <Text style={styles.campaignDescPreview} numberOfLines={2}>{item.description || '現地でマーカーを見つけて専用コンテンツを探索しよう！'}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>現在近くで開催中のキャンペーンはありません。</Text>}
              />
            ) : (
              <View style={styles.campaignDetail}>
                <TouchableOpacity onPress={() => setSelectedCampaign(null)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← 一覧に戻る</Text>
                </TouchableOpacity>
                <Text style={styles.campaignDetailTitle}>{selectedCampaign.title}</Text>
                <Text style={styles.campaignDetailSponsor}>
                  {selectedCampaign.sponsor_name ? `主催・協賛: ${selectedCampaign.sponsor_name}` : '公式イベント'}
                </Text>
                
                <View style={styles.campaignDetailBox}>
                  <Text style={styles.campaignDetailDesc}>
                    対象の店舗やイベント会場に設置された専用の「ARマーカー（QRコード）」を探しましょう！{"\n\n"}
                    スキャナーを起動してマーカーを読み取ると、現実世界に限定アイテムやボスが出現し、バトルや報酬獲得のアクションが発生します。
                  </Text>
                </View>
                
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.scanLaunchBtn} onPress={handleStartScan}>
                  <Scan color="#FFF" size={20} style={{marginRight: 8}}/>
                  <Text style={styles.scanLaunchBtnText}>QRスキャナーを起動</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ==========================================
          🌟 QRスキャナーモーダル
      ========================================== */}
      <Modal visible={isScannerVisible} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {Platform.OS !== 'web' ? (
            <CameraView 
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={({ data }) => {
                if (data.startsWith('http')) {
                  setScannerVisible(false);
                  openWebAR(data);
                } else {
                  Alert.alert('エラー', '有効なURLを含むQRコードではありません。');
                  setScannerVisible(false);
                }
              }}
            >
              <SafeAreaView style={styles.scannerOverlay}>
                <View style={styles.scannerHeaderTop}>
                  <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.scannerCloseBtn}>
                    <X color="#FFF" size={28}/>
                  </TouchableOpacity>
                  <Text style={styles.scannerText}>対象のQRコードを枠内に写してください</Text>
                </View>
                <View style={styles.scannerTargetBox} />
              </SafeAreaView>
            </CameraView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <CameraIcon color="#64748B" size={48} style={{ marginBottom: 16 }} />
              <Text style={{ color: '#FFF', marginBottom: 24 }}>Web版ではカメラを利用できません</Text>
              <TouchableOpacity style={[styles.scanLaunchBtn, { width: 200 }]} onPress={() => {
                setScannerVisible(false);
                openWebAR('https://example.com/ar-demo');
              }}>
                <Text style={styles.scanLaunchBtnText}>擬似スキャン完了</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setScannerVisible(false)}>
                <Text style={{ color: '#3B82F6', fontSize: 16 }}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={isAsyncResultModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={[styles.modalHeader, { fontSize: 24, color: asyncResultData?.isWin ? '#10B981' : '#EF4444' }]}>{asyncResultData?.isWin ? 'MISSION CLEAR!!' : 'MISSION FAILED...'}</Text>
            <View style={styles.resultMatchBox}>
              <View style={styles.resultSide}>
                <Text style={styles.resultLabel}>マイデッキ戦力</Text>
                <Text style={styles.resultPower}>{asyncResultData?.myDeckPower}</Text>
              </View>
              <Text style={styles.resultVS}>VS</Text>
              <View style={styles.resultSide}>
                <Text style={styles.resultLabel}>{asyncResultData?.bossName}</Text>
                <Text style={styles.resultPower}>{asyncResultData?.bossPower}</Text>
              </View>
            </View>
            <Text style={styles.resultMessage}>{asyncResultData?.isWin ? '圧倒的なデッキ戦力により、ボスを討伐しました！\n討伐報酬は「報酬」ボックスに送られました。' : 'デッキの戦力が及びませんでした...'}</Text>
            <TouchableOpacity style={[styles.confirmBtn, { width: '100%', marginTop: 20, backgroundColor: asyncResultData?.isWin ? '#10B981' : '#64748B' }]} onPress={() => setAsyncResultModalVisible(false)}><Text style={styles.confirmBtnText}>閉じる</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isTerritoryModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>陣地の展開（生贄選択）</Text>
            <Text style={styles.addressRouteText}>{startPoint?.address} {'\n'} 〜 {currentAddress}</Text>
            {activeRule && activeRule.require_fixed_card && (
              <View style={styles.warningBox}><Text style={styles.warningText}>⚠️ このエリア/時間帯は特殊ルールが適用されています。企業協賛カード等しか生贄にできません。</Text></View>
            )}
            <FlatList
              data={myHighRareCards} keyExtractor={item => item.id} numColumns={2} style={{maxHeight: 280, marginBottom: 20}}
              renderItem={({item}) => {
                const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                return (
                  <TouchableOpacity style={[styles.miniCard, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]} onPress={() => toggleSacrifice(item)} activeOpacity={isRestricted ? 1 : 0.7}>
                    <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                    <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                    {item.is_fixed && <Text style={{fontSize: 9, color: '#EF4444', fontWeight:'bold'}}>協賛カード</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.cancelBtn, {flex: 1}]} onPress={() => setTerritoryModalVisible(false)}><Text style={styles.cancelBtnText}>やめる</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, {flex: 2}, selectedSacrifices.length !== 2 && {backgroundColor: '#94A3B8'}]} onPress={confirmTerritoryCreation} disabled={selectedSacrifices.length !== 2}><Text style={styles.confirmBtnText}>2枚を捧げて展開する</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0F172A', marginBottom: 20}]} onPress={attackTerritoryByBattle}><Text style={styles.confirmBtnText}>出撃カードで結界を破壊する(バトル)</Text></TouchableOpacity>
                <Text style={styles.label}>または財力で上書き強奪</Text>
                <FlatList
                  data={myHighRareCards} keyExtractor={item => item.id} horizontal style={{marginBottom: 20}}
                  renderItem={({item}) => {
                    const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                    return (
                      <TouchableOpacity style={[styles.miniCard, {width: 90, marginRight: 8}, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]} onPress={() => toggleSacrifice(item)}>
                        <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                        <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#EF4444'}, selectedSacrifices.length !== 2 && {backgroundColor: '#FCA5A5'}]} onPress={overwriteTerritory} disabled={selectedSacrifices.length !== 2}><Text style={styles.confirmBtnText}>2枚を捧げて強奪する</Text></TouchableOpacity>
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
  map: { width: '100%', height: '100%' },
  
  bossMarker: { backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 5, borderRadius: 30, borderWidth: 3 },
  startMarker: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  teamBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
  teamBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  bossInfoOverlay: { position: 'absolute', top: 15, left: 15, right: 15, backgroundColor: 'rgba(255, 255, 255, 0.98)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  bossHeader: { marginBottom: 10 },
  sponsorTag: { fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 },
  elementTag: { fontSize: 10, fontWeight: '800', color: '#64748B', marginRight: 6 },
  superWarning: { fontSize: 10, fontWeight: '900', color: '#EF4444', fontStyle: 'italic' },
  bossName: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginTop: 4 },
  bossStatsDetail: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  
  bossActionRow: { flexDirection: 'row', gap: 8 },
  bossAttackBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bossAsyncBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 10, borderWidth: 2, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  bossArBtn: { flexDirection: 'row', height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  bossBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

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
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalHeader: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
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

  resultMatchBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginVertical: 20, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  resultSide: { flex: 1, alignItems: 'center' },
  resultVS: { fontSize: 20, fontWeight: '900', color: '#94A3B8', fontStyle: 'italic', marginHorizontal: 10 },
  resultLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 4, textAlign: 'center' },
  resultPower: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  resultMessage: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, fontWeight: '700' },

  floatingArBtn: { position: 'absolute', bottom: 100, right: 20, backgroundColor: '#10B981', width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6, zIndex: 10 },
  floatingArBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900', marginTop: 2 },
  campaignItem: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  campaignTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  campaignSponsor: { fontSize: 12, color: '#3B82F6', fontWeight: '800', marginBottom: 8 },
  campaignDescPreview: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 40, fontWeight: '700' },
  campaignDetail: { flex: 1 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 8, paddingRight: 16 },
  backBtnText: { color: '#3B82F6', fontWeight: '800', fontSize: 15 },
  campaignDetailTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  campaignDetailSponsor: { fontSize: 14, color: '#64748B', fontWeight: '800', marginBottom: 20 },
  campaignDetailBox: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 16, marginBottom: 24 },
  campaignDetailDesc: { fontSize: 14, color: '#334155', lineHeight: 24, fontWeight: '700' },
  scanLaunchBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  scanLaunchBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  
  scannerOverlay: { flex: 1, justifyContent: 'space-between' },
  scannerHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.6)' },
  scannerCloseBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  scannerText: { color: '#FFF', fontWeight: '800', fontSize: 15, flex: 1, textAlign: 'center', marginRight: 40 },
  scannerTargetBox: { alignSelf: 'center', width: 260, height: 260, borderWidth: 3, borderColor: '#10B981', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 120, borderRadius: 20 },
});