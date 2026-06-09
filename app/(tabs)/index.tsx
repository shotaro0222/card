import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect } from 'expo-router';

export default function ForgeScreen() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]); // 開催中キャンペーン保持

  useFocusEffect(
    useCallback(() => {
      fetchUserDataAndCampaigns();
    }, [])
  );

  const fetchUserDataAndCampaigns = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. ユーザー情報の取得
    const { data: profile } = await supabase.from('profiles').select('forge_tickets, last_ticket_reset, is_premium').eq('id', user.id).single();
    if (profile) {
      setIsPremium(profile.is_premium);
      const lastReset = new Date(profile.last_ticket_reset).toDateString();
      const today = new Date().toDateString();
      setTickets(lastReset !== today ? 3 : profile.forge_tickets);
    }

    // 2. 現在アクティブな企業・自治体キャンペーンの取得
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('is_active', true);
    if (campaigns) {
      setActiveCampaigns(campaigns);
    }
  };

  const takePhoto = async () => {
    if (!isPremium && tickets <= 0) {
      Alert.alert('チケット不足', '今日の無料分を使い切りました。SHOPで追加購入するか、プレミアムパスをご検討ください。');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('エラー', 'カメラへのアクセス許可が必要です');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      forgeCard(result.assets[0].base64);
    }
  };

  const forgeCard = async (base64Img: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ユーザーエラー');

      if (!isPremium) {
        const { data: canForge, error: rpcError } = await supabase.rpc('use_forge_ticket', { target_user_id: user.id });
        if (rpcError || !canForge) throw new Error('チケット消費失敗');
        setTickets(prev => prev - 1);
      }

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('card_images').upload(fileName, decode(base64Img), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('card_images').getPublicUrl(fileName);

      // ★ Edge Functionに「開催中のキャンペーン」を一緒に叩き込む
      const { data: aiData, error: aiError } = await supabase.functions.invoke('forge-card', {
        body: { 
          base64Image: base64Img, 
          mimeType: 'image/jpeg', 
          isPremium: isPremium, 
          customName: isPremium ? customName : null,
          activeCampaigns: activeCampaigns // キャンペーン情報をパス
        }
      });
      if (aiError || !aiData) throw new Error('AI生成失敗');

      const totalStats = aiData.hp + aiData.atk + aiData.def + aiData.spd;
      
      // DBへINSERT（Sponsor IDやタイプを振り分けるための布石も回収）
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
        card_type: aiData.campaign_id ? 'sponsor' : 'normal', // キャンペーン合致ならタイプを変更
        sponsor_id: aiData.campaign_id || null,
        is_active: true 
      }]);
      if (dbError) throw dbError;

      if (aiData.campaign_id) {
        Alert.alert('🎉 コラボカード錬成！', `企業キャンペーンを検知！限定カード「${aiData.name}」を獲得しました！`);
      } else {
        Alert.alert('錬成成功！', `「${aiData.name}」が誕生しました！`);
      }
      setCustomName('');

    } catch (error: any) {
      Alert.alert('錬成エラー', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>THE FORGE</Text>
        <View style={[styles.ticketBadge, isPremium && styles.premiumBadge]}>
          <Text style={[styles.ticketText, isPremium && styles.premiumText]}>
            {isPremium ? '👑 無制限' : `🎟️ 残り: ${tickets} 枚`}
          </Text>
        </View>
      </View>
      
      <View style={styles.forgeBox}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>異界の画像解析中...</Text>
          </View>
        ) : (
          <>
            {isPremium && (
              <View style={styles.premiumInputContainer}>
                <Text style={styles.inputLabel}>👑 指定ネーム (任意)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例：伝説の聖剣"
                  placeholderTextColor="#475569"
                  value={customName}
                  onChangeText={setCustomName}
                  maxLength={15}
                />
              </View>
            )}

            <TouchableOpacity 
              style={[styles.cameraButton, (!isPremium && tickets <= 0) && styles.cameraButtonDisabled]} 
              onPress={takePhoto}
            >
              <Text style={styles.cameraButtonText}>
                {isPremium || tickets > 0 ? '📸 カメラを起動して錬成' : '⚠️ チケットがありません'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* 開催中のキャンペーン数をさりげなくアピールするUI */}
      <Text style={styles.campaignInfo}>
        🔥 現在 {activeCampaigns.length} 個の企業・自治体コラボイベントが開催中！
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  headerRow: { flexDirection: 'row', justifyStyle: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  header: { fontSize: 24, fontWeight: '900', color: '#cbd5e1', letterSpacing: 2 },
  ticketBadge: { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderWidth: 1, borderColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  ticketText: { color: '#fbbf24', fontWeight: 'bold', fontSize: 12 },
  premiumBadge: { backgroundColor: 'rgba(192, 132, 252, 0.2)', borderColor: '#c084fc' },
  premiumText: { color: '#c084fc' },
  forgeBox: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: '#334155', borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  premiumInputContainer: { width: '100%', marginBottom: 30 },
  inputLabel: { color: '#c084fc', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: 'rgba(2, 6, 23, 0.8)', borderWidth: 1, borderColor: '#c084fc', borderRadius: 10, color: 'white', padding: 15, fontSize: 16 },
  cameraButton: { backgroundColor: '#10b981', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, shadowColor: '#10b981', shadowOpacity: 0.5, shadowRadius: 10, width: '100%', alignItems: 'center' },
  cameraButtonDisabled: { backgroundColor: '#475569', shadowOpacity: 0 },
  cameraButtonText: { color: 'white', fontWeight: '900', fontSize: 16 },
  loadingContainer: { alignItems: 'center' },
  loadingText: { color: '#10b981', marginTop: 15, fontWeight: 'bold' },
  campaignInfo: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 20, fontWeight: 'bold' }
});
