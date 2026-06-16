import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, Modal, Animated, Easing, Image, Platform, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Zap } from 'lucide-react-native';

// 💡 修正箇所1: 画像をファイルの先頭で確実にインポートする（require()を使用してExpoのバンドラーで正しく認識させます）
const logoImg = require('../assets/images/logo.png');

const { width, height } = Dimensions.get('window');

const safeAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
};

const MAX_FORGE_LIMIT = 3;

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingSubText] = useState('');
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  
  const [forgeCount, setForgeCount] = useState<number>(0);
  const [isInfinite, setIsInfinite] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  const [forgedCardResult, setForgedCardResult] = useState<any | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // === ド派手演出用のアニメーション値 ===
  const cardScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(3)).current; 
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchCampaigns();
      fetchUserProfile();
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

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('forge_count, is_infinite_forge, is_admin').eq('id', user.id).single();
        if (profile) {
          setForgeCount(profile.forge_count || 0);
          setIsInfinite(profile.is_infinite_forge || false);
          setIsAdmin(profile.is_admin || false);
        }
      }
    } catch (e) {
      console.log("プロフィール取得エラー", e);
    }
  };

  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'UR': return { color: '#FBBF24', glow: '#FEF08A', effectTitle: '🌟 UR 神格化完了 🌟', hasShake: true };
      case 'SSR': return { color: '#EF4444', glow: '#FECACA', effectTitle: '🔥 SSR 超絶実体化 🔥', hasShake: true };
      case 'SR': return { color: '#A855F7', glow: '#E9D5FF', effectTitle: '⚡ SR 物質化成功 ⚡', hasShake: false };
      case 'R': return { color: '#3B82F6', glow: '#BFDBFE', effectTitle: '✨ R レア抽出 ✨', hasShake: false };
      case 'DUST': return { color: '#64748B', glow: '#1E293B', effectTitle: '⚠️ ERROR 汚染データ', hasShake: true };
      case 'N': default: return { color: '#FFFFFF', glow: '#E2E8F0', effectTitle: '⚙️ N 通常構築', hasShake: false };
    }
  };

  const startResultEffect = (rarity: string) => {
    cardScale.setValue(0);
    cardOpacity.setValue(0);
    glowOpacity.setValue(0);
    nameScale.setValue(4);
    nameOpacity.setValue(0);
    spinAnim.setValue(0);
    shakeX.setValue(0);

    const config = getRarityConfig(rarity);

    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
      ]),
      ...(config.hasShake ? [
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 15, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -15, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true })
        ])
      ] : []),
      Animated.parallel([
        Animated.spring(nameScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
        Animated.timing(nameOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
      ])
    ]).start();
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const checkLimit = () => {
    if (!isAdmin && !isInfinite && forgeCount >= MAX_FORGE_LIMIT) {
      safeAlert('限界到達', `本日の抽出上限（${MAX_FORGE_LIMIT}回）に達しています。`);
      return false;
    }
    return true;
  };

  const launchCamera = async () => {
    if (!checkLimit()) return;
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPerm.granted) {
        safeAlert('権限エラー', '次元カメラへのアクセスを許可してください。');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.4, base64: true });
      if (!result.canceled && result.assets && result.assets[0].base64) {
        forgeCard(result.assets[0].base64);
      }
    } catch (error: any) { safeAlert('エラー', error.message); }
  };

  const launchLibrary = async () => {
    if (!checkLimit()) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.4, base64: true });
      if (!result.canceled && result.assets && result.assets[0].base64) {
        forgeCard(result.assets[0].base64);
      }
    } catch (error: any) { safeAlert('エラー', error.message); }
  };

  const forgeCard = async (base64Img: string) => {
    if (!isAdmin && !isInfinite && forgeCount >= MAX_FORGE_LIMIT) {
      safeAlert('生成上限', '生成回数の上限に達しています。');
      return;
    }

    setLoading(true);
    setLoadingSubText('空間座標を走査中...');
    
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
      } catch (e) { console.log("位置情報スキップ"); }

      setLoadingSubText('物質データを転送中...');
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像保存失敗: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      setLoadingSubText('AIが事象を解析・再構築中...');
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

      setLoadingSubText('カードとして実体化中...');
      
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

      if (!isAdmin && !isInfinite) {
        const newCount = forgeCount + 1;
        await supabase.from('profiles').update({ forge_count: newCount }).eq('id', user.id);
        setForgeCount(newCount);
      }

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

  const renderBadgeText = () => {
    if (isAdmin) return '👑 MASTER: 無制限抽出';
    if (isInfinite) return '🛠️ DEV: 制限解除';
    const remaining = Math.max(0, MAX_FORGE_LIMIT - forgeCount);
    return `⚡ 本日の抽出可能回数: ${remaining} / ${MAX_FORGE_LIMIT}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 背景の装飾 */}
      <View style={styles.bgDecorCircle1} />
      <View style={styles.bgDecorCircle2} />

      <View style={styles.content}>
        <View style={[styles.baseBadge, isAdmin ? styles.adminBadge : isInfinite ? styles.devBadge : styles.limitBadge]}>
          <Text style={[styles.baseBadgeText, isAdmin ? styles.adminText : isInfinite ? styles.devText : styles.limitText]} numberOfLines={1}>
            {renderBadgeText()}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
            <Text style={styles.loadingText}>事象を抽出中...</Text>
            <Text style={styles.loadingSubText}>{loadingStep}</Text>
          </View>
        ) : (
          <View style={styles.mainBox}>
            
            {/* 💡 修正箇所2: importした画像変数を使用する */}
            <Image 
              source={logoImg} 
              style={styles.mainLogo}
              resizeMode="contain"
            />
            
            <Text style={styles.instruction}>現実の風景やオブジェクトをカード化</Text>
            
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input} 
                placeholder="真名（カード名）を指定... [任意]" 
                placeholderTextColor="#94A3B8"
                value={customName} 
                onChangeText={setCustomName} 
                maxLength={15} 
              />
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cameraButton, (!isAdmin && !isInfinite && forgeCount >= MAX_FORGE_LIMIT) && styles.actionButtonDisabled]} 
                onPress={launchCamera} activeOpacity={0.8}
              >
                <Camera color="#FFFFFF" size={22} style={styles.btnIcon} />
                <Text style={styles.actionButtonText}>次元カメラ起動</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.libraryButton, (!isAdmin && !isInfinite && forgeCount >= MAX_FORGE_LIMIT) && styles.actionButtonDisabled]} 
                onPress={launchLibrary} activeOpacity={0.8}
              >
                <ImageIcon color="#FFFFFF" size={22} style={styles.btnIcon} />
                <Text style={styles.actionButtonText}>ライブラリ抽出</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ド派手リザルトモーダル */}
      <Modal visible={showResultModal} animationType="none" transparent={true}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.glowBackground, { 
            backgroundColor: forgedCardResult ? getRarityConfig(forgedCardResult.rarity).glow : 'transparent',
            opacity: glowOpacity,
            transform: [{ rotate: spin }] 
          }]} />

          <Animated.View style={[styles.modalContent, { transform: [{ translateX: shakeX }] }]}>
            
            <Animated.Text style={[styles.resultTitle, { color: getRarityConfig(forgedCardResult?.rarity || 'N').color, opacity: glowOpacity }]}>
              {getRarityConfig(forgedCardResult?.rarity || 'N').effectTitle}
            </Animated.Text>
            
            <Animated.View style={[styles.cardPreviewWrapper, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
              <Image source={{ uri: forgedCardResult?.image_url }} style={styles.resultImage} resizeMode="cover" />
              <View style={styles.cardOverlay}>
                <Text style={styles.cardOverlayStats} numberOfLines={1}>
                  属性: {forgedCardResult?.element} | 戦闘力: {forgedCardResult?.status_total}
                </Text>
              </View>
            </Animated.View>
            
            <Animated.Text style={[
              styles.hugeResultName, 
              { color: getRarityConfig(forgedCardResult?.rarity || 'N').color },
              { transform: [{ scale: nameScale }], opacity: nameOpacity }
            ]} adjustsFontSizeToFit numberOfLines={1}>
              {forgedCardResult?.card_name}
            </Animated.Text>

            <Animated.View style={{ opacity: nameOpacity, width: '100%', alignItems: 'center' }}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowResultModal(false)} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>図鑑に格納する</Text>
              </TouchableOpacity>
            </Animated.View>

          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', position: 'relative' }, 
  bgDecorCircle1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: '#1E293B', opacity: 0.5 },
  bgDecorCircle2: { position: 'absolute', bottom: -50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1E293B', opacity: 0.5 },
  
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, zIndex: 10 },
  
  loadingArea: { alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.8)', padding: 40, borderRadius: 30, borderWidth: 1, borderColor: '#334155' },
  loadingCircle: { backgroundColor: '#3B82F6', padding: 20, borderRadius: 50, marginBottom: 20, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15 },
  loadingText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, textAlign: 'center', letterSpacing: 2 },
  loadingSubText: { marginTop: 12, color: '#94A3B8', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  
  baseBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, marginBottom: 40, borderWidth: 1 },
  baseBadgeText: { fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  adminBadge: { backgroundColor: 'rgba(254, 240, 138, 0.1)', borderColor: '#FEF08A' },
  adminText: { color: '#FEF08A' },
  devBadge: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: '#3B82F6' },
  devText: { color: '#60A5FA' },
  limitBadge: { backgroundColor: 'rgba(236, 72, 153, 0.1)', borderColor: '#EC4899' },
  limitText: { color: '#F472B6' },

  mainBox: { width: '85%', maxWidth: 400, alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.85)', padding: 30, borderRadius: 32, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  
  mainLogo: {
    width: '85%',
    height: 55,
    alignSelf: 'center',
    marginBottom: 15
  },

  instruction: { fontSize: 13, color: '#94A3B8', marginBottom: 30, fontWeight: '600', textAlign: 'center' },
  
  inputContainer: { width: '100%', marginBottom: 25 },
  input: { width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', paddingHorizontal: 20, paddingVertical: 18, borderRadius: 16, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#475569', fontWeight: '700', textAlign: 'center' },
  
  buttonRow: { flexDirection: 'column', width: '100%', gap: 15 },
  actionButton: { flexDirection: 'row', height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cameraButton: { backgroundColor: '#3B82F6' },
  libraryButton: { backgroundColor: '#475569' },
  actionButtonDisabled: { opacity: 0.3 },
  btnIcon: { marginRight: 10 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  glowBackground: { position: 'absolute', width: height * 1.5, height: height * 1.5, borderRadius: height }, 
  modalContent: { width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  
  resultTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, letterSpacing: 2 },
  
  cardPreviewWrapper: { width: '70%', aspectRatio: 3 / 4, borderRadius: 20, overflow: 'hidden', borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20 },
  resultImage: { width: '100%', height: '100%' },
  
  cardOverlay: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  cardOverlayStats: { color: '#94A3B8', fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  
  hugeResultName: { fontSize: 42, fontWeight: '900', textAlign: 'center', marginVertical: 30, textShadowColor: '#000', textShadowOffset: { width: 2, height: 4 }, textShadowRadius: 10, paddingHorizontal: 10, width: '100%' },
  
  closeBtn: { backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 },
  closeBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});
