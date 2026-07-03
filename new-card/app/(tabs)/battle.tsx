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
let Circle: any;
let Polygon: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  Polygon = Maps.Polygon;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} else {
  MapView = React.forwardRef(({ children, region }: any, ref) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: () => {} }));
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
  Circle = () => null;
  Polygon = () => null;
}

type ElementRelationMap = Record<string, { strong: string[], weak: string[] }>;
type BossCategory = 'random' | 'sponsored';
type BattleEffectType = 'light' | 'heavy' | 'support' | 'burst' | 'start' | 'finish';
type BattleLogEntry = {
  text: string;
  isSpecial?: boolean;
  effectType?: BattleEffectType;
};
type DeckSummary = {
  cards: any[];
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  total: number;
  element: string;
  elementPower: number;
  support: number;
};
type BattleSummary = {
  mode: 'boss' | 'pvp' | 'territory';
  player: Pick<DeckSummary, 'name' | 'total' | 'element' | 'elementPower' | 'hp' | 'atk' | 'def' | 'spd'>;
  opponent: Pick<DeckSummary, 'name' | 'total' | 'element' | 'elementPower' | 'hp' | 'atk' | 'def' | 'spd'>;
};

function getDamageMultiplier(attackerEl: string, defenderEl: string, relations: ElementRelationMap): { multiplier: number, label: string } {
  const relation = relations[attackerEl];
  if (!relation) return { multiplier: 1.0, label: '' }; 
  
  if (relation.strong && relation.strong.includes(defenderEl)) return { multiplier: 1.5, label: '💥【有利】' }; 
  if (relation.weak && relation.weak.includes(defenderEl)) return { multiplier: 0.5, label: '🛡️【不利】' };
  
  return { multiplier: 1.0, label: '' };
}

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

const inferBossCategory = (campaign: any): BossCategory => {
  const sponsorName = String(campaign?.sponsor_name || '');
  const title = String(campaign?.title || '');
  const isRandom = sponsorName === 'システム自動生成' || title.startsWith('【定期出現】') || title.startsWith('【突発出現】');
  return isRandom ? 'random' : 'sponsored';
};

const getBossCircleStyle = (category: BossCategory) => {
  if (category === 'random') {
    return {
      strokeColor: 'rgba(239, 68, 68, 0.65)',
      fillColor: 'rgba(239, 68, 68, 0.08)',
      strokeWidth: 2,
      markerSize: 24,
      label: 'ランダムボス',
    };
  }

  return {
    strokeColor: 'rgba(220, 38, 38, 0.9)',
    fillColor: 'rgba(220, 38, 38, 0.12)',
    strokeWidth: 4,
    markerSize: 34,
    label: '手動・協賛ボス',
  };
};

const summarizeDeck = (cards: any[], fallbackName: string): DeckSummary => {
  const safeCards = cards || [];
  const elementBuckets = safeCards.reduce((acc: Record<string, number>, card: any) => {
    const element = card.element || '無';
    acc[element] = (acc[element] || 0) + (card.status_total || 0);
    return acc;
  }, {});
  const dominantElement = Object.entries(elementBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || '無';
  const total = safeCards.reduce((sum, card) => sum + (card.status_total || 0), 0);

  return {
    cards: safeCards,
    name: fallbackName,
    hp: safeCards.reduce((sum, card) => sum + (card.status_hp || 100), 0),
    atk: safeCards.reduce((sum, card) => sum + (card.status_atk || 50), 0),
    def: safeCards.reduce((sum, card) => sum + (card.status_def || 50), 0),
    spd: safeCards.reduce((sum, card) => sum + (card.status_spd || 50), 0),
    total,
    element: dominantElement,
    elementPower: elementBuckets[dominantElement] || 0,
    support: safeCards.reduce((sum, card) => sum + Math.floor(((card.status_def || 0) + (card.status_spd || 0)) / 2), 0),
  };
};

const createSummaryFromBoss = (boss: any, name: string): DeckSummary => ({
  cards: [boss],
  name,
  hp: boss.hp || boss.status_hp || 1000,
  atk: boss.atk || boss.status_atk || 100,
  def: boss.def || boss.status_def || 50,
  spd: boss.spd || boss.status_spd || 40,
  total: (boss.hp || boss.status_hp || 1000) + (boss.atk || boss.status_atk || 100) + (boss.def || boss.status_def || 50) + (boss.spd || boss.status_spd || 40),
  element: boss.element || '無',
  elementPower: (boss.hp || boss.status_hp || 1000) + (boss.atk || boss.status_atk || 100),
  support: (boss.def || boss.status_def || 50) + (boss.spd || boss.status_spd || 40),
});

const getEffectPalette = (effectType: BattleEffectType = 'light') => {
  switch (effectType) {
    case 'heavy':
      return { bg: 'rgba(239, 68, 68, 0.92)', border: '#FCA5A5', text: '#FFF1F2', label: 'HEAVY HIT' };
    case 'support':
      return { bg: 'rgba(16, 185, 129, 0.9)', border: '#A7F3D0', text: '#ECFDF5', label: 'SUPPORT' };
    case 'burst':
      return { bg: 'rgba(245, 158, 11, 0.92)', border: '#FDE68A', text: '#FFFBEB', label: 'ELEMENT BURST' };
    case 'start':
      return { bg: 'rgba(59, 130, 246, 0.9)', border: '#BFDBFE', text: '#EFF6FF', label: 'ENGAGE' };
    case 'finish':
      return { bg: 'rgba(124, 58, 237, 0.92)', border: '#DDD6FE', text: '#F5F3FF', label: 'FINISH' };
    default:
      return { bg: 'rgba(30, 41, 59, 0.92)', border: '#94A3B8', text: '#F8FAFC', label: 'ATTACK' };
  }
};

export default function BattleScreen() {
  const mapRef = useRef<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState({ totalWins: 0, bossDefeats: 0 });
  const [battleLog, setBattleLog] = useState<any[]>([]);
  const [isBattling, setIsBattling] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  
  const [elementRelations, setElementRelations] = useState<ElementRelationMap>({});
  
  const [loadingMap, setLoadingMap] = useState(false);
  const [detectedBoss, setDetectedBoss] = useState<any>(null);
  const [mapBosses, setMapBosses] = useState<any[]>([]);
  const [currentAddress, setCurrentAddress] = useState<string>('現在地を取得中...');
  const [currentPostalCode, setCurrentPostalCode] = useState<string>('');
  const [mapMode, setMapMode] = useState<'normal' | 'boss' | 'territory'>('normal');
  
  const [territories, setTerritories] = useState<any[]>([]);
  const [startPoint, setStartPoint] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isTerritoryModalVisible, setTerritoryModalVisible] = useState(false);
  const [isAttackModalVisible, setAttackModalVisible] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  const [myHighRareCards, setMyHighRareCards] = useState<any[]>([]);
  const [selectedSacrifices, setSelectedSacrifices] = useState<string[]>([]);
  
  const [activeRule, setActiveRule] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const battleEffectAnim = useRef(new Animated.Value(0)).current;
  const [isAsyncResultModalVisible, setAsyncResultModalVisible] = useState(false);
  const [asyncResultData, setAsyncResultData] = useState<any>(null);
  const [battleEffect, setBattleEffect] = useState<{ type: BattleEffectType; label: string } | null>(null);
  const [battleSummary, setBattleSummary] = useState<BattleSummary | null>(null);

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

  useEffect(() => {
    if (!battleEffect) {
      battleEffectAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(battleEffectAnim, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(battleEffectAnim, { toValue: 0, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [battleEffect, battleEffectAnim]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc: any) => {
          setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      );
    })();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

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
    await initialLocationFetch();
    setLoadingMap(false);
  };

  const initialLocationFetch = async () => {
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
          setCurrentAddress(addressString || '詳細不明なエリア');
          setCurrentPostalCode(postal);
        }
      }

      await evaluateSpecialRules(addressString, postal);

      const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
      let foundBoss = null;
      if (campaigns) {
        setCampaignList(campaigns);
        const now = new Date().getTime();
        const targetCampaigns = campaigns.filter((c: any) => {
          if (!c.target_lat || !c.target_lng) return false;
          if (c.end_at && new Date(c.end_at).getTime() < now) return false;
          return true;
        });
        
        if (targetCampaigns.length > 0) {
          const campaignIds = targetCampaigns.map((campaign: any) => campaign.id);
          const { data: bossRows } = await supabase.from('bosses').select('*, fixed_cards(*)').in('trigger_campaign_id', campaignIds);
          const mergedBosses = targetCampaigns
            .map((campaign: any) => {
              const boss = bossRows?.find((row: any) => row.trigger_campaign_id === campaign.id);
              if (!boss) return null;
              return {
                ...boss,
                campaign_title: campaign.title,
                sponsor_name: campaign.sponsor_name,
                lat: campaign.target_lat,
                lng: campaign.target_lng,
                radius_meters: campaign.radius_meters || boss.radius_meters || 1500,
                bossCategory: inferBossCategory(campaign),
              };
            })
            .filter(Boolean);

          setMapBosses(mergedBosses);

          let nearestBoss: any = null;
          let minDistance = Infinity;

          mergedBosses.forEach((boss: any) => {
            const distance = getDistance(latitude, longitude, boss.lat, boss.lng);
            if (distance < minDistance) {
              minDistance = distance;
              nearestBoss = boss;
            }
          });

          if (nearestBoss && minDistance <= (nearestBoss.radius_meters || 5000)) {
            foundBoss = nearestBoss;
          }
        } else {
          setMapBosses([]);
        }
      } else {
        setMapBosses([]);
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
    } catch (e) { console.log('Map Fetch Error:', e); }
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
    } catch (e) {}
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const openWebAR = async (url: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('エラー', 'このURLは開けません: ' + url);
    } catch (error) { Alert.alert('エラー', 'ブラウザの起動に失敗しました。'); }
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

  const markStartPoint = async () => {
    if (!currentLocation) return;
    let addr = currentAddress;
    if (Platform.OS !== 'web') {
      const geocode = await Location.reverseGeocodeAsync({ latitude: currentLocation.lat, longitude: currentLocation.lng });
      if (geocode.length > 0) {
        const g = geocode[0];
        addr = `${g.region || ''}${g.city || ''}${g.street || ''}`;
      }
    }
    const finalAddr = addr || '現在地';
    setStartPoint({ lat: currentLocation.lat, lng: currentLocation.lng, address: finalAddr });
    setMapMode('territory');
    mapRef.current?.animateToRegion({ latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 1000);
    Alert.alert('起点マーカー設置', `「${finalAddr}」を起点として記録しました。\n別の場所に移動して陣地を展開してください。`);
  };

  const cancelStartPoint = () => {
    setStartPoint(null);
    setMapMode(detectedBoss ? 'boss' : 'normal');
    if (currentLocation) {
      mapRef.current?.animateToRegion({ latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: detectedBoss ? 0.02 : 0.005, longitudeDelta: detectedBoss ? 0.02 : 0.005 }, 1000);
    }
  };

  const openTerritoryModal = async () => {
    if (!startPoint || !currentLocation) return;
    const dist = getDistance(startPoint.lat, startPoint.lng, currentLocation.lat, currentLocation.lng);
    if (dist < 5) {
      Alert.alert('距離が近すぎます', '開始位置から最低5メートルは離れてください。');
      return;
    }
    
    if (Platform.OS !== 'web') {
      const geocode = await Location.reverseGeocodeAsync({ latitude: currentLocation.lat, longitude: currentLocation.lng });
      if (geocode.length > 0) {
        const g = geocode[0];
        const addr = `${g.region || ''}${g.city || ''}${g.street || ''}`;
        setCurrentAddress(addr || '詳細不明なエリア');
      }
    }
    
    setSelectedSacrifices([]);
    setTerritoryModalVisible(true);
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

  const confirmTerritoryCreation = async () => {
    if (selectedSacrifices.length !== 2) return;
    const card1 = myHighRareCards.find(c => c.id === selectedSacrifices[0]);
    const card2 = myHighRareCards.find(c => c.id === selectedSacrifices[1]);
    const totalDefense = card1.status_total + card2.status_total;

    Alert.alert(
      '陣地の展開', 
      `「${startPoint?.address}」〜「${currentAddress}」のエリアを制圧し、防衛力[${totalDefense}]の陣地を展開しますか？\n※捧げた2枚のカードは消失します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '展開する', style: 'destructive', onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').insert([{
                player_id: myId, player_name: myProfile?.player_name || '匿名エージェント',
                team_id: myTeam?.id || null, team_name: myTeam?.name || '', team_color: myTeam?.team_color || '',
                start_lat: startPoint?.lat, start_lng: startPoint?.lng, end_lat: currentLocation?.lat, end_lng: currentLocation?.lng,
                start_address: startPoint?.address, end_address: currentAddress, defense_power: totalDefense, 
                card1_name: card1.card_name, card2_name: card2.card_name
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
      Alert.alert('戦力不足', `防衛力[${selectedTerritory.defense_power}]に対し、あなたの戦力は[${myAttackPower}]です。ステータスが足りません。`); return;
    }

    Alert.alert('圧倒的制圧', `捧げたカードの力[${myAttackPower}]が防衛力[${selectedTerritory.defense_power}]を上回りました！\nこの陣地を強奪しますか？\n※捧げた2枚のカードは消失します。`, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '強奪する', style: 'destructive', onPress: async () => {
            setLoadingMap(true);
            try {
              await supabase.from('territories').update({
                player_id: myId, player_name: myProfile?.player_name || '匿名', team_id: myTeam?.id || null, team_name: myTeam?.name || '', team_color: myTeam?.team_color || '',
                defense_power: myAttackPower, card1_name: c1.card_name, card2_name: c2.card_name
              }).eq('id', selectedTerritory.id);
              await supabase.from('cards').update({ is_active: false }).in('id', selectedSacrifices);
              Alert.alert('制圧完了', '敵の陣地を奪い取りました！');
              setAttackModalVisible(false); initBattleData();
            } catch(e) {}
            setLoadingMap(false);
        }}
    ]);
  };

  const attackTerritoryByBattle = async () => {
    setAttackModalVisible(false); setIsBattling(true); setBattleLog([]);
    const { data: myDeck } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true);
    if (!myDeck || myDeck.length === 0) { Alert.alert('出撃不可', '出撃可能なデッキがありません。カード一覧からアクティブにしてください。'); setIsBattling(false); return; }

    const defStats = Math.floor(selectedTerritory.defense_power / 4);
    const bossMonster = { 
      hp: defStats * 2, atk: defStats, def: defStats, spd: 50, element: '虚無'
    };

    const myDeckSummary = summarizeDeck(myDeck, myProfile?.player_name || 'あなた');
    const barrierSummary = createSummaryFromBoss(bossMonster, `【防衛結界】${selectedTerritory.card1_name} & ${selectedTerritory.card2_name}`);
    setBattleSummary({ mode: 'territory', player: myDeckSummary, opponent: barrierSummary });

    simulateBattle(myDeckSummary, barrierSummary, false, async (isWin) => {
      if (isWin) {
        await supabase.from('territories').delete().eq('id', selectedTerritory.id);
        Alert.alert('結界破壊！', '見事バトルに勝利し、相手の陣地を破壊しました！'); initBattleData();
      } else { Alert.alert('敗北', '防衛結界の前に敗れ去りました...'); }
    });
  };

  const startPvpBattle = async () => {
    setIsBattling(true); setBattleLog([]);
    const { data: myDeck, error: myError } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true);
    if (myError || !myDeck || myDeck.length === 0) {
      Alert.alert('出撃エラー', 'アクティブなデッキがありません。図鑑から5枚まで出撃設定してください。'); setIsBattling(false); return;
    }

    const myDeckSummary = summarizeDeck(myDeck, myProfile?.player_name || 'あなた');
    const minS = Math.floor(myDeckSummary.total * 0.75);
    const maxS = Math.floor(myDeckSummary.total * 1.25);
    const { data: oppDeckRows, error: oppError } = await supabase
      .from('cards')
      .select('player_id, element, status_total, status_hp, status_atk, status_def, status_spd, profiles!inner(player_name)')
      .neq('player_id', myId)
      .eq('is_active', true)
      .gte('status_total', Math.max(1, Math.floor(minS / Math.max(myDeck.length, 1))))
      .lte('status_total', Math.max(1, Math.ceil(maxS / Math.max(myDeck.length, 1))));

    if (oppError || !oppDeckRows || oppDeckRows.length === 0) {
      Alert.alert('検索結果', '現在、同格のライバルが見つかりませんでした。時間をおいて再度お試しください。'); setIsBattling(false); return;
    }

    const groupedOpponents = Array.from(
      oppDeckRows.reduce((map: Map<string, any>, row: any) => {
        const existing = map.get(row.player_id) || { player_id: row.player_id, player_name: row.profiles?.player_name || '匿名プレイヤー', cards: [] };
        existing.cards.push(row);
        map.set(row.player_id, existing);
        return map;
      }, new Map<string, any>()).values()
    ).map((entry: any) => ({
      ...entry,
      summary: summarizeDeck(entry.cards, entry.player_name),
    })).filter((entry: any) => entry.summary.total >= minS && entry.summary.total <= maxS);

    if (groupedOpponents.length === 0) {
      Alert.alert('検索結果', '現在、近い総戦力の相手が見つかりませんでした。'); setIsBattling(false); return;
    }

    const opponent = groupedOpponents.sort((left: any, right: any) => Math.abs(left.summary.total - myDeckSummary.total) - Math.abs(right.summary.total - myDeckSummary.total))[0];
    const opponentSummary = opponent.summary;
    setBattleSummary({
      mode: 'pvp',
      player: myDeckSummary,
      opponent: opponentSummary,
    });

    simulateBattle(myDeckSummary, opponentSummary, false, async (isWin, logs) => {
      if (isWin) {
        const newWins = playerStats.totalWins + 1;
        await supabase.from('profiles').update({ total_wins: newWins }).eq('id', myId);
        setPlayerStats(prev => ({ ...prev, totalWins: newWins }));
      }

      await supabase.from('arena_battles').insert([{ 
        challenger_id: myId,
        defender_id: opponent.player_id,
        winner_id: isWin ? myId : opponent.player_id,
        battle_log: logs.map((entry: BattleLogEntry) => entry.text),
      }]);

      const leadCardId = myDeck[0]?.id;
      if (leadCardId) {
        await supabase.rpc('gain_card_exp', { target_card_id: leadCardId, exp_to_add: isWin ? 120 : 30 });
      }
    });
  };

  const startBossBattle = async () => {
    if (!detectedBoss) return;
    setIsBattling(true); setBattleLog([]);
    const { data: myDeck } = await supabase.from('cards').select('*').eq('player_id', myId).eq('is_active', true);
    if (!myDeck || myDeck.length === 0) { Alert.alert('出撃不可', '出撃可能なアクティブデッキがありません。'); setIsBattling(false); return; }

    const myDeckSummary = summarizeDeck(myDeck, myProfile?.player_name || 'あなた');
    const bossSummary = createSummaryFromBoss(detectedBoss, detectedBoss.name);
    setBattleSummary({ mode: 'boss', player: myDeckSummary, opponent: bossSummary });

    simulateBattle(myDeckSummary, bossSummary, true, async (isWin) => {
      if (isWin) {
        const newDefs = playerStats.bossDefeats + 1;
        await supabase.from('profiles').update({ boss_defeats: newDefs }).eq('id', myId);
        setPlayerStats(prev => ({ ...prev, bossDefeats: newDefs }));
        
        const reward = detectedBoss.fixed_cards;
        if (reward) {
          await supabase.from('rewards').insert([{ 
            player_id: myId, title: `🎁 ボス討伐報酬: ${reward.card_name}`,
            description: `エリアボス「${detectedBoss.name}」を見事討伐した報酬の限定カードです！`, reward_type: 'card',
            reward_data: {
              card_name: reward.card_name, image_url: reward.image_url,
              status_total: reward.stats.hp + reward.stats.atk + reward.stats.def + reward.stats.spd,
              status_hp: reward.stats.hp, status_atk: reward.stats.atk, status_def: reward.stats.def, status_spd: reward.stats.spd,
              rarity: reward.stats.rarity || 'P', element: detectedBoss.element || '火', is_fixed: true
            },
            is_claimed: false
          }]);
        }
        Alert.alert('👹 ボス討伐！', '限定カードを獲得しました！\n「報酬」ボックスから受け取ってください。');
      }
    });
  };

  const simulateBattle = (p1: DeckSummary, p2: DeckSummary, isBossMode: boolean, callback: (isWin: boolean, logs: BattleLogEntry[]) => void) => {
    type RuntimeCombatant = {
      name: string;
      hp: number;
      maxHp: number;
      atk: number;
      def: number;
      spd: number;
      element: string;
      support: number;
      shield: number;
      total: number;
    };

    const fighterA: RuntimeCombatant = { name: p1.name, hp: p1.hp, maxHp: p1.hp, atk: p1.atk, def: p1.def, spd: p1.spd, element: p1.element, support: p1.support, shield: 0, total: p1.total };
    const fighterB: RuntimeCombatant = { name: p2.name, hp: p2.hp, maxHp: p2.hp, atk: p2.atk, def: p2.def, spd: p2.spd, element: p2.element, support: p2.support, shield: 0, total: p2.total };

    const log: BattleLogEntry[] = [
      { text: `🏁 交戦開始\n${fighterA.name} [${fighterA.element}] 総戦力 ${fighterA.total} VS ${fighterB.name} [${fighterB.element}] 総戦力 ${fighterB.total}`, isSpecial: true, effectType: 'start' },
    ];

    const performAction = (attacker: RuntimeCombatant, defender: RuntimeCombatant, turn: number) => {
      const relation = getDamageMultiplier(attacker.element || '無', defender.element || '無', elementRelations);
      const roll = Math.random();
      let effectType: BattleEffectType = 'light';
      let text = '';

      if (roll < 0.22) {
        effectType = 'support';
        const heal = Math.floor(attacker.support * (0.18 + Math.random() * 0.12));
        const shieldGain = Math.floor(attacker.def * 0.12);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        attacker.shield += shieldGain;
        text = `[T-${turn}] ${attacker.name}が支援指令を発動。\nHPを${heal}回復し、シールド${shieldGain}を展開。`;
        return { effectType, text };
      }

      let damageBase = Math.max(1, attacker.atk - Math.floor(defender.def * 0.35));
      if (roll < 0.58) {
        effectType = 'light';
        damageBase = Math.floor(damageBase * (0.7 + Math.random() * 0.2));
        text = `[T-${turn}] ${attacker.name}の牽制攻撃。`;
      } else if (roll < 0.88) {
        effectType = 'heavy';
        damageBase = Math.floor(damageBase * (1.1 + Math.random() * 0.35));
        text = `[T-${turn}] ${attacker.name}の強打。`;
      } else {
        effectType = 'burst';
        damageBase = Math.floor(damageBase * (1.25 + Math.random() * 0.4));
        text = `[T-${turn}] ${attacker.name}が属性バーストを解放。`;
      }

      const damage = Math.max(1, Math.floor(damageBase * relation.multiplier));
      let remainingDamage = damage;
      if (defender.shield > 0) {
        const absorbed = Math.min(defender.shield, remainingDamage);
        defender.shield -= absorbed;
        remainingDamage -= absorbed;
      }
      defender.hp = Math.max(0, defender.hp - remainingDamage);
      text += `\n${relation.label ? `${relation.label} ` : ''}${damage}ダメージ。残HP ${defender.hp}`;
      return { effectType, text };
    };

    const first = fighterA.spd >= fighterB.spd ? fighterA : fighterB;
    const second = first === fighterA ? fighterB : fighterA;
    let winner: RuntimeCombatant | null = null;

    for (let turn = 1; turn <= 8; turn++) {
      const firstAction = performAction(first, second, turn);
      log.push({ text: firstAction.text, effectType: firstAction.effectType });
      if (second.hp <= 0) {
        winner = first;
        break;
      }

      const secondAction = performAction(second, first, turn);
      log.push({ text: secondAction.text, effectType: secondAction.effectType });
      if (first.hp <= 0) {
        winner = second;
        break;
      }
    }

    if (!winner) {
      winner = fighterA.hp >= fighterB.hp ? fighterA : fighterB;
      log.push({ text: `⏱️ 規定ターン終了。残耐久の多い ${winner.name} が判定勝ち。`, isSpecial: true, effectType: 'finish' });
    } else {
      log.push({ text: `🏆 決着。勝者: ${winner.name}${isBossMode && winner === fighterA ? '。ボス反応停止を確認。' : ''}`, isSpecial: true, effectType: 'finish' });
    }

    setBattleLog([]);
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < log.length) {
        const entry = log[currentLogIndex];
        setBattleLog(prev => [...prev, entry]);
        if (entry.effectType) {
          setBattleEffect({ type: entry.effectType, label: getEffectPalette(entry.effectType).label });
        }
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setBattleEffect(null);
        setIsBattling(false);
        callback(winner === fighterA, log);
      }
    }, 850);
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
            description: `エリアボス「${detectedBoss.name}」をデッキの力で討伐した報酬の限定カードです！`, reward_type: 'card',
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

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 150 }} scrollEnabled={isScrollEnabled}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 リアルマップ：陣取り(テリトリー) ＆ ボス</Text>
          {loadingMap ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ padding: 20 }} />
          ) : (
            <View 
              style={styles.mapPanel}
              onTouchStart={() => setIsScrollEnabled(false)}
              onTouchEnd={() => setIsScrollEnabled(true)}
              onTouchCancel={() => setIsScrollEnabled(true)}
            >
              <MapView 
                ref={mapRef}
                provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE} 
                style={styles.map} 
                showsUserLocation={false} 
                customMapStyle={getMapStyle()}
                region={currentLocation ? {
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lng,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05
                } : {
                  latitude: 35.6762,
                  longitude: 139.6503,
                  latitudeDelta: 20,
                  longitudeDelta: 20
                }}
              >
                {currentLocation && (
                  <Marker coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }} zIndex={999}>
                    <View style={styles.currentLocationMarker}>
                      <View style={styles.currentLocationDot} />
                    </View>
                  </Marker>
                )}

                {mapBosses.map((boss) => {
                  const circleStyle = getBossCircleStyle(boss.bossCategory || 'sponsored');
                  const isSelected = detectedBoss?.trigger_campaign_id === boss.trigger_campaign_id;
                  return (
                    <React.Fragment key={`boss-${boss.trigger_campaign_id}`}>
                      <Circle
                        center={{ latitude: boss.lat, longitude: boss.lng }}
                        radius={boss.radius_meters || 1500}
                        fillColor={circleStyle.fillColor}
                        strokeColor={circleStyle.strokeColor}
                        strokeWidth={circleStyle.strokeWidth}
                        tappable={false}
                      />
                      <Marker
                        coordinate={{ latitude: boss.lat, longitude: boss.lng }}
                        onPress={() => {
                          setDetectedBoss(boss);
                          setMapMode('boss');
                          mapRef.current?.animateToRegion({ latitude: boss.lat, longitude: boss.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
                        }}
                      >
                        <Animated.View style={[
                          styles.bossMarker,
                          {
                            width: circleStyle.markerSize + 12,
                            height: circleStyle.markerSize + 12,
                            borderRadius: circleStyle.markerSize,
                            transform: [{ scale: isSelected ? pulseAnim : 1 }],
                            borderColor: getBossFeatureStyle(boss).color,
                            backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.96)' : 'rgba(127, 29, 29, 0.92)',
                          },
                        ]}>
                          <Text style={{ fontSize: circleStyle.markerSize > 24 ? 24 : 18 }}>👹</Text>
                        </Animated.View>
                      </Marker>
                    </React.Fragment>
                  );
                })}
                {startPoint && (
                  <Marker coordinate={{ latitude: startPoint.lat, longitude: startPoint.lng }}>
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

              {battleEffect && (() => {
                const palette = getEffectPalette(battleEffect.type);
                return (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.battleEffectOverlay,
                      {
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                        opacity: battleEffectAnim,
                        transform: [{ scale: battleEffectAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
                      },
                    ]}
                  >
                    <Text style={[styles.battleEffectLabel, { color: palette.text }]}>{battleEffect.label}</Text>
                  </Animated.View>
                );
              })()}

              {detectedBoss && (() => {
                const feature = getBossFeatureStyle(detectedBoss);
                const bossCircle = getBossCircleStyle(detectedBoss.bossCategory || 'sponsored');
                return (
                  <Animated.View style={[styles.bossInfoOverlay, feature.isSuper && { transform: [{ scale: pulseAnim }], shadowColor: feature.color, shadowOpacity: 0.8, shadowRadius: 10 }]}>
                    <View style={styles.bossHeader}>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                        <Text style={[styles.sponsorTag, {backgroundColor: feature.color, color: '#FFF'}]}>{feature.label}</Text>
                        <Text style={[styles.bossTypeTag, { borderColor: bossCircle.strokeColor, color: feature.color }]}>{bossCircle.label}</Text>
                        <Text style={styles.elementTag}>[{detectedBoss.element}]</Text>
                        {feature.isSuper && <Text style={styles.superWarning}>⚠️ SUPER BOSS</Text>}
                      </View>
                      <Text style={styles.bossName}>{detectedBoss.name}</Text>
                      <Text style={styles.bossStatsDetail}>HP:{detectedBoss.hp} ATK:{detectedBoss.atk} DEF:{detectedBoss.def} SPD:{detectedBoss.spd || 40}</Text>
                      <Text style={styles.bossSponsorDetail}>{detectedBoss.sponsor_name || '運営'} / 交戦半径 {Math.round(detectedBoss.radius_meters || 1500)}m</Text>
                    </View>

                    <View style={styles.bossEncounterCard}>
                      {detectedBoss.image_url ? <Image source={{ uri: detectedBoss.image_url }} style={styles.bossEncounterImage} /> : null}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.encounterTitle}>ENCOUNTER TARGET</Text>
                        <Text style={styles.encounterBody}>遭遇時は相手デザインと総合戦力を表示し、バトルはデッキ総合値と属性相性からリアルタイムに演算します。</Text>
                        <Text style={styles.encounterStats}>推定総戦力 {detectedBoss.hp + detectedBoss.atk + detectedBoss.def + (detectedBoss.spd || 40)}</Text>
                      </View>
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
            <Text style={styles.pvpInfoText}>マッチング後は相手デッキの内訳を伏せ、ユーザー名・総戦力・属性値のみを扱う遠隔戦です。開始時点で戦闘は最後まで進行し、防衛レポートにも記録されます。</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#0F172A' }, isBattling && styles.disabledButton]} onPress={startPvpBattle} disabled={isBattling}>
              <Text style={styles.btnText}>{isBattling ? '戦闘計算中...' : '対戦相手を自動検索'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {battleSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 交戦ブリーフ</Text>
            <View style={styles.battleSummaryPanel}>
              <View style={styles.battleSummarySide}>
                <Text style={styles.battleSummaryName}>{battleSummary.player.name}</Text>
                <Text style={styles.battleSummaryMeta}>総戦力 {battleSummary.player.total}</Text>
                <Text style={styles.battleSummaryMeta}>属性 {battleSummary.player.element} / 属性値 {battleSummary.player.elementPower}</Text>
              </View>
              <Text style={styles.battleSummaryVs}>VS</Text>
              <View style={styles.battleSummarySide}>
                <Text style={styles.battleSummaryName}>{battleSummary.opponent.name}</Text>
                <Text style={styles.battleSummaryMeta}>総戦力 {battleSummary.opponent.total}</Text>
                <Text style={styles.battleSummaryMeta}>属性 {battleSummary.opponent.element} / 属性値 {battleSummary.opponent.elementPower}</Text>
              </View>
            </View>
          </View>
        )}

        {battleLog.length > 0 && (
          <View style={styles.logSection}>
            <Text style={styles.logSectionTitle}>⚡ 同期バトル実況ログ</Text>
            {battleLog.map((log, index) => (
              <View key={index} style={[
                styles.logBox,
                log.isSpecial && styles.specialLogBox,
                log.effectType && { borderColor: getEffectPalette(log.effectType).border, backgroundColor: getEffectPalette(log.effectType).bg.replace('0.9', '0.08').replace('0.92', '0.08') },
              ]}>
                {log.effectType && <Text style={[styles.logEffectChip, { color: getEffectPalette(log.effectType).bg, borderColor: getEffectPalette(log.effectType).border }]}>{getEffectPalette(log.effectType).label}</Text>}
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
            <View style={{ marginVertical: 12 }}>
              <View style={styles.addressRouteRow}>
                <Text style={styles.addressRouteLabel}>📍 起点</Text>
                <Text style={styles.addressRouteValue}>{startPoint?.address}</Text>
              </View>
              <View style={styles.addressRouteLine} />
              <View style={styles.addressRouteRow}>
                <Text style={styles.addressRouteLabel}>🏁 終点</Text>
                <Text style={styles.addressRouteValue}>{currentAddress}</Text>
              </View>
            </View>
            <Text style={styles.modalDesc}>展開するには2枚のカードを生贄に捧げる必要があります。</Text>
            
            {activeRule && activeRule.require_fixed_card && (
              <View style={styles.warningBox}><Text style={styles.warningText}>⚠️ このエリア/時間帯は特殊ルールが適用されています。企業協賛カード等しか生贄にできません。</Text></View>
            )}
            
            <FlatList
              data={myHighRareCards} keyExtractor={item => item.id} horizontal style={{marginBottom: 16, maxHeight: 110}}
              renderItem={({item}) => {
                const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                return (
                  <TouchableOpacity style={[styles.miniCard, {width: 100, marginRight: 8}, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]} onPress={() => toggleSacrifice(item)} activeOpacity={isRestricted ? 1 : 0.7}>
                    <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                    <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                    {item.is_fixed && <Text style={{fontSize: 9, color: '#EF4444', fontWeight:'bold'}}>協賛カード</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.cancelBtn, {flex: 1}]} onPress={() => setTerritoryModalVisible(false)}><Text style={styles.cancelBtnText}>やめる</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, {flex: 2}, selectedSacrifices.length !== 2 && {backgroundColor: '#94A3B8'}]} onPress={confirmTerritoryCreation} disabled={selectedSacrifices.length !== 2}>
                <Text style={styles.confirmBtnText}>2枚捧げて展開する</Text>
              </TouchableOpacity>
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
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4}}>
                <Text style={styles.terrDefense}>防衛力: {selectedTerritory?.defense_power}</Text>
              </View>
              <Text style={styles.terrCards}>防衛カード: {selectedTerritory?.card1_name} & {selectedTerritory?.card2_name}</Text>
            </View>
            
            {selectedTerritory?.player_id === myId ? (
              <Text style={styles.modalDesc}>これはあなたの支配領域です。</Text>
            ) : (
              <>
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0F172A', marginBottom: 20}]} onPress={attackTerritoryByBattle}>
                  <Text style={styles.confirmBtnText}>出撃カードで結界を破壊する(バトル)</Text>
                </TouchableOpacity>
                
                <Text style={styles.label}>またはより強い生贄で陣地を強奪</Text>
                <FlatList
                  data={myHighRareCards} keyExtractor={item => item.id} horizontal style={{marginBottom: 20, maxHeight: 110}}
                  renderItem={({item}) => {
                    const isRestricted = activeRule && activeRule.require_fixed_card && !item.is_fixed;
                    return (
                      <TouchableOpacity style={[styles.miniCard, {width: 100, marginRight: 8}, selectedSacrifices.includes(item.id) && styles.selectedMiniCard, isRestricted && {opacity: 0.3}]} onPress={() => toggleSacrifice(item)}>
                        <Image source={{uri: item.image_url}} style={styles.miniCardImg} />
                        <Text style={styles.miniCardName} numberOfLines={1}>{item.card_name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#EF4444'}, selectedSacrifices.length !== 2 && {backgroundColor: '#FCA5A5'}]} onPress={overwriteTerritory} disabled={selectedSacrifices.length !== 2}>
                  <Text style={styles.confirmBtnText}>2枚捧げて強奪する</Text>
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
  map: { width: '100%', height: '100%' },
  
  currentLocationMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(59, 130, 246, 0.25)', justifyContent: 'center', alignItems: 'center' },
  currentLocationDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  
  bossMarker: { backgroundColor: 'rgba(239, 68, 68, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 5, borderWidth: 3, borderColor: '#DC2626' },
  startMarker: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  teamBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
  teamBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  battleEffectOverlay: { position: 'absolute', top: '38%', alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, borderWidth: 2, zIndex: 8 },
  battleEffectLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 0.8 },

  bossInfoOverlay: { position: 'absolute', top: 15, left: 15, right: 15, backgroundColor: 'rgba(255, 255, 255, 0.98)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  bossHeader: { marginBottom: 10 },
  sponsorTag: { fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 },
  bossTypeTag: { fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginRight: 6, borderWidth: 1, backgroundColor: '#FFFFFF' },
  elementTag: { fontSize: 10, fontWeight: '800', color: '#64748B', marginRight: 6 },
  superWarning: { fontSize: 10, fontWeight: '900', color: '#EF4444', fontStyle: 'italic' },
  bossName: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginTop: 4 },
  bossStatsDetail: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  bossSponsorDetail: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 2 },
  bossEncounterCard: { flexDirection: 'row', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  bossEncounterImage: { width: 72, height: 96, borderRadius: 12, backgroundColor: '#E2E8F0' },
  encounterTitle: { color: '#0F172A', fontSize: 11, fontWeight: '900', marginBottom: 4 },
  encounterBody: { color: '#475569', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  encounterStats: { color: '#B91C1C', fontSize: 12, fontWeight: '900', marginTop: 8 },
  
  bossActionRow: { flexDirection: 'row', gap: 8 },
  bossAttackBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bossAsyncBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 10, borderWidth: 2, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  bossArBtn: { flexDirection: 'row', height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  bossBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

  territoryControls: { position: 'absolute', bottom: 15, left: 15, right: 15 },
  terrBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  terrBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  pvpPanel: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  pvpInfoText: { color: '#64748B', fontSize: 12, lineHeight: 19, marginBottom: 14, fontWeight: '700' },
  primaryButton: { flexDirection: 'row', width: '100%', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: '#CBD5E1' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  battleSummaryPanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  battleSummarySide: { flex: 1 },
  battleSummaryVs: { color: '#94A3B8', fontSize: 18, fontWeight: '900', marginHorizontal: 12 },
  battleSummaryName: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  battleSummaryMeta: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  
  logSection: { padding: 20, backgroundColor: '#FFFFFF' },
  logSectionTitle: { color: '#475569', fontSize: 12, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  logBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', padding: 16, borderRadius: 16, marginBottom: 12 },
  specialLogBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  logEffectChip: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '900', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8, backgroundColor: '#FFFFFF' },
  logText: { color: '#334155', fontSize: 14, fontWeight: '500' },
  specialLogText: { color: '#1E40AF', fontWeight: '800' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalHeader: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  modalDesc: { color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 20 },
  
  addressRouteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, backgroundColor: '#F8FAFC', paddingHorizontal: 12, borderRadius: 8 },
  addressRouteLabel: { color: '#3B82F6', fontWeight: '900', fontSize: 13, width: 60 },
  addressRouteValue: { color: '#0F172A', fontWeight: '700', fontSize: 14, flex: 1 },
  addressRouteLine: { width: 2, height: 16, backgroundColor: '#E2E8F0', marginLeft: 30 },
  addressRouteText: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, color: '#3B82F6', fontWeight: '800', fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 20 },
  warningBox: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 16 },
  warningText: { color: '#B91C1C', fontSize: 12, fontWeight: '800', lineHeight: 18 },

  label: { color: '#475569', fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  terrInfoBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  terrOwner: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  terrDefense: { fontSize: 20, fontWeight: '900', color: '#EF4444' },
  terrCards: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 6 },
  
  miniCard: { flex: 1, margin: 4, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  selectedMiniCard: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  miniCardImg: { width: '100%', height: 60, borderRadius: 8, marginBottom: 6, resizeMode: 'cover' },
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
