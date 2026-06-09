import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ total: 0, gender: {}, region: {} });
  const [prompt, setPrompt] = useState('');
  const [rates, setRates] = useState<any>({});

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    // デモグラ集計 (簡易版)
    const { data: profiles } = await supabase.from('profiles').select('gender, region');
    const aggregate = profiles?.reduce((acc: any, curr: any) => {
      acc.total++;
      acc.gender[curr.gender] = (acc.gender[curr.gender] || 0) + 1;
      acc.region[curr.region] = (acc.region[curr.region] || 0) + 1;
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
    alert('設定を保存しました。AIの挙動が即座に変更されます。');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.h1}>運営管理プラットフォーム</Text>

      {/* ユーザー分析パネル */}
      <View style={styles.section}>
        <Text style={styles.h2}>📊 ユーザーデモグラフィック分析</Text>
        <Text style={styles.label}>総ユーザー数: {stats.total}名</Text>
        <View style={styles.chartMock}>
          <Text style={styles.white}>性別比: 男 {Math.round(stats.gender['male']/stats.total*100)}% / 女 {Math.round(stats.gender['female']/stats.total*100)}%</Text>
        </View>
      </View>

      {/* プロンプト・エンジニアリング・パネル */}
      <View style={styles.section}>
        <Text style={styles.h2}>🧠 AI錬成ロジック調整 (Gemini Prompt)</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={prompt}
          onChangeText={setPrompt}
          placeholder="AIへの基本命令を入力..."
        />
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
            <TextInput 
              style={styles.input} 
              value={String(rates[key])} 
              onChangeText={(v) => setRates({...rates, [key]: Number(v)})} 
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  h1: { color: '#38bdf8', fontSize: 28, fontWeight: '900', marginBottom: 20 },
  h2: { color: '#f1f5f9', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  section: { backgroundColor: '#1e293b', padding: 20, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  white: { color: 'white' },
  label: { color: '#94a3b8', marginBottom: 10 },
  textArea: { backgroundColor: '#020617', color: '#10b981', padding: 15, borderRadius: 10, height: 150, textAlignVertical: 'top', fontFamily: 'monospace' },
  input: { backgroundColor: '#020617', color: 'white', padding: 5, borderRadius: 5, width: 50, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  btn: { backgroundColor: '#38bdf8', padding: 15, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a' },
  chartMock: { marginTop: 10, padding: 10, backgroundColor: '#334155', borderRadius: 5 }
});
