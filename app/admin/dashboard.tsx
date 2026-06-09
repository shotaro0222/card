import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ total: 0, gender: {}, region: {} });
  const [prompt, setPrompt] = useState('');
  const [rates, setRates] = useState<any>({});

  // 企業コラボ・固定カード登録用のステート
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [arModelUrl, setArModelUrl] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    // デモグラ集計
    const { data: profiles } = await supabase.from('profiles').select('gender, region');
    const aggregate = profiles?.reduce((acc: any, curr: any) => {
      acc.total++;
      if (curr.gender) acc.gender[curr.gender] = (acc.gender[curr.gender] || 0) + 1;
      if (curr.region) acc.region[curr.region] = (acc.region[curr.region] || 0) + 1;
      return acc;
    }, { total: 0, gender: {}, region: {} });
    setStats(aggregate);

    // プロンプト・ドロップ率取得
    const { data: config } = await supabase.from('system_config').select('*');
    config?.forEach(item => {
      if (item.id === 'main_prompt') setPrompt(item.config_data.base);
      if (item.id === 'rarity_config') setRates(item.config_data);
    });
  };

  const saveConfig = async () => {
    await supabase.from('system_config').upsert({
      id: 'main_prompt',
      config_data: { base: prompt, marketing_injection: "メーカーの商品を神として扱え" }
    });
    Alert.alert('保存完了', 'AIの挙動ルールをアップデートしました。');
  };

  // 🎁 企業コラボカードの登録処理
  const registerFixedCard = async () => {
    if (!triggerKeyword || !cardName || !imageUrl) {
      Alert.alert('入力エラー', '検知キーワード、カード名、画像URLは必須です。');
      return;
    }

    const { error } = await supabase.from('fixed_cards').insert([{
      trigger_type: 'logo_detection',
      trigger_value: triggerKeyword,
      card_name: cardName,
      image_url: imageUrl,
      ar_model_url: arModelUrl || null,
      stats: {
        hp: 999,
        atk: 500,
        def: 500,
        spd: 300,
        feature: "企業協賛の限定デザインカード！",
        skill: "スポンサー・バースト"
      }
    }]);

    if (error) {
      Alert.alert('エラー', error.message);
    } else {
      Alert.alert('登録完了', `「${triggerKeyword}」を検知した際、特殊カード「${cardName}」が排出されるようになりました！`);
      setTriggerKeyword('');
      setCardName('');
      setImageUrl('');
      setArModelUrl('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <Text style={styles.h1}>運営管理プラットフォーム</Text>

      {/* ユーザー分析パネル */}
      <View style={styles.section}>
        <Text style={styles.h2}>📊 ユーザーデモグラフィック分析</Text>
        <Text style={styles.label}>総ユーザー数: {stats.total}名</Text>
        <View style={styles.chartMock}>
          <Text style={styles.white}>性別比: 男性 {Math.round((stats.gender['male']||0)/stats.total*100 || 0)}% / 女性 {Math.round((stats.gender['female']||0)/stats.total*100 || 0)}%</Text>
          <Text style={styles.white}>主要地域: 関東 {Math.round((stats.region['関東']||0)/stats.total*100 || 0)}%</Text>
        </View>
      </View>

      {/* 🎁 企業コラボ・特殊カード登録パネル (今回追加) */}
      <View style={[styles.section, { borderColor: '#F59E0B' }]}>
        <Text style={[styles.h2, { color: '#F59E0B' }]}>🎁 企業コラボ・特殊カード追加</Text>
        <Text style={styles.label}>AIが特定のロゴや商品を検知した際、ここで設定したオリジナルデザインのカードを強制排出します。</Text>

        <TextInput style={styles.inputFull} placeholder="検知キーワード (例: コカ・コーラのロゴ)" placeholderTextColor="#64748B" value={triggerKeyword} onChangeText={setTriggerKeyword} />
        <TextInput style={styles.inputFull} placeholder="排出するカード名 (例: 限定コーラドラゴン)" placeholderTextColor="#64748B" value={cardName} onChangeText={setCardName} />
        <TextInput style={styles.inputFull} placeholder="カード画像URL (企業から貰ったデザイン等)" placeholderTextColor="#64748B" value={imageUrl} onChangeText={setImageUrl} />
        <TextInput style={styles.inputFull} placeholder="WebAR用URL (任意: タップで3D起動)" placeholderTextColor="#64748B" value={arModelUrl} onChangeText={setArModelUrl} />

        <TouchableOpacity style={[styles.btn, { backgroundColor: '#F59E0B' }]} onPress={registerFixedCard}>
          <Text style={styles.btnText}>コラボカードをシステムに登録</Text>
        </TouchableOpacity>
      </View>

      {/* プロンプト・エンジニアリング・パネル */}
      <View style={styles.section}>
        <Text style={styles.h2}>🧠 AI錬成ロジック調整 (Gemini Prompt)</Text>
        <TextInput style={styles.textArea} multiline value={prompt} onChangeText={setPrompt} placeholder="AIへの基本命令を入力..." />
        <TouchableOpacity style={styles.btn} onPress={saveConfig}>
          <Text style={styles.btnText}>プロンプトをデプロイ</Text>
        </TouchableOpacity>
      </View>

      {/* ドロップ率調整 */}
      <View style={styles.section}>
        <Text style={styles.h2}>💎 レアリティ出現率調整 (%)</Text>
        {Object.keys(rates).map(key => (
          <View key={key} style={styles.row}>
            <Text style={styles.white}>{key}: </Text>
            <TextInput style={styles.inputSmall} value={String(rates[key])} onChangeText={(v) => setRates({...rates, [key]: Number(v)})} keyboardType="numeric" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  h1: { color: '#38BDF8', fontSize: 24, fontWeight: '900', marginBottom: 20, marginTop: 20 },
  h2: { color: '#F1F5F9', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  section: { backgroundColor: '#1E293B', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  white: { color: 'white', fontWeight: 'bold', lineHeight: 24 },
  label: { color: '#94A3B8', marginBottom: 15, fontSize: 12, lineHeight: 18 },
  
  textArea: { backgroundColor: '#020617', color: '#10B981', padding: 15, borderRadius: 10, height: 150, textAlignVertical: 'top', fontFamily: 'monospace' },
  inputFull: { backgroundColor: '#020617', color: 'white', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  inputSmall: { backgroundColor: '#020617', color: 'white', padding: 8, borderRadius: 5, width: 60, textAlign: 'center', borderWidth: 1, borderColor: '#334155' },
  
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  btn: { backgroundColor: '#38BDF8', padding: 16, borderRadius: 12, marginTop: 10, alignItems: 'center' },
  btnText: { fontWeight: '900', color: '#0F172A', fontSize: 15 },
  chartMock: { marginTop: 10, padding: 15, backgroundColor: '#020617', borderRadius: 10, borderWidth: 1, borderColor: '#334155' }
});
