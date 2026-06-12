import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, ScrollView, Modal, Animated, Easing, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
// 💡【修正】階層パスを ../../ から ../ に変更
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, MapPin, ShoppingBag } from 'lucide-react-native';

let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [bosses, setBosses] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const [forgedCardResult, setForgedCardResult] = useState<any | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);

  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const effectFlashOp = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
    if (showResultModal && forgedCardResult) {
      startResultEffect(forgedCardResult.rarity);
    }
  }, [showResultModal, forgedCardResult]);

  const fetchData = async () => {
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    const { data: bData } = await supabase.from('bosses').select('*').eq('is_active', true);
    const { data: sData } = await supabase.from('shop_items').select('*').eq('is_active', true);
    
    if (campaigns) setActiveCampaigns(campaigns);
    if (bData) setBosses(bData);
    if (sData) setShopItems(sData);

    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation(loc.coords);
        } catch (e) {
          console.log("位置情報取得エラー:", e);
        }
      }
    }
  };

  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'UR': return { color: '#FBBF24', shakeIntensity: 2.5, effectTitle: '🌟【UR】神・実体化！！🌟' };
      case 'SSR': return { color: '#EF4444', shakeIntensity: 1.5, effectTitle: '🔥【SSR】超・実体化！！🔥' };
      case 'SR': return { color: '#A855F7', shakeIntensity: 0.8, effectTitle: '⚡【SR】強・実体化！⚡' };
      case 'R': return { color: '#3B82F6', shakeIntensity: 0, effectTitle: '✨【R】レア・実体化✨' };
      case 'DUST': return { color: '#3F3F46', shakeIntensity: 0.5, effectTitle: '⚠️【ERROR】ノイズ・実体化⚠️' };
      case 'N': default: return { color: '#FFFFFF', shakeIntensity: 0, effectTitle: '⚙️【N】通常・実体化' };
    }
  };

  const startResultEffect = (rarity: string) => {
    cardScale.setValue(0.3);
    cardOpacity.setValue(0);
    effectFlashOp.setValue(0);
    shakeX.setValue(0);

    const config = getRarityConfig(rarity);

    const cardIn = Animated.parallel([
      Animated.timing(cardScale, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
    ]);

    const effectFlash = Animated.sequence([
      Animated.timing(effectFlashOp, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(effectFlashOp, { toValue: 0, duration: 450, useNativeDriver: true })
    ]);

    Animated.sequence([
      Animated.delay(100), cardIn, Animated.delay(50), effectFlash
    ]).start(() => {
      if (config.shakeIntensity > 0) {
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 10 * config.shakeIntensity, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10 * config.shakeIntensity, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 10 * config.shakeIntensity, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true })
        ]).start();
      }
    });
  };

  const takePhoto = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPerm.granted) {
      Alert.alert('カメラへのアクセス', 'カードを作成するためにカメラへのアクセスを許可してください。');
      return;
    }

    let userLat: number | null = null;
    let userLng: number | null = null;

    if (Platform.OS !== 'web') {
      const locationPerm = await Location.requestForegroundPermissionsAsync();
      if (locationPerm.granted) {
        try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userLat = location.coords.latitude;
          userLng = location.coords.longitude;
        } catch (e) { console.log(e); }
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      forgeCard(result.assets[0].base64, userLat, userLng);
    }
  };

  const forgeCard = async (base64Img: string, lat: number | null, lng: number | null) => {
    setLoading(true);
    setDebugError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証エラー: ログインし直してください');

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像アップロードエラー: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      let aiResultData: any;

      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
          body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: true, customName: customName, activeCampaigns, userLat: lat, userLng: lng }
        });
        
        if (aiError || !aiData || aiData.error) {
          throw new Error("AI通信障害");
        }
        aiResultData = aiData;

      } catch (apiError) {
        console.warn("API通信エラーを検知。ダストカードを生成します。");
        aiResultData = {
          card_name: "UNKNOWN_ENTITY",
          skill_name: "システム・クラッシュ",
          status_hp: 404,
          status_atk: 404,
          status_def: 404,
          status_spd: 404,
          rarity: "DUST", 
          feature: "解析不能。エラーにより生み出されたノイズデータの塊。",
          is_fixed: false,
          ar_model_url: null,
          campaign_id: null
        };
      }

      const finalName = aiResultData.card_name || aiResultData.name || '名称不明';
      const finalSkill = aiResultData.skill_name || aiResultData.skill || '通常攻撃';
      const finalHp = aiResultData.status_hp || aiResultData.hp || 100;
      const finalAtk = aiResultData.status_atk || aiResultData.atk || 10;
      const finalDef = aiResultData.status_def || aiResultData.def || 10;
      const finalSpd = aiResultData.status_spd || aiResultData.spd || 10;
      const finalRarity = aiResultData.rarity || 'N';

      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: finalName,
        image_url: publicUrl,
        feature: aiResultData.feature || '',
        skill_name: finalSkill,
        status_hp: finalHp,
        status_atk: finalAtk,
        status_def: finalDef,
        status_spd: finalSpd,
        status_total: finalHp + finalAtk + finalDef + finalSpd,
        rarity: finalRarity,
        card_type: aiResultData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiResultData.campaign_id || null,
        location_lat: lat,
        location_lng: lng,
        is_fixed: aiResultData.is_fixed || false,
        ar_model_url: aiResultData.ar_model_url || null,
        card_role: Math.random() > 0.7 ? 'support' : 'attacker',
        is_active: false
      }]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      const completeCardData = {
        card_name: finalName,
        image_url: publicUrl,
        rarity: finalRarity,
        status_total: finalHp + finalAtk + finalDef + finalSpd,
        skill_name: finalSkill,
      };
      
      setForgedCardResult(completeCardData);
      setShowResultModal(true);
      setCustomName('');
      
    } catch (error: any) {
      console.error("🚨 致命的エラー:", error);
      setDebugError(error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  const handleShopItemPress = (item: any) => {
    Alert.alert(
      'パック購入',
      `${item.name} を ${item.price}G で購入しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '購入', onPress: () => Alert.alert('購入完了', '（※ここに購入時のパック開封処理を実装します）') }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {debugError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>🚨 致命的なエラー</Text>
          <ScrollView style={{ maxHeight: 150 }}>
            <Text style={styles.errorText}>{debugError}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.errorCloseBtn} onPress={() => setDebugError(null)}>
            <Text style={styles.errorCloseText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showResultModal} animationType="fade" transparent={true} onRequestClose={() => { setShowResultModal(false); router.push('/(tabs)') }}>
        <Animated.View style={[styles.modalOverlay, { transform: [{ translateX: shakeX }] }]}>
          
          {forgedCardResult && (
            <Animated.View style={[styles.flashOverlay, { 
              backgroundColor: getRarityConfig(forgedCardResult.rarity).color, 
              opacity: effectFlashOp 
            }]} pointerEvents="none" />
          )}

          <View style={[styles.modalContent, forgedCardResult?.rarity === 'DUST' && styles.modalContentDust]}>
            
            {forgedCardResult && (
              <>
                <Text style={[styles.resultTitle, { color: getRarityConfig(forgedCardResult.rarity).color }]}>
                  {getRarityConfig(forgedCardResult.rarity).effectTitle}
                </Text>

                <Animated.View style={[styles.resultCardContainer, { 
                  transform: [{ scale: cardScale }], 
                  opacity: cardOpacity,
                  borderColor: getRarityConfig(forgedCardResult.rarity).color
                }]}>
                  <Image source={{ uri: forgedCardResult.image_url }} style={[styles.resultCardImg, forgedCardResult.rarity === 'DUST' && { opacity: 0.6 }]} />
                  <View style={[styles.resultRarityBadge, { backgroundColor: getRarityConfig(forgedCardResult.rarity).color }]}>
                    <Text style={styles.resultRarityText}>{forgedCardResult.rarity}</Text>
                  </View>
                </Animated.View>

                <Text style={[styles.resultCardName, forgedCardResult.rarity === 'DUST' && { color: '#E4E4E7' }]} numberOfLines={1}>{forgedCardResult.card_name}</Text>
                <Text style={styles.resultCardSkill} numberOfLines={1}>【{forgedCardResult.skill_name}】</Text>
                <Text style={[styles.resultCardPower, forgedCardResult.rarity === 'DUST' && { backgroundColor: '#3F3F46', color: '#F87171' }]}>総合力: {forgedCardResult.status_total}</Text>
              </>
            )}

            <TouchableOpacity style={[styles.closeResultBtn, forgedCardResult?.rarity === 'DUST' && { backgroundColor: '#E11D48' }]} onPress={() => { setShowResultModal(false); router.push('/(tabs)') }}>
              <Text style={styles.closeResultBtnText}>図鑑へ登録</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.statusRow}>
          <View style={[styles.ticketPill, styles.premiumPill]}>
            <Text style={[styles.ticketText, styles.premiumText]}>🛠️ 開発モード: 無制限</Text>
          </View>
        </View>

        {/* 🗺️ 冒険マップセクション */}
        <View style={styles.sectionHeaderContainer}>
          <MapPin color="#0F172A" size={20} />
          <Text style={styles.sectionHeader}>周辺のスポット限定ボス</Text>
        </View>
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.mapWebFallback}>
              <MapPin color="#94A3B8" size={32} style={{ marginBottom: 8 }} />
              <Text style={styles.mapWebFallbackText}>Webプレビューでは地図は非表示です</Text>
              <Text style={styles.mapWebFallbackSub}>※実機またはシミュレータで確認してください</Text>
            </View>
          ) : userLocation && MapView ? (
            <MapView
              style={styles.map}
              showsUserLocation={true}
              showsMyLocationButton={true}
              initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {bosses.map((boss) => (
                <Marker
                  key={boss.id}
                  coordinate={{ latitude: boss.lat, longitude: boss.lng }}
                  title={boss.name}
                  description={`推奨Lv: ?? / ドロップ: ${boss.drop_card_name || '不明'}`}
                  pinColor="#E11D48"
                />
              ))}
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.mapLoadingText}>現在地を取得中...</Text>
            </View>
          )}
        </View>

        {/* 🛒 リアルショップセクション */}
        <View style={styles.sectionHeaderContainer}>
          <ShoppingBag color="#0F172A" size={20} />
          <Text style={styles.sectionHeader}>ショップ（最新陳列）</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopScroll}>
          {shopItems.length > 0 ? (
            shopItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.shopItem} onPress={() => handleShopItemPress(item)}>
                <Image source={{ uri: item.banner_url || 'https://via.placeholder.com/150' }} style={styles.shopImg} />
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.shopPrice}>{item.price} G</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>現在販売中のパックはありません。</Text>
          )}
        </ScrollView>

        {/* 📸 カメラ起動（Forge機能） */}
        <View style={styles.forgeSection}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>カードを錬成中...</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="好きな名前を指定 (任意)"
                placeholderTextColor="#94A3B8"
                value={customName}
                onChangeText={setCustomName}
                maxLength={15}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={takePhoto} activeOpacity={0.8}>
                <Camera color="#FFFFFF" size={28} style={{ marginRight: 10 }} />
                <Text style={styles.primaryButtonText}>カメラを起動</Text>
              </TouchableOpacity>
              <Text style={styles.subText}>現実の風景や商品を撮影してカード化</Text>
            </>
          )}
        </View>

      </ScrollView>
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

  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  ticketPill: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  premiumPill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  ticketText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  premiumText: { color: '#2563EB' },

  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 12 },
  sectionHeader: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginLeft: 8 },
  
  mapContainer: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 24, backgroundColor: '#FFF' },
  map: { width: '100%', height: 220 },
  mapLoading: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  mapLoadingText: { marginTop: 10, color: '#64748B', fontWeight: '600' },
  
  mapWebFallback: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  mapWebFallbackText: { color: '#475569', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  mapWebFallbackSub: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },

  shopScroll: { paddingHorizontal: 16, paddingBottom: 24 },
  shopItem: { width: 140, backgroundColor: '#FFFFFF', borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  shopImg: { width: '100%', height: 140, backgroundColor: '#F1F5F9' },
  shopInfo: { padding: 12 },
  shopName: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  shopPrice: { fontSize: 14, fontWeight: '900', color: '#2563EB' },
  emptyText: { color: '#94A3B8', paddingHorizontal: 20, fontStyle: 'italic' },

  forgeSection: { paddingHorizontal: 20, alignItems: 'center', marginTop: 10 },
  input: { backgroundColor: '#FFFFFF', width: '100%', padding: 18, borderRadius: 16, fontSize: 16, color: '#0F172A', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '600' },
  
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  loadingText: { color: '#3B82F6', marginTop: 20, fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  flashOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  modalContent: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  
  modalContentDust: { backgroundColor: '#18181B', borderColor: '#3F3F46', borderWidth: 2 },
  
  resultTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 24, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  
  resultCardContainer: { width: 160, height: 220, borderRadius: 12, borderWidth: 3, padding: 6, marginBottom: 20, position: 'relative', backgroundColor: '#F8FAFC', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  resultCardImg: { width: '100%', height: '100%', borderRadius: 6, resizeMode: 'cover', backgroundColor: '#000' },
  resultRarityBadge: { position: 'absolute', top: -10, right: -10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FFF' },
  resultRarityText: { color: '#FFF', fontSize: 11, fontWeight: '900' },

  resultCardName: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
  resultCardSkill: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  resultCardPower: { fontSize: 14, fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },

  closeResultBtn: { backgroundColor: '#0F172A', width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  closeResultBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});