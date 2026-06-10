import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, SafeAreaView, Animated, Easing } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // スキャン演出用のアニメーション値
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // スキャンラインを上下に動かすアニメーションループ
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
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        setCapturedImage(photo.uri);
        
        // Edge Functionを呼び出してAIに画像を解析させる
        await generateCardFromAI(photo.base64);

      } catch (error) {
        Alert.alert('スキャンエラー', '対象の解析に失敗しました。');
        setLoading(false);
      }
    }
  };

  const generateCardFromAI = async (base64Image: string | undefined) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証情報がありません');

      // 1. 先ほどデプロイしたEdge Functionを呼び出す
      const { data: aiResult, error: invokeError } = await supabase.functions.invoke('generate-card', {
        body: { base64Image: base64Image, mimeType: 'image/jpeg' },
      });

      if (invokeError) throw new Error(`AI解析エラー: ${invokeError.message}`);
      if (aiResult.error) throw new Error(aiResult.error);

      // 2. 解析結果をデータベースに保存
      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiResult.card_name,
        rarity: aiResult.rarity,
        skill_name: aiResult.skill_name,
        status_hp: aiResult.status_hp,
        status_atk: aiResult.status_atk,
        status_def: aiResult.status_def,
        status_spd: aiResult.status_spd,
        status_total: aiResult.status_hp + aiResult.status_atk + aiResult.status_def + aiResult.status_spd,
        image_url: capturedImage, // 本番環境ではStorageのURLに差し替えます
        card_role: Math.random() > 0.7 ? 'support' : 'attacker',
        is_fixed: aiResult.is_fixed || false,
        ar_model_url: aiResult.ar_model_url || null,
        level: 1,
        exp: 0,
        is_active: false
      }]);

      if (insertError) throw insertError;

      Alert.alert('実体化成功', `解析完了！「${aiResult.card_name}」を生成しました。\n図鑑へ転送します。`, [
        { text: '確認する', onPress: () => router.push('/(tabs)') }
      ]);

    } catch (error: any) {
      Alert.alert('生成エラー', error.message);
    } finally {
      setLoading(false);
      setCapturedImage(null);
    }
  };

  } catch (error: any) {
      console.error("🚨カード生成の致命的エラー:", error); // 👈 この1行を追加！
      Alert.alert('生成エラー', error.message);
    } finally {

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250] // 枠の高さに合わせて移動
  });

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" style={{ transform: [{ scale: 1.5 }] }} />
          <Text style={styles.loadingText}>SYSTEM: TARGET ANALYZING...</Text>
          <Text style={styles.loadingSub}>企業ロゴ・ブランド・量子エネルギーを抽出中</Text>
        </View>
      ) : capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          <View style={styles.overlayUI}>
            <Text style={styles.overlayText}>DATA EXTRACTED</Text>
          </View>
        </View>
      ) : (
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.overlay}>
            
            {/* サイバーパンク風のスキャンUI */}
            <View style={styles.targetBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {/* 動くスキャンライン */}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
            </View>

            <View style={styles.uiFooter}>
              <Text style={styles.guideText}>対象をフレームに収め、抽出を開始してください</Text>
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureInner}>
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
  guideText: { color: '#E0F2FE', fontWeight: '800', fontSize: 13, marginBottom: 20, letterSpacing: 1, textShadowColor: '#0284C7', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(14, 165, 233, 0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0EA5E9' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center' },
  btnIcon: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  
  previewContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6 },
  overlayUI: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  overlayText: { color: '#38BDF8', fontSize: 24, fontWeight: '900', letterSpacing: 4, textShadowColor: '#0284C7', textShadowRadius: 20 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 20 },
  loadingText: { color: '#38BDF8', fontSize: 18, fontWeight: '900', marginTop: 30, letterSpacing: 2, textAlign: 'center' },
  loadingSub: { color: '#94A3B8', fontSize: 12, marginTop: 12, fontWeight: '700', letterSpacing: 1 }
});