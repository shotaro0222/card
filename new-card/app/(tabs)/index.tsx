import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, Animated, Easing, Image, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ForgeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  // ユーザーデータ状態
  const [tickets, setTickets] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // スキャンラインアニメーション
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();
  }, [scanLineAnim]);

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  const fetchUserDataAndCampaigns = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('forge_tickets, last_ticket_reset, is_premium').eq('id', user.id).single();
    if (profile) {
      setIsPremium(profile.is_premium);
      const lastReset = new Date(profile.last_ticket_reset).toDateString();
      const today = new Date().toDateString();
      setTickets(lastReset !== today ? 3 : profile.forge_tickets);
    }
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) setActiveCampaigns(campaigns);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>カメラのアクセス許可が必要です</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>システムへのアクセスを許可</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!isPremium && tickets <= 0) {
      Alert.alert('チケット不足', '本日の無料作成枠を使い切りました。ストアをご確認ください。');
      return;
    }

    if (cameraRef.current) {
      setLoading(true);
      setDebugError(null);
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (!photo || !photo.base64) throw new Error("画像のエンコードに失敗しました");
        
        setCapturedImage(photo.uri);
        await forgeCard(photo.base64);

      } catch (error: any) {
        setDebugError(`撮影エラー: ${error.message}`);
        setLoading(false);
      }
    }
  };

  const forgeCard = async (base64Img: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証エラー');

      // 1. 位置情報の取得
      let userLat = null, userLng = null;
      const locationPerm = await Location.requestForegroundPermissionsAsync();
      if (locationPerm.granted) {
        try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userLat = location.coords.latitude;
          userLng = location.coords.longitude;
        } catch (e) { console.log("GPS取得スキップ"); }
      }

      // 2. チケット消費処理
      if (!isPremium) {
        const { data: canForge, error: rpcError } = await supabase.rpc('use_forge_ticket', { target_user_id: user.id });
        if (rpcError || !canForge) throw new Error(`チケット処理エラー: ${rpcError?.message}`);
        setTickets(prev => prev - 1);
      }

      // 3. Storageへの画像アップロード
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像アップロードエラー: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      // 4. Edge Function呼び出し（URL末尾に合わせて super-task にしています）
      const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium, customName: isPremium ? customName : null, activeCampaigns, userLat, userLng }
      });
      
      if (aiError) throw new Error(`AI通信エラー: ${aiError.message || JSON.stringify(aiError)}`);
      if (!aiData) throw new Error('AIからの応答データが空です');
      if (aiData.error) throw new Error(`AI内部エラー: ${aiData.error}`);

      // 5. データベースへ保存（新旧どちらのプロンプトキーにも対応）
      const finalName = aiData.name || aiData.card_name || '名称不明';
      const finalHp = aiData.hp || aiData.status_hp || 100;
      const finalAtk = aiData.atk || aiData.status_atk || 10;
      const finalDef = aiData.def || aiData.status_def || 10;
      const finalSpd = aiData.spd || aiData.status_spd || 10;

      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: finalName,
        image_url: publicUrl,
        feature: aiData.feature || '',
        skill_name: aiData.skill || aiData.skill_name || '通常攻撃',
        status_hp: finalHp,
        status_atk: finalAtk,
        status_def: finalDef,
        status_spd: finalSpd,
        status_total: finalHp + finalAtk + finalDef + finalSpd,
        rarity: aiData.rarity || 'N',
        card_type: aiData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiData.campaign_id || null,
        location_lat: userLat,
        location_lng: userLng,
        card_role: Math.random() > 0.7 ? 'support' : 'attacker',
        is_fixed: aiData.is_fixed || false,
        ar_model_url: aiData.ar_model_url || null,
        is_active: false 
      }]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      Alert.alert('実体化成功', `「${finalName}」を生成しました！`, [
        { text: '図鑑へ', onPress: () => router.push('/(tabs)') }
      ]);
      setCustomName('');

    } catch (error: any) {
      console.error("🚨 致命的エラー:", error);
      setDebugError(error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  const translateY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 250] });

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🚨 デバッグ用エラー表示領域 */}
      {debugError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>🚨 エラーが発生しました</Text>
          <ScrollView style={{ maxHeight: 150 }}>
            <Text style={styles.errorText}>{debugError}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.errorCloseBtn} onPress={() => { setDebugError(null); setCapturedImage(null); }}>
            <Text style={styles.errorCloseText}>リセットして戻る</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ステータスバー（チケット等） */}
      <View style={styles.statusRow}>
        {isPremium && !capturedImage && !loading && (
          <TextInput
            style={styles.input}
            placeholder="強制オーバーライド名 (任意)"
            placeholderTextColor="#64748B"
            value={customName}
            onChangeText={setCustomName}
            maxLength={15}
          />
        )}
        <View style={[styles.ticketPill, isPremium && styles.premiumPill]}>
          <Text style={[styles.ticketText, isPremium && styles.premiumText]}>
            {isPremium ? '👑 無制限パス適用中' : `残り ${tickets} 枚`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" style={{ transform: [{ scale: 1.5 }] }} />
          <Text style={styles.loadingText}>SYSTEM: TARGET ANALYZING...</Text>
          <Text style={styles.loadingSub}>企業ロゴ・ブランド・量子エネルギーを抽出中</Text>
        </View>
      ) : capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        </View>
      ) : (
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.overlay}>
            
            <View style={styles.targetBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
            </View>

            <View style={styles.uiFooter}>
              {activeCampaigns.length > 0 && (
                <Text style={styles.campaignText}>📍 協賛エリア検知: {activeCampaigns.length}件</Text>
              )}
              <Text style={styles.guideText}>対象をフレームに収め、抽出を開始してください</Text>
              
              <TouchableOpacity 
                style={[styles.captureBtn, (!isPremium && tickets <= 0) && styles.disabledBtn]} 
                onPress={takePhoto}
              >
                <View style={[styles.captureInner, (!isPremium && tickets <= 0) && styles.disabledInner]}>
                  <Text style={styles.btnIcon}>SCAN</Text>
                </View>
              </TouchableOpacity>
            </View>

          </View>
        </CameraView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  text: { color: '#94A3B8', marginBottom: 20, fontWeight: '700' },
  btn: { backgroundColor: '#0EA5E9', padding: 16, borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
  
  errorBox: { position: 'absolute', top: 100, left: 20, right: 20, backgroundColor: 'rgba(225, 29, 72, 0.95)', padding: 16, borderRadius: 12, zIndex: 9999, borderWidth: 2, borderColor: '#FFF' },
  errorTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  errorText: { color: '#FFF', fontSize: 12, fontFamily: 'monospace' },
  errorCloseBtn: { backgroundColor: '#FFF', padding: 10, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  errorCloseText: { color: '#E11D48', fontWeight: '900' },

  statusRow: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', borderWidth: 1, borderColor: '#334155', padding: 10, borderRadius: 8, color: '#FFF', marginRight: 10 },
  ticketPill: { backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginLeft: 'auto' },
  premiumPill: { borderColor: '#38BDF8', backgroundColor: 'rgba(14, 165, 233, 0.2)' },
  ticketText: { color: '#F8FAFC', fontSize: 12, fontWeight: '900' },
  premiumText: { color: '#38BDF8' },

  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.2)', justifyContent: 'center', alignItems: 'center' },
  targetBox: { width: 250, height: 250, position: 'relative', marginBottom: 60 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#0EA5E9', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { width: '100%', height: 2, backgroundColor: '#38BDF8', opacity: 0.8, shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 },
  
  uiFooter: { position: 'absolute', bottom: 40, alignItems: 'center', width: '100%' },
  campaignText: { color: '#FCD34D', fontWeight: '900', fontSize: 12, marginBottom: 8, textShadowColor: '#000', textShadowRadius: 4 },
  guideText: { color: '#E0F2FE', fontWeight: '800', fontSize: 13, marginBottom: 20, letterSpacing: 1 },
  
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(14, 165, 233, 0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0EA5E9' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { borderColor: '#475569', backgroundColor: 'rgba(71, 85, 105, 0.3)' },
  disabledInner: { backgroundColor: '#475569' },
  btnIcon: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 20 },
  loadingText: { color: '#38BDF8', fontSize: 18, fontWeight: '900', marginTop: 30, letterSpacing: 2, textAlign: 'center' },
  loadingSub: { color: '#94A3B8', fontSize: 12, marginTop: 12, fontWeight: '700', letterSpacing: 1 }
});