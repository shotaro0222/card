import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect } from 'expo-router';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

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

  const takePhoto = async () => {
    if (!isPremium && tickets <= 0) {
      Alert.alert('チケットがありません', '本日の無料作成枠を使い切りました。ストアをご確認ください。');
      return;
    }

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証エラー');

      if (!isPremium) {
        const { data: canForge, error: rpcError } = await supabase.rpc('use_forge_ticket', { target_user_id: user.id });
        if (rpcError || !canForge) throw new Error('チケット処理エラー');
        setTickets(prev => prev - 1);
      }

      const fileName = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      const { data: aiData, error: aiError } = await supabase.functions.invoke('forge-card', {
        body: { base64Image: base64Img, mimeType: 'image/jpeg', isPremium, customName: isPremium ? customName : null, activeCampaigns, userLat: lat, userLng: lng }
      });
      if (aiError || !aiData) throw new Error('AI生成失敗');

      await supabase.from('cards').insert([{
        player_id: user.id,
        card_name: aiData.name,
        image_url: publicUrl,
        feature: aiData.feature,
        skill_name: aiData.skill,
        status_hp: aiData.hp,
        status_atk: aiData.atk,
        status_def: aiData.def,
        status_spd: aiData.spd,
        status_total: aiData.hp + aiData.atk + aiData.def + aiData.spd,
        rarity: aiData.rarity,
        card_type: aiData.campaign_id ? 'sponsor' : 'normal',
        sponsor_id: aiData.campaign_id || null,
        location_lat: lat,
        location_lng: lng,
        is_fixed: aiData.is_fixed || false,
        ar_model_url: aiData.ar_model_url || null,
        is_active: true 
      }]);

      Alert.alert('完成！', `新しいカード「${aiData.name}」を図鑑に追加しました。`);
      setCustomName('');
    } catch (error: any) {
      Alert.alert('エラー', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 上部ステータス */}
      <View style={styles.statusRow}>
        <View style={[styles.ticketPill, isPremium && styles.premiumPill]}>
          <Text style={[styles.ticketText, isPremium && styles.premiumText]}>
            {isPremium ? '👑 無制限パス適用中' : `残り ${tickets} 枚`}
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
            {isPremium && (
              <TextInput
                style={styles.input}
                placeholder="好きな名前を指定 (任意)"
                placeholderTextColor="#94A3B8"
                value={customName}
                onChangeText={setCustomName}
                maxLength={15}
              />
            )}
            <TouchableOpacity 
              style={[styles.primaryButton, (!isPremium && tickets <= 0) && styles.disabledButton]} 
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
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
  ticketPill: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  premiumPill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  ticketText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  premiumText: { color: '#2563EB' },
  
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  actionBox: { width: '100%', alignItems: 'center' },
  
  input: { backgroundColor: '#FFFFFF', width: '100%', padding: 18, borderRadius: 16, fontSize: 16, color: '#0F172A', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  primaryButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  disabledButton: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '500' },
  
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#3B82F6', marginTop: 20, fontSize: 16, fontWeight: '700' },
  
  infoArea: { padding: 20, alignItems: 'center', paddingBottom: 30 },
  infoText: { color: '#64748B', fontSize: 13, fontWeight: '600' }
});
