import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView, ScrollView } from 'react-native';
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
  
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  const fetchUserDataAndCampaigns = async () => {
    // キャンペーン情報だけ取得（チケット数は無視）
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) setActiveCampaigns(campaigns);
  };

  const takePhoto = async () => {
    // 💡【変更点】チケットが0枚でも弾かないように制限チェックを完全削除しました

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
      if (!user) throw new Error('認証エラー: ログインし直してください');

      // 💡【変更点】データベースのチケット消費処理（RPC呼び出し）を無力化

      // 画像のアップロード
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`画像アップロードエラー: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      // Edge Function通信
      const { data: aiData, error: aiError } = await supabase.functions.invoke('super-task', {
        // isPremium を常に true として送り、自由な名前設定を許可
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium: true, customName: customName, activeCampaigns, userLat: lat, userLng: lng }
      });
      
      if (aiError) throw new Error(`AI通信エラー: ${aiError.message || JSON.stringify(aiError)}`);
      if (!aiData) throw new Error('AIからデータが返ってきませんでした');
      if (aiData.error) throw new Error(`AI内部エラー: ${aiData.error}`);

      // データ整理
      const finalName = aiData.card_name || aiData.name || '名称不明';
      const finalSkill = aiData.skill_name || aiData.skill || '通常攻撃';
      const finalHp = aiData.status_hp || aiData.hp || 100;
      const finalAtk = aiData.status_atk || aiData.atk || 10;
      const finalDef = aiData.status_def || aiData.def || 10;
      const finalSpd = aiData.status_spd || aiData.spd || 10;

      // データベースに保存
      const { error: insertError } = await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: finalName,
        image_url: publicUrl,
        feature: aiData.feature || '',
        skill_name: finalSkill,
        status_hp: finalHp,
        status_atk: finalAtk,
        status_def: finalDef,
        status_spd: finalSpd,
        status_total: finalHp + finalAtk + finalDef + finalSpd,
        rarity: aiData.rarity || 'N',
        card_type: aiData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiData.campaign_id || null,
        location_lat: lat,
        location_lng: lng,
        is_fixed: aiData.is_fixed || false,
        ar_model_url: aiData.ar_model_url || null,
        card_role: Math.random() > 0.7 ? 'support' : 'attacker',
        is_active: false
      }]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      Alert.alert('完成！', `新しいカード「${finalName}」を図鑑に追加しました。`, [
        { text: '図鑑を確認', onPress: () => router.push('/(tabs)') }
      ]);
      setCustomName('');
      
    } catch (error: any) {
      console.error("🚨 エラー発生:", error);
      setDebugError(error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {debugError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>🚨 エラーが発生しました</Text>
          <ScrollView style={{ maxHeight: 150 }}>
            <Text style={styles.errorText}>{debugError}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.errorCloseBtn} onPress={() => setDebugError(null)}>
            <Text style={styles.errorCloseText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 上部ステータス */}
      <View style={styles.statusRow}>
        <View style={[styles.ticketPill, styles.premiumPill]}>
          <Text style={[styles.ticketText, styles.premiumText]}>
            🛠️ 開発モード: 無制限
          </Text>
        </View>
      </View>

      {/* メインのアクションエリア */}
      <View style={styles.centerArea}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>AIがカードを生成中...</Text>
          </View>
        ) : (
          <View style={styles.actionBox}>
            {/* 無限モードなので常に名前指定を表示 */}
            <TextInput
              style={styles.input}
              placeholder="好きな名前を指定 (任意)"
              placeholderTextColor="#94A3B8"
              value={customName}
              onChangeText={setCustomName}
              maxLength={15}
            />
            
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Camera color="#FFFFFF" size={28} style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>カメラを起動</Text>
            </TouchableOpacity>
            <Text style={styles.subText}>現実の風景や商品を撮影してカード化</Text>
          </View>
        )}
      </View>

      {/* 下部のインフォメーション */}
      {activeCampaigns.length > 0 && (
        <View style={styles.infoArea}>
          <Text style={styles.infoText}>📍 開催中のご当地・企業コラボ: {activeCampaigns.length} 件</Text>
        </View>
      )}
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
  
  infoArea: { padding: 20, alignItems: 'center', paddingBottom: 30 },
  infoText: { color: '#64748B', fontSize: 13, fontWeight: '600' }
});