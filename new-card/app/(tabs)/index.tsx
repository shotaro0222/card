import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, ScrollView, Modal, Animated, Easing, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const [forgedCardResult, setForgedCardResult] = useState<any | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // 演出用アニメーション
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const effectFlashOp = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchCampaigns();
    }, [])
  );

  useEffect(() => {
    if (showResultModal && forgedCardResult) {
      startResultEffect(forgedCardResult.rarity);
    }
  }, [showResultModal, forgedCardResult]);

  const fetchCampaigns = async () => {
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) setActiveCampaigns(campaigns);
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

    Animated.parallel([
      Animated.timing(cardScale, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start(() => {
      if (config.shakeIntensity > 0) {
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 10 * config.shakeIntensity, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10 * config.shakeIntensity, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true })
        ]).start();
      }
    });
  };

  // 💡 カメラ起動メインロジック
  const takePhoto = async () => {
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
      if (!user) throw new Error('認証エラー');

      const fileName = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      let aiResultData;
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
          body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: true, customName: customName, activeCampaigns, userLat: lat, userLng: lng }
        });
        if (aiError || !aiData) throw new Error("AI通信失敗");
        aiResultData = aiData;
      } catch (e) {
        // 💡 エラー時は「ダストカード」にする
        aiResultData = { card_name: "UNKNOWN_ENTITY", skill_name: "システム・クラッシュ", status_hp: 404, status_atk: 404, status_def: 404, status_spd: 404, rarity: "DUST", feature: "解析不能なノイズデータ。" };
      }

      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiResultData.card_name || customName || '名称不明',
        image_url: publicUrl,
        skill_name: aiResultData.skill_name || '通常攻撃',
        status_hp: aiResultData.status_hp || 100,
        status_atk: aiResultData.status_atk || 10,
        status_def: aiResultData.status_def || 10,
        status_spd: aiResultData.status_spd || 10,
        status_total: (aiResultData.status_hp || 100) + (aiResultData.status_atk || 10) + (aiResultData.status_def || 10) + (aiResultData.status_spd || 10),
        rarity: aiResultData.rarity || 'N',
        element: aiResultData.element || '無',
        is_fixed: aiResultData.is_fixed || false,
        is_active: false
      }]);

      if (insertError) throw insertError;

      setForgedCardResult({ ...aiResultData, image_url: publicUrl, status_total: (aiResultData.status_hp || 100) + (aiResultData.status_atk || 10) + (aiResultData.status_def || 10) + (aiResultData.status_spd || 10) });
      setShowResultModal(true);
      setCustomName('');
    } catch (error: any) {
      setDebugError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.devBadge}>
          <Text style={styles.devText}>🛠️ 開発モード: 無制限</Text>
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>次元からデータを抽出中...</Text>
          </View>
        ) : (
          <View style={styles.mainBox}>
            <Text style={styles.instruction}>好きな名前を指定（任意）</Text>
            <TextInput
              style={styles.input}
              placeholder="カードの名称を入力..."
              value={customName}
              onChangeText={setCustomName}
              maxLength={15}
            />
            
            <TouchableOpacity style={styles.actionButton} onPress={takePhoto} activeOpacity={0.8}>
              <Camera color="#FFFFFF" size={24} style={{ marginRight: 10 }} />
              <Text style={styles.actionButtonText}>カメラを起動</Text>
            </TouchableOpacity>
            
            <Text style={styles.subInfo}>現実の風景や商品を撮影してカード生成</Text>
          </View>
        )}
      </View>

      {/* 生成結果モーダル */}
      <Modal visible={showResultModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, forgedCardResult?.rarity === 'DUST' && styles.dustContent, { transform: [{ translateX: shakeX }] }]}>
            <Text style={[styles.resultTitle, { color: getRarityConfig(forgedCardResult?.rarity).color }]}>
              {getRarityConfig(forgedCardResult?.rarity).effectTitle}
            </Text>
            <Animated.View style={[styles.cardPreview, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
              <Image source={{ uri: forgedCardResult?.image_url }} style={styles.resultImage} />
            </Animated.View>
            <Text style={styles.resultName}>{forgedCardResult?.card_name}</Text>
            <Text style={styles.resultPower}>総合力: {forgedCardResult?.status_total}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowResultModal(false)}>
              <Text style={styles.closeBtnText}>図鑑に格納</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  loadingArea: { alignItems: 'center' },
  loadingText: { marginTop: 20, color: '#3B82F6', fontWeight: '700' },
  devBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 40 },
  devText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  mainBox: { width: '85%', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 30, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  instruction: { fontSize: 14, color: '#64748B', marginBottom: 15, fontWeight: '600' },
  input: { width: '100%', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  actionButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 60, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subInfo: { color: '#94A3B8', fontSize: 12, marginTop: 15, fontWeight: '500' },
  
  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 30, padding: 30, alignItems: 'center' },
  dustContent: { backgroundColor: '#18181B' },
  resultTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20 },
  cardPreview: { width: 200, height: 280, borderRadius: 15, overflow: 'hidden', marginBottom: 20, borderWidth: 3, borderColor: '#DDD' },
  resultImage: { width: '100%', height: '100%' },
  resultName: { fontSize: 22, fontWeight: '900', color: '#333' },
  resultPower: { fontSize: 16, color: '#666', marginTop: 5 },
  closeBtn: { marginTop: 30, backgroundColor: '#000', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 15 },
  closeBtnText: { color: '#FFF', fontWeight: '800' }
});