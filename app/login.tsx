import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // ログインと新規登録の切り替えトグル

  // デモグラフィック用のステート
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [region, setRegion] = useState('');

  const router = useRouter();

  // 1. ログイン処理 ＆ ロール判定ルーティング
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
        // ユーザーのロール（一般 or 管理者）を profiles テーブルから取得
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profileError) throw profileError;

        // ロールに応じて遷移先を自動的に振り分ける
        if (profile?.role === 'admin') {
          Alert.alert('認証成功', '運営管理者アカウントでログインしました。');
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

  // 2. 新規登録 ＆ デモグラフィック情報紐付け処理
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
        // 認証ユーザー作成と同時に、プロフィール情報とデモグラをデータベースへ登録
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            player_name: playerName,
            gender: gender,
            age_group: ageGroup,
            region: region,
            role: 'user', // デフォルトは一般ユーザー
          },
        ]);

        if (profileError) throw profileError;

        Alert.alert('登録完了', '魂の登録が完了しました。作成したアカウントでログインしてください。');
        setIsSignUp(false); // ログイン画面モードに戻す
      }
    } catch (error: any) {
      Alert.alert('登録失敗', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <Text style={styles.title}>VOID CARD</Text>
      <Text style={styles.subtitle}>REAL-PHOTO TCG & MARKETING PLATFORM</Text>

      <Text style={styles.formTitle}>{isSignUp ? '【新規軍勢登録】' : '【闘技場潜入ゲート】'}</Text>

      {/* 共通入力欄 */}
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

      {/* 新規登録時のみ表示されるデモグラフィックフォーム */}
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

          {/* 性別選択 */}
          <Text style={styles.label}>性別</Text>
          <div style={styles.selectRow}>
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
          </div>

          {/* 年代選択 */}
          <Text style={styles.label}>年代</Text>
          <div style={styles.selectRow}>
            {['10s', '20s', '30s', '40s', '50s+'].map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, ageGroup === a && styles.activeChip]}
                onPress={() => setAgeGroup(a)}
              >
                <Text style={[styles.chipText, ageGroup === a && styles.activeChipText]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </div>

          {/* 地域選択 */}
          <Text style={styles.label}>所属地域</Text>
          <div style={styles.selectRow}>
            {['関東', '関西', '中部', '九州', '北海道・東北', 'その他'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, region === r && styles.activeChip]}
                onPress={() => setRegion(r)}
              >
                <Text style={[styles.chipText, region === r && styles.activeChipText]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </div>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#f43f5e" style={{ marginVertical: 20 }} />
      ) : (
        <>
          {/* メインアクションボタン */}
          {!isSignUp ? (
            <TouchableOpacity style={styles.button} onPress={signInWithEmail}>
              <Text style={styles.buttonText}>ゲートを開放してログイン</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={signUpWithEmail}>
              <Text style={styles.buttonText}>デモグラ情報を登録して契約</Text>
            </TouchableOpacity>
          )}

          {/* モード切り替えリンク */}
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
  scrollContainer: { flex: 1, backgroundColor: '#020617' },
  container: { padding: 20, justifyContent: 'center', paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 38, fontWeight: '900', color: '#f43f5e', textAlign: 'center', letterSpacing: 4, textShadowColor: 'rgba(244, 63, 94, 0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  subtitle: { fontSize: 10, color: '#64748b', textAlign: 'center', marginBottom: 30, letterSpacing: 1, fontWeight: 'bold' },
  formTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, color: 'white', padding: 15, marginBottom: 15, fontSize: 15 },
  demoSection: { backgroundColor: '#0f172a', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  sectionTitle: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 5 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: 'rgba(244, 63, 94, 0.2)', borderColor: '#f43f5e' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  activeChipText: { color: '#f43f5e', fontWeight: 'bold' },
  button: { backgroundColor: '#b91c1c', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#f43f5e', shadowOpacity: 0.2, shadowRadius: 10 },
  buttonText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  toggleLink: { marginTop: 25, alignItems: 'center' },
  toggleLinkText: { color: '#64748b', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },
});
