import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Platform, TextInput, Modal } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, bosses, ai_prompt, survey
  const router = useRouter();

  // 📊 データ用ステート
  const [profiles, setProfiles] = useState([]);
  const [crossTabData, setCrossTabData] = useState(null);
  
  // 🤖 AIプロンプト用ステート
  const [aiMakerName, setAiMakerName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  
  // 👹 ボス・カード用ステート
  const [bosses, setBosses] = useState([]);
  const [bossModalVisible, setBossModalVisible] = useState(false);
  const [bossForm, setBossForm] = useState({
    name: '', hp: '100', lat: '', lng: '',
    atk: '10', def: '10', spd: '10',
    skills: [''], // 複数技
    drop_card_name: '', drop_card_rarity: 'Normal',
    custom_image_uri: '', custom_design_json: ''
  });

  // 📢 サーベイ用ステート
  const [surveyForm, setSurveyForm] = useState({ title: '', target_criteria: '', url: '' });

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    setLoading(true);
    // モックデータのセットアップ（本番環境ではSupabaseからFetch）
    if (activeTab === 'analytics') {
      const mockProfiles = [{ id: 1, is_premium: true, total_playtime_minutes: 120, last_active_at: new Date() }];
      setProfiles(mockProfiles);
      generateCrossTab(mockProfiles);
    } else if (activeTab === 'bosses') {
      // 既存のボスリスト取得処理
    }
    setLoading(false);
  };

  const generateCrossTab = (data) => {
    // 既存のクロス集計ロジック
    setCrossTabData({
      premium: { count: 1, avg: 120 },
      free: { count: 0, avg: 0 }
    });
  };

  // 🤖 AIプロンプトの保存（メーカー指定対応）
  const saveAiPrompt = async () => {
    if (!aiMakerName) return Alert.alert('エラー', 'メーカー名を入力してください');
    // await supabase.from('ai_prompt_templates').upsert({ maker_name: aiMakerName, system_prompt: aiPrompt });
    Alert.alert('保存完了', `${aiMakerName}用のAI錬成プロンプト雛形を更新しました。`);
    setAiMakerName('');
    setAiPrompt('');
  };

  // 👹 技の入力フィールド制御
  const updateSkill = (text, index) => {
    const newSkills = [...bossForm.skills];
    newSkills[index] = text;
    setBossForm({ ...bossForm, skills: newSkills });
  };
  const addSkillField = () => setBossForm({ ...bossForm, skills: [...bossForm.skills, ''] });

  // 👹 ランダムボス自動生成
  const generateRandomBoss = () => {
    const lat = (35.0 + Math.random() * 2).toFixed(4); // 仮の日本緯度
    const lng = (135.0 + Math.random() * 5).toFixed(4); // 仮の日本経度
    setBossForm({
      name: `異変種ボス_${Math.floor(Math.random() * 1000)}`,
      hp: String(Math.floor(Math.random() * 500) + 100),
      lat, lng,
      atk: String(Math.floor(Math.random() * 50) + 10),
      def: String(Math.floor(Math.random() * 50) + 10),
      spd: String(Math.floor(Math.random() * 50) + 10),
      skills: ['なぎ払う', 'ランダムストライク'],
      drop_card_name: `謎のカード_${Math.floor(Math.random() * 100)}`,
      drop_card_rarity: ['Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 3)],
      custom_image_uri: '', custom_design_json: ''
    });
  };

  // 👹 ボスの保存処理
  const saveBoss = () => {
    // await supabase.from('bosses').insert({...});
    Alert.alert('配置完了', `${bossForm.name}をマップ座標(${bossForm.lat}, ${bossForm.lng})に配置しました。`);
    setBossModalVisible(false);
  };

  // 🖼 画像アップロードモック
  const handleImageUpload = () => {
    Alert.alert('アップロード', 'ファイルピッカーを開き、Supabase Storageに保存します。');
    setBossForm({ ...bossForm, custom_image_uri: 'https://example.com/uploaded.png' });
  };

  // 📢 サーベイ配信
  const sendSurvey = () => {
    Alert.alert('配信完了', `条件「${surveyForm.target_criteria}」のユーザーへお知らせとサーベイを配信しました。`);
    setSurveyForm({ title: '', target_criteria: '', url: '' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMMAND CENTER</Text>
        <TouchableOpacity style={styles.exitBtn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.exitBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {['analytics', 'bosses', 'ai_prompt', 'survey'].map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t === 'analytics' ? '📊 分析' : t === 'bosses' ? '👹 ボス・カード' : t === 'ai_prompt' ? '🤖 AI調整' : '📢 サーベイ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.contentArea}>
        
        {/* 📊 分析タブ（変更なし） */}
        {activeTab === 'analytics' && crossTabData && (
          <View>
            <Text style={styles.sectionTitle}>課金セグメント × プレイ時間</Text>
            {/* 既存のテーブルUI... */}
          </View>
        )}

        {/* 🤖 AIプロンプト調整タブ */}
        {activeTab === 'ai_prompt' && (
          <View>
            <Text style={styles.sectionTitle}>メーカー別 AI錬成プロンプト</Text>
            <Text style={styles.subText}>特定の企業コラボなどで生成されるカードのテイストやステータス基準を定義します。</Text>
            
            <TextInput style={styles.input} placeholder="メーカー・ブランド名 (例: メーカーA)" placeholderTextColor="#64748B" value={aiMakerName} onChangeText={setAiMakerName} />
            <TextInput style={styles.textArea} multiline value={aiPrompt} onChangeText={setAiPrompt} placeholder="システムプロンプトの雛形を入力..." placeholderTextColor="#64748B" />
            
            <TouchableOpacity style={styles.primaryBtn} onPress={saveAiPrompt}>
              <Text style={styles.primaryBtnText}>プロンプトを登録</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 👹 ボスマップ・ドロップ・カード管理タブ */}
        {activeTab === 'bosses' && (
          <View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={() => setBossModalVisible(true)}>
                <Text style={styles.primaryBtnText}>➕ 新規ボス手動配置</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, marginTop: 0 }]} onPress={() => { generateRandomBoss(); setBossModalVisible(true); }}>
                <Text style={styles.secondaryBtnText}>🎲 ランダム生成</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionTitle}>稼働中のスポットボス</Text>
            {/* ボス一覧表示... */}
          </View>
        )}

        {/* 📢 お知らせ＆サーベイ配信タブ */}
        {activeTab === 'survey' && (
          <View>
            <Text style={styles.sectionTitle}>ターゲット指定サーベイ・お知らせ</Text>
            <Text style={styles.subText}>デモグラフィックやスキャン履歴による割付配信を行います。</Text>
            
            <TextInput style={styles.input} placeholder="お知らせタイトル" placeholderTextColor="#64748B" value={surveyForm.title} onChangeText={t => setSurveyForm({...surveyForm, title: t})} />
            <TextInput style={styles.input} placeholder="ターゲット条件 (例: メーカーAをスキャンしたユーザー)" placeholderTextColor="#64748B" value={surveyForm.target_criteria} onChangeText={t => setSurveyForm({...surveyForm, target_criteria: t})} />
            <TextInput style={styles.input} placeholder="サーベイURL (Google Forms等)" placeholderTextColor="#64748B" value={surveyForm.url} onChangeText={t => setSurveyForm({...surveyForm, url: t})} />
            
            <TouchableOpacity style={styles.primaryBtn} onPress={sendSurvey}>
              <Text style={styles.primaryBtnText}>✉️ 対象ユーザーに配信する</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 👹 ボス作成モーダル */}
      <Modal visible={bossModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={styles.sectionTitle}>ボスの詳細設定と報酬カード</Text>
              <TouchableOpacity onPress={() => setBossModalVisible(false)}><Text style={{ color: '#0EA5E9', fontWeight: 'bold' }}>キャンセル</Text></TouchableOpacity>
            </View>

            <Text style={styles.label}>ボス基本情報</Text>
            <TextInput style={styles.input} placeholder="ボス名" placeholderTextColor="#64748B" value={bossForm.name} onChangeText={t => setBossForm({...bossForm, name: t})} />
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="緯度 (Lat)" placeholderTextColor="#64748B" value={bossForm.lat} onChangeText={t => setBossForm({...bossForm, lat: t})} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="経度 (Lng)" placeholderTextColor="#64748B" value={bossForm.lng} onChangeText={t => setBossForm({...bossForm, lng: t})} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" placeholderTextColor="#64748B" value={bossForm.hp} onChangeText={t => setBossForm({...bossForm, hp: t})} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" placeholderTextColor="#64748B" value={bossForm.atk} onChangeText={t => setBossForm({...bossForm, atk: t})} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="DEF" placeholderTextColor="#64748B" value={bossForm.def} onChangeText={t => setBossForm({...bossForm, def: t})} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="SPD" placeholderTextColor="#64748B" value={bossForm.spd} onChangeText={t => setBossForm({...bossForm, spd: t})} />
            </View>

            <Text style={styles.label}>使用する技（複数可）</Text>
            {bossForm.skills.map((skill, index) => (
              <TextInput key={index} style={styles.input} placeholder={`技名 ${index + 1}`} placeholderTextColor="#64748B" value={skill} onChangeText={(t) => updateSkill(t, index)} />
            ))}
            <TouchableOpacity style={styles.outlineBtn} onPress={addSkillField}><Text style={styles.outlineBtnText}>+ 技を追加</Text></TouchableOpacity>

            <Text style={[styles.label, { marginTop: 20 }]}>討伐報酬（ドロップカード）設定</Text>
            <TextInput style={styles.input} placeholder="カード名（空ならドロップなし）" placeholderTextColor="#64748B" value={bossForm.drop_card_name} onChangeText={t => setBossForm({...bossForm, drop_card_name: t})} />
            <TextInput style={styles.input} placeholder="レアリティ (例: Rare)" placeholderTextColor="#64748B" value={bossForm.drop_card_rarity} onChangeText={t => setBossForm({...bossForm, drop_card_rarity: t})} />
            
            <TouchableOpacity style={styles.outlineBtn} onPress={handleImageUpload}>
              <Text style={styles.outlineBtnText}>{bossForm.custom_image_uri ? '✅ 画像アップロード済み' : '🖼 カード画像ファイルをアップロード'}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>カードデザイン適用 (JSON)</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder={`{"borderColor": "gold", "layout": "special"}`} placeholderTextColor="#64748B" multiline value={bossForm.custom_design_json} onChangeText={t => setBossForm({...bossForm, custom_design_json: t})} />

            <TouchableOpacity style={[styles.primaryBtn, { marginBottom: 40 }]} onPress={saveBoss}>
              <Text style={styles.primaryBtnText}>この設定でマップに配置</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  exitBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  exitBtnText: { color: '#F8FAFC', fontWeight: '800' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#0EA5E9' },
  tabText: { color: '#64748B', fontWeight: '800', fontSize: 12 },
  activeTabText: { color: '#0EA5E9', fontWeight: '900' },

  contentArea: { flex: 1, padding: 16 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginBottom: 8, marginTop: 10 },
  subText: { color: '#94A3B8', fontSize: 12, marginBottom: 16 },
  label: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 6, marginTop: 12 },

  primaryBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  secondaryBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  secondaryBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  outlineBtn: { borderWidth: 1, borderColor: '#3B82F6', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  outlineBtnText: { color: '#3B82F6', fontWeight: '700' },

  textArea: { backgroundColor: '#1E293B', color: '#F8FAFC', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#334155', minHeight: 150, textAlignVertical: 'top', marginBottom: 12 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },

  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
});