// app/(tabs)/camera.tsx (カード化・カメラ画面 フルコード)
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

  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const effectFlashOp = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  useEffect(() => {
    if (showResultModal && forgedCardResult) {
      startResultEffect(forgedCardResult.rarity);
    }
  }, [showResultModal, forgedCardResult]);

  const fetchUserDataAndCampaigns = async () => {
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

    let userLat = null, userLng = null;
    const locationPerm = await Location.requestForegroundPermissionsAsync();
    if (locationPerm.granted) {
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        userLat = location.coords.latitude;
        userLng = location.coords.longitude;
      } catch (e) { console.log(e); }
    }

    // 💡【アルバム連携】画像の出所を選択（カメラ or アルバム）
    Alert.alert(
      '素材の抽出',
      'カード化する画像のソースを選択してください',
      [
        {
          text: '📸 カメラで撮影',
          onPress: async () => {
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
          }
        },
        {
          text: '🖼️ アルバムから選択',
          onPress: async () => {
             const result = await ImagePicker.launchImageLibraryAsync({
               mediaTypes: ImagePicker.MediaTypeOptions.Images,
               allowsEditing: true,
               aspect: [1, 1],
               quality: 0.5,
               base64: true,
             });
             if (!result.canceled && result.assets[0].base64) {
               forgeCard(result.assets[0].base64, userLat, userLng);
             }
          }
        },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
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

      let aiResultData;

      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
          body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: true, customName: customName, activeCampaigns, userLat: lat, userLng: lng }
        });
        
        if (aiError || !aiData || aiData.error) {
          throw new Error("AI通信障害");
        }
        aiResultData = aiData;

      } catch (apiError) {
        console.warn("API通信エラー。ダストカードを生成します。");
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
            <Animated.View style={[styles.flashOverlay, { backgroundColor: getRarityConfig(forgedCardResult.rarity).color, opacity: effectFlashOp }]} pointerEvents="none" />
          )}

          <View style={[styles.modalContent, forgedCardResult?.rarity === 'DUST' && styles.modalContentDust]}>
            {forgedCardResult && (
              <>
                <Text style={[styles.resultTitle, { color: getRarityConfig(forgedCardResult.rarity).color }]}>
                  {getRarityConfig(forgedCardResult.rarity).effectTitle}
                </Text>

                <Animated.View style={[styles.resultCardContainer, { transform: [{ scale: cardScale }], opacity: cardOpacity, borderColor: getRarityConfig(forgedCardResult.rarity).color }]}>
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

            <TouchableOpacity style={[styles.closeResultBtn, forgedCardResult?.rarity === 'DUST' && { backgroundColor: '#E11D48' }]} onPress={() => { setShowResultModal(false); router.push('/collection') }}>
              <Text style={styles.closeResultBtnText}>図鑑へ登録</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      <View style={styles.statusRow}>
        <View style={[styles.ticketPill, styles.premiumPill]}>
          <Text style={[styles.ticketText, styles.premiumText]}>
            🛠️ 開発モード: 無制限
          </Text>
        </View>
      </View>

      <View style={styles.centerArea}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>AIがカードを生成中...</Text>
          </View>
        ) : (
          <View style={styles.actionBox}>
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
              <Text style={styles.primaryButtonText}>カメラ / アルバム起動</Text>
            </TouchableOpacity>
            <Text style={styles.subText}>画像からエネルギーを抽出しカード化</Text>
          </View>
        )}
      </View>
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
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '500' },
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#3B82F6', marginTop: 20, fontSize: 16, fontWeight: '700' },
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