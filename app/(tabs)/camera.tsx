import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, SafeAreaView, Animated, Easing, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null); // 🚨 エラー表示用の状態を追加
  
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();
  }, [scanLineAnim]);

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

  const takePicture = async () => {
    if (cameraRef.current) {
      setLoading(true);
      setDebugError(null); // エラー表示をリセット
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (!photo || !photo.base64) throw new Error("画像のBase64エンコードに失敗しました");
        
        setCapturedImage(photo.uri);
        await generateCardFromAI(photo.base64);

      } catch (error: any) {
        setDebugError(`撮影・準備エラー: ${error.message}`);
        setLoading(false);
        // ⚠️ ここで setCapturedImage(null) をしないことで証拠を残す！
      }
    }
  };

  const generateCardFromAI = async (base64Image: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('ユーザー認証エラー: ログインし直してください');

      // 1. Edge Function (super-task) を呼び出す
      const { data: aiResult, error: invokeError } = await supabase.functions.invoke('super-task', {
        body: { base64Image: base64Image, mimeType: 'image/jpeg' },
      });

      if (invokeError) {
        throw new Error(`通信エラー (InvokeError): ${invokeError.message || JSON.stringify(invokeError)}`);
      }
      if (!aiResult) {
        throw new Error('AIからの応答データが空です (aiResult is null)');
      }
      if (aiResult.error) {
        throw new Error(`Edge Function内エラー: ${aiResult.error}`);
      }

      // 2. データベースへ保存
      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiResult.card_name || '名称不明',
        rarity: aiResult.rarity || 'N',
        skill_name: aiResult.skill_name || '通常攻撃',
        status_hp: aiResult.status_hp || 100,
        status_atk: aiResult.status_atk || 10,
        status_def: aiResult.status_def || 10,
        status_spd: aiResult.status_spd || 10,
        status_total: (aiResult.status_hp || 100) + (aiResult.status_atk || 10) + (aiResult.status_def || 10) + (aiResult.status_spd || 10),
        image_url: capturedImage, 
        card_role: Math.random() > 0.7 ? 'support' : 'attacker',
        is_fixed: aiResult.is_fixed || false,
        ar_model_url: aiResult.ar_model_url || null,
        level: 1,
        exp: 0,
        is_active: false
      }]);

      if (insertError) {
        throw new Error(`DB保存エラー: ${insertError.message} / ${insertError.details || ''}`);
      }

      // 成功したら図鑑へ
      router.push('/(tabs)');

    } catch (error: any) {
      console.error("🚨 致命的エラー:", error);
      // ⚠️ 画面の目立つところにエラー内容を強制出力！
      setDebugError(error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
      // ⚠️ エラー確認のため、画像を自動で消さない
    }
  };

  const translateY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 250] });

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🚨 デバッグ用エラー表示領域（エラー時のみ出現） */}
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" style={{ transform: [{ scale: 1.5 }] }} />
          <Text style={styles.loadingText}>SYSTEM: TARGET ANALYZING...</Text>
          <Text style={styles.loadingSub}>企業ロゴ・ブランド・量子エネルギーを抽出中</Text>
        </View>
      ) : capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          {/* ローディングが終わってもここに留まっている場合は、エラーが起きています */}
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
              <Text style={styles.guideText}>対象をフレームに収め、抽出を開始してください</Text>
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureInner}><Text style={styles.btnIcon}>SCAN</Text></View>
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
  
  errorBox: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(225, 29, 72, 0.95)', padding: 16, borderRadius: 12, zIndex: 9999, borderWidth: 2, borderColor: '#FFF' },
  errorTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  errorText: { color: '#FFF', fontSize: 12, fontFamily: 'monospace' },
  errorCloseBtn: { backgroundColor: '#FFF', padding: 10, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  errorCloseText: { color: '#E11D48', fontWeight: '900' },

  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
  targetBox: { width: 250, height: 250, position: 'relative', marginBottom: 60 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#0EA5E9', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { width: '100%', height: 2, backgroundColor: '#38BDF8', opacity: 0.8, shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 },
  uiFooter: { position: 'absolute', bottom: 40, alignItems: 'center', width: '100%' },
  guideText: { color: '#E0F2FE', fontWeight: '800', fontSize: 13, marginBottom: 20, letterSpacing: 1 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(14, 165, 233, 0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0EA5E9' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center' },
  btnIcon: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  
  previewContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 20 },
  loadingText: { color: '#38BDF8', fontSize: 18, fontWeight: '900', marginTop: 30, letterSpacing: 2, textAlign: 'center' },
  loadingSub: { color: '#94A3B8', fontSize: 12, marginTop: 12, fontWeight: '700', letterSpacing: 1 }
});