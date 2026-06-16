import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

// 💡 修正箇所1: 画像をファイルの先頭で確実にインポートする（require()を使用してExpoのバンドラーで正しく認識させます）
const logoImg = require('./assets/images/logo.png');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [region, setRegion] = useState('');

  const router = useRouter();

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profile?.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      Alert.alert('ログイン失敗', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (!email || !password || !playerName || !gender || !ageGroup || !region) {
      Alert.alert('入力エラー', 'すべての項目（デモグラフィック情報を含む）を入力・選択してください。');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            player_name: playerName,
            gender: gender,
            age_group: ageGroup,
            region: region,
            role: 'user', 
          },
        ]);

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('登録失敗', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      
      {/* 💡 修正箇所2: importした画像変数を使用する */}
      <Image 
        source={logoImg} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.subtitle}>REAL-PHOTO TCG & MARKETING PLATFORM</Text>

      <Text style={styles.formTitle}>{isSignUp ? '【新規軍勢登録】' : '【闘技場潜入ゲート】'}</Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        placeholderTextColor="#64748b"
        onChangeText={setEmail}
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード"
        placeholderTextColor="#64748b"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      {isSignUp && (
        <View style={styles.demoSection}>
          <Text style={styles.sectionTitle}>司令官プロファイル（マーケティング割付用）</Text>
          
          <TextInput
            style={styles.input}
            placeholder="プレイヤー名（ゲーム内表示）"
            placeholderTextColor="#64748b"
            onChangeText={setPlayerName}
            value={playerName}
          />

          <Text style={styles.label}>性別</Text>
          <View style={styles.selectRow}>
            {['male', 'female', 'other'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.activeChip]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.chipText, gender === g && styles.activeChipText]}>
                  {g === 'male' ? '男性' : g === 'female' ? '女性' : 'その他'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>年代</Text>
          <View style={styles.selectRow}>
            {['10s', '20s', '30s', '40s', '50s+'].map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, ageGroup === a && styles.activeChip]}
                onPress={() => setAgeGroup(a)}
              >
                <Text style={[styles.chipText, ageGroup === a && styles.activeChipText]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>所属地域</Text>
          <View style={styles.selectRow}>
            {['関東', '関西', '中部', '九州', '北海道・東北', 'その他'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, region === r && styles.activeChip]}
                onPress={() => setRegion(r)}
              >
                <Text style={[styles.chipText, region === r && styles.activeChipText]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#f43f5e" style={{ marginVertical: 20 }} />
      ) : (
        <>
          {!isSignUp ? (
            <TouchableOpacity style={styles.button} onPress={signInWithEmail}>
              <Text style={styles.buttonText}>ゲートを開放してログイン</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={signUpWithEmail}>
              <Text style={styles.buttonText}>登録完了</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.toggleLink} onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.toggleLinkText}>
              {isSignUp ? 'すでにアカウントをお持ちの方（ログインへ）' : '新しく軍勢を登録する（新規作成へ）'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 24, justifyContent: 'center', paddingTop: 80, paddingBottom: 40 },
  
  logo: { 
    width: '80%',       
    maxWidth: 280,      
    height: 100,        
    alignSelf: 'center',
    marginBottom: 10 
  },
  
  subtitle: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 40, fontWeight: '700' },
  formTitle: { color: '#475569', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 24 },
  
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, color: '#0F172A', padding: 18, marginBottom: 16, fontSize: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  
  demoSection: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 },
  sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 10 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  
  chip: { backgroundColor: '#F1F5F9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  activeChip: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  chipText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
  activeChipText: { color: '#2563EB', fontWeight: '800' },
  
  button: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  
  toggleLink: { marginTop: 30, alignItems: 'center' },
  toggleLinkText: { color: '#3B82F6', fontSize: 14, fontWeight: '700' },
});
