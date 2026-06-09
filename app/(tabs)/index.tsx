import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';

export default function ForgeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // カメラを起動して画像を撮影
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('エラー', 'カメラへのアクセス許可が必要です');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true, // Edge Functionに送るためにBase64を取得
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      forgeCard(result.assets[0].base64, result.assets[0].uri);
    }
  };

  // 錬成プロセス (Storage保存 -> AIステータス生成 -> DB保存)
  const forgeCard = async (base64Img: string, uri: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ユーザーが認証されていません');

      // 1. Storageに画像をアップロード
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('card_images')
        .upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      
      if (uploadError) throw uploadError;

      // 画像の公開URLを取得
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      // 2. Edge Function (Gemini) を呼び出してステータス生成
      const { data: aiData, error: aiError } = await supabase.functions.invoke('forge-card', {
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: false }
      });

      if (aiError || !aiData) throw new Error('AIの召喚に失敗しました');

      // 3. データベース(cardsテーブル)に保存
      const totalStats = aiData.hp + aiData.atk + aiData.def + aiData.spd;
      const { error: dbError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiData.name,
        image_url: publicUrl,
        feature: aiData.feature,
        skill_name: aiData.skill,
        status_hp: aiData.hp,
        status_atk: aiData.atk,
        status_def: aiData.def,
        status_spd: aiData.spd,
        status_total: totalStats,
        rarity: aiData.rarity,
        is_active: true // 新規作成カードを自動で出撃状態に
      }]);

      if (dbError) throw dbError;
      Alert.alert('錬成成功！', `「${aiData.name}」が誕生しました！`);

    } catch (error: any) {
      Alert.alert('錬成エラー', error.message);
    } finally {
      setLoading(false);
      setImageUri(null); // 画面リセット
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>THE FORGE</Text>
      
      <View style={styles.forgeBox}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>異界より錬成中...</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
            <Text style={styles.cameraButtonText}>📸 カメラを起動して錬成</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  header: { fontSize: 24, fontWeight: '900', color: '#cbd5e1', marginBottom: 20, marginTop: 40, letterSpacing: 2 },
  forgeBox: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: '#334155', borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  cameraButton: { backgroundColor: '#10b981', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, shadowColor: '#10b981', shadowOpacity: 0.5, shadowRadius: 10 },
  cameraButtonText: { color: 'white', fontWeight: '900', fontSize: 16 },
  loadingContainer: { alignItems: 'center' },
  loadingText: { color: '#10b981', marginTop: 15, fontWeight: 'bold' }
});
