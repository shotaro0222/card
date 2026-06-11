import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('bosses'); // bosses, survey

  // 👹 ボスマップ用ステート
  const [bosses, setBosses] = useState<any[]>([]);
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('1000');
  const [bAtk, setBAtk] = useState('100');
  const [bLat, setBLat] = useState('35.6983'); // 初期値: 立川駅周辺
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('500');

  // ✉️ サーベイ用ステート
  const [surveys, setSurveys] = useState<any[]>([]);
  const [sTitle, setSTitle] = useState('');
  const [sTarget, setSTarget] = useState('all'); // all, premium, free, target_item
  const [sUrl, setSUrl] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'bosses') {
      const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false });
      if (data) setBosses(data);
    } else if (activeTab === 'survey') {
      const { data } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
      if (data) setSurveys(data);
    }
  };

  // ==========================================
  // 👹 ボスマップ機能
  // ==========================================
  const handleAddBoss = async () => {
    if (!bName || !bLat || !bLng) return Alert.alert('エラー', '必須項目を入力してください');
    const { error } = await supabase.from('bosses').insert([{
      name: bName, hp: parseInt(bHp), atk: parseInt(bAtk),
      lat: parseFloat(bLat), lng: parseFloat(bLng), radius_meters: parseInt(bRadius),
      is_active: true
    }]);
    if (!error) { Alert.alert('成功', 'ボスをマップに配置しました'); fetchAdminData(); }
  };

  const handleGenerateRandomBoss = () => {
    // 現在設定されている座標（デフォルト立川）の近辺にランダム配置
    const baseLat = parseFloat(bLat) || 35.6983;
    const baseLng = parseFloat(bLng) || 139.4130;
    
    setBName(`異変種ボス_${Math.floor(Math.random() * 9999)}`);
    setBHp(String(Math.floor(Math.random() * 5000) + 1000));
    setBAtk(String(Math.floor(Math.random() * 500) + 100));
    setBLat(String((baseLat + (Math.random() - 0.5) * 0.05).toFixed(5)));
    setBLng(String((baseLng + (Math.random() - 0.5) * 0.05).toFixed(5)));
    setBRadius(String(Math.floor(Math.random() * 500) + 100));
  };

  // ==========================================
  // ✉️ サーベイ・割付配信機能
  // ==========================================
  const handleSendSurvey = async () => {
    if (!sTitle || !sUrl) return Alert.alert('エラー', 'タイトルとURLは必須です');
    const { error } = await supabase.from('surveys').insert([{
      title: sTitle,
      target_segment: sTarget,
      form_url: sUrl,
      is_active: true
    }]);
    if (!error) { 
      Alert.alert('配信完了', `セグメント「${sTarget}」のユーザーへサーベイを配信しました。`); 
      fetchAdminData(); 
    }
  };

  // 📊 CSVエクスポート機能 (Expo Web対応)
  const exportSurveyResultsCSV = async (surveyId: string, surveyTitle: string) => {
    // 本来はサーベイ回答テーブル(survey_responses)から取得しますが、今回はモックデータで生成します
    const mockResponses = [
      { user_id: 'user_001', segment: 'premium', answered_at: '2026-06-11T10:00:00Z', q1: '満足', q2: '機能追加希望' },
      { user_id: 'user_002', segment: 'free', answered_at: '2026-06-11T11:30:00Z', q1: '普通', q2: '特になし' },
    ];

    const headers = ['User ID', 'Segment', 'Answered At', 'Q1', 'Q2'];
    const csvRows = mockResponses.map(r => `${r.user_id},${r.segment},${r.answered_at},"${r.q1}","${r.q2}"`);
    const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n'); // \uFEFF for Excel UTF-8 BOM

    if (Platform.OS === 'web') {
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `survey_result_${surveyTitle}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert('Web環境で実行してください', 'ネイティブアプリでのエクスポートはExpo FileSystem等が必要です。');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STRATEGIC ADMIN</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>終了</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {[
          { id: 'bosses', label: '👹 ボスマップ' },
          { id: 'survey', label: '✉️ サーベイ配信' },
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* 👹 ボスマップタブ */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>ボス新規配置（手動・ランダム）</Text>
              
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity style={[styles.addBtn, { flex: 1, marginTop: 0, backgroundColor: '#8B5CF6' }]} onPress={handleGenerateRandomBoss}>
                  <Text style={styles.addBtnText}>🎲 パラメータをランダム生成</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>基本ステータス</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              </View>

              <Text style={styles.label}>出現座標（緯度経度）</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="緯度 (Lat)" value={bLat} onChangeText={setBLat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="経度 (Lng)" value={bLng} onChangeText={setBLng} />
              </View>
              <TextInput style={styles.input} placeholder="影響半径 (meters)" keyboardType="numeric" value={bRadius} onChangeText={setBRadius} />

              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>指定座標にボスを配置</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>稼働中のボス一覧</Text>
            {bosses.map((b) => (
              <View key={b.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{b.name}</Text>
                  <Text style={styles.itemSub}>📍 {b.lat}, {b.lng} (HP:{b.hp} / ATK:{b.atk})</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ✉️ サーベイ・割付配信タブ */}
        {activeTab === 'survey' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>デモグラフィック割付・サーベイ配信</Text>
              <Text style={styles.infoText}>Google Forms等の簡易アンケートURLを、特定のユーザー属性（割付）に絞って配信します。</Text>
              
              <TextInput style={styles.input} placeholder="サーベイタイトル" value={sTitle} onChangeText={setSTitle} />
              <TextInput style={styles.input} placeholder="Google Forms等のURL" value={sUrl} onChangeText={setSUrl} />
              
              <Text style={styles.label}>配信ターゲット（割付セグメント）</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[
                  { id: 'all', label: '全員' },
                  { id: 'premium', label: '課金ユーザー' },
                  { id: 'target_item', label: '特定アイテム所持者' }
                ].map((t) => (
                  <TouchableOpacity key={t.id} style={[styles.miniChip, sTarget === t.id && styles.activeMiniChip]} onPress={() => setSTarget(t.id)}>
                    <Text style={[styles.miniChipText, sTarget === t.id && { color: '#2563EB' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#10B981' }]} onPress={handleSendSurvey}>
                <Text style={styles.addBtnText}>✉️ 対象ユーザーに配信する</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>配信済みサーベイ一覧</Text>
            {surveys.map((s) => (
              <View key={s.id} style={styles.listItemVertical}>
                <View style={{ width: '100%', marginBottom: 12 }}>
                  <Text style={styles.itemName}>{s.title}</Text>
                  <Text style={styles.itemSub}>対象: {s.target_segment} | 状態: {s.is_active ? '回答受付中' : '終了'}</Text>
                </View>
                <TouchableOpacity style={[styles.outlineBtn, { borderColor: '#10B981', width: '100%' }]} onPress={() => exportSurveyResultsCSV(s.id, s.title)}>
                  <Text style={[styles.outlineBtnText, { color: '#10B981' }]}>📥 回答結果をCSVでエクスポート</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0F172A' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoutBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  
  tabScroll: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', maxHeight: 60 },
  tabContainer: { paddingHorizontal: 10, alignItems: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 14, marginRight: 8 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#0F172A' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#0F172A', fontWeight: '900' },
  
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 12, marginTop: 8 },
  formSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  label: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  infoText: { color: '#64748B', fontSize: 12, marginBottom: 16, fontWeight: '600', lineHeight: 18 },
  
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 10, marginBottom: 10, color: '#0F172A' },
  addBtn: { backgroundColor: '#3B82F6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  outlineBtn: { borderWidth: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  outlineBtnText: { fontWeight: '800', fontSize: 14 },
  
  miniChip: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  activeMiniChip: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1 },
  miniChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  
  listItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemVertical: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  itemName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  itemSub: { fontSize: 12, color: '#64748B' },
});