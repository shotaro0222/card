import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, Modal, Animated, Easing, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon } from 'lucide-react-native';

const safeAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
};

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingSubText] = useState('');
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  
  const [forgedCardResult, setForgedCardResult] = useState<any | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
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

  const launchCamera = async () => {
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPerm.granted) {
        safeAlert('権限エラー', 'カメラへのアクセスを許可してください。');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.4, base64: true });
      if (!result.canceled && result.assets && result.assets[0].base64) {
        forgeCard(result.assets[0].base64);
      }
    } catch (error: any) {
      safeAlert('カメラエラー', error.message);
    }
  };

  const launchLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.4, base64: true });
      if (!result.canceled && result.assets && result.assets[0].base64) {
        forgeCard(result.assets[0].base64);
      }
    } catch (error: any) {
      safeAlert('アルバムエラー', error.message);
    }
  };

  const forgeCard = async (base64Img: string) => {
    setLoading(true);
    setLoadingSubText('位置情報を確認中...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      let userLat = null, userLng = null;
      try {
        const locResult: any = await Promise.race([
          Location.requestForegroundPermissionsAsync().then(async (perm) => {
            if (perm.granted) return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            return null;
          }),
          new Promise(resolve => setTimeout(() => resolve(null), 3000))
        ]);
        if (locResult) {
          userLat = locResult.coords.latitude;
          userLng = locResult.coords.longitude;
        }
      } catch (e) {
        console.log("位置情報スキップ");
      }

      setLoadingSubText('画像をサーバーへ転送中...');
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像保存失敗: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      setLoadingSubText('AIが画像を解析中...');
      let aiResultData;
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
          body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: true, customName: customName, activeCampaigns, userLat, userLng }
        });
        if (aiError || !aiData) throw new Error("AI応答なし");
        aiResultData = aiData;
      } catch (e) {
        aiResultData = { card_name: "ERROR_ENTITY", rarity: "DUST", element: "虚無", skill_name: "ノイズ・バースト", feature: "解析不能なノイズデータ。", status_hp: 404, status_atk: 404, status_def: 404, status_spd: 404 };
      }

      setLoadingSubText('データベースに登録中...');
      
      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiResultData.card_name || customName || '名称不明',
        image_url: publicUrl,
        feature: aiResultData.feature || '解析不能な対象物',
        skill_name: aiResultData.skill_name || '通常攻撃',
        status_hp: aiResultData.status_hp || 100,
        status_atk: aiResultData.status_atk || 10,
        status_def: aiResultData.status_def || 10,
        status_spd: aiResultData.status_spd || 10,
        status_total: (aiResultData.status_hp || 100) + (aiResultData.status_atk || 10) + (aiResultData.status_def || 10) + (aiResultData.status_spd || 10),
        rarity: aiResultData.rarity || 'N',
        element: aiResultData.element || '無',
        is_active: false
      }]);

      if (insertError) throw new Error(`DB保存失敗: ${insertError.message}`);

      setForgedCardResult({ ...aiResultData, image_url: publicUrl, status_total: (aiResultData.status_hp || 100) + (aiResultData.status_atk || 10) + (aiResultData.status_def || 10) + (aiResultData.status_spd || 10) });
      setShowResultModal(true);
      setCustomName('');
      
    } catch (error: any) {
      safeAlert('生成エラー', error.message);
    } finally {
      setLoading(false);
      setLoadingSubText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.devBadge}><Text style={styles.devText}>🛠️ 開発モード: 無制限</Text></View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>次元からデータを抽出中...</Text>
            <Text style={styles.loadingSubText}>{loadingStep}</Text>
          </View>
        ) : (
          <View style={styles.mainBox}>
            <Text style={styles.instruction}>好きな名前を指定（任意）</Text>
            <TextInput style={styles.input} placeholder="カードの名称を入力..." value={customName} onChangeText={setCustomName} maxLength={15} />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.actionButtonHalf} onPress={launchCamera} activeOpacity={0.8}>
                <Camera color="#FFFFFF" size={20} />
                <Text style={styles.actionButtonText}>カメラ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionButtonHalf, styles.actionButtonLibrary]} onPress={launchLibrary} activeOpacity={0.8}>
                <ImageIcon color="#FFFFFF" size={20} />
                <Text style={styles.actionButtonText}>アルバム</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.subInfo}>現実の風景や商品を撮影してカード生成</Text>
          </View>
        )}
      </View>

      <Modal visible={showResultModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          {/* 💡 画面からはみ出さないようレスポンシブ対応に修正 */}
          <Animated.View style={[styles.modalContent, forgedCardResult?.rarity === 'DUST' && styles.dustContent, { transform: [{ translateX: shakeX }] }]}>
            
            <Text style={[styles.resultTitle, { color: getRarityConfig(forgedCardResult?.rarity).color }]} adjustsFontSizeToFit numberOfLines={1}>
              {getRarityConfig(forgedCardResult?.rarity).effectTitle}
            </Text>
            
            <Animated.View style={[styles.cardPreview, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
              <Image source={{ uri: forgedCardResult?.image_url }} style={styles.resultImage} resizeMode="cover" />
            </Animated.View>
            
            <Text style={styles.resultName} adjustsFontSizeToFit numberOfLines={1}>
              {forgedCardResult?.card_name}
            </Text>
            
            <View style={styles.resultStatsRow}>
              <Text style={styles.resultPower}>属性: {forgedCardResult?.element}</Text>
              <Text style={styles.resultPower}>合計: {forgedCardResult?.status_total}</Text>
            </View>

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
  loadingText: { marginTop: 20, color: '#3B82F6', fontWeight: '800', fontSize: 16 },
  loadingSubText: { marginTop: 8, color: '#94A3B8', fontWeight: '600', fontSize: 12 },
  devBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 40 },
  devText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  mainBox: { width: '85%', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 30, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  instruction: { fontSize: 14, color: '#64748B', marginBottom: 15, fontWeight: '600' },
  input: { width: '100%', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  actionButtonHalf: { flex: 1, flexDirection: 'row', backgroundColor: '#3B82F6', height: 60, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionButtonLibrary: { backgroundColor: '#0F172A' },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 8 },
  subInfo: { color: '#94A3B8', fontSize: 12, marginTop: 15, fontWeight: '500' },
  
  // 💡 レスポンシブに修正したモーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { 
    width: '85%', 
    maxHeight: '90%', // 画面サイズが小さい場合、画面外への押し出しを防止
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 20, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  dustContent: { backgroundColor: '#18181B' },
  resultTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  cardPreview: { 
    width: '75%', // 固定サイズから可変サイズに変更
    aspectRatio: 3 / 4, // 縦横比を固定
    borderRadius: 15, 
    overflow: 'hidden', 
    marginBottom: 15, 
    borderWidth: 3, 
    borderColor: '#DDD' 
  },
  resultImage: { width: '100%', height: '100%' },
  resultName: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  resultStatsRow: { flexDirection: 'row', gap: 15, marginTop: 8 },
  resultPower: { fontSize: 14, color: '#64748B', fontWeight: '700' },
  closeBtn: { marginTop: 20, backgroundColor: '#0F172A', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 15 },
  closeBtnText: { color: '#FFF', fontWeight: '800' }
});