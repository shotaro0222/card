import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase'; // 相対パスに修正
import { useRouter } from 'expo-router';

export default function WebLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    // React Nativeではe.preventDefault()は不要
    if (!email || !password) {
      Alert.alert('エラー', '入力してください');
      return;
    }
    setLoading(true);

    try {
      // 1. Supabase Authでログイン
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. profiles テーブルからロール（権限）を確認
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profileError) throw profileError;

        // 3. 管理者でなければ即座にログアウトさせて拒否
        if (profile?.role !== 'admin') {
          await supabase.auth.signOut();
          Alert.alert('アクセス拒否', 'アクセス権限がありません。運営管理者アカウントのみログイン可能です。');
          return;
        }

        // 管理者ならダッシュボードへ遷移 (app/admin/dashboard.tsx を想定)
        router.replace('/admin/dashboard');
      }
    } catch (err: any) {
      Alert.alert('ログイン失敗', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>VOID CARD</Text>
        <Text style={styles.subtitle}>COMMAND CENTER LOG-IN</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>管理者メールアドレス</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@example.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>パスワード</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>マスターゲートを開放</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// TailwindのスタイルをReact NativeのStyleSheetに翻訳
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // bg-slate-900
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400, // max-w-md
    backgroundColor: '#1e293b', // bg-slate-800
    padding: 32,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#334155', // border-slate-700
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10, // for Android
  },
  title: {
    fontSize: 28,
    fontWeight: '900', // font-black
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2, // tracking-wider
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8', // text-slate-400
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12, // rounded-xl
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2563eb', // bg-blue-600
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#1d4ed8', // hover:bg-blue-700
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
