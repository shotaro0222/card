import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('ログイン失敗', error.message);
    else router.replace('/(tabs)');
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('登録失敗', error.message);
    } else if (data.user) {
      // プロフィールテーブルに初期データを登録 (ユーザー名はランダム生成等を仮置き)
      await supabase.from('profiles').insert([
        { id: data.user.id, player_name: `司令官_${Math.floor(Math.random() * 10000)}` }
      ]);
      Alert.alert('登録完了', 'ログインしてください');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VOID CARD</Text>
      <Text style={styles.subtitle}>REAL-PHOTO TCG ARENA</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        onChangeText={setEmail}
        value={email}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TouchableOpacity style={styles.button} onPress={signInWithEmail} disabled={loading}>
        <Text style={styles.buttonText}>闘技場へ潜入する (ログイン)</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={signUpWithEmail} disabled={loading}>
        <Text style={styles.outlineButtonText}>魂を登録する (新規登録)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', padding: 20 },
  title: { fontSize: 36, fontWeight: '900', color: '#f87171', textAlign: 'center', letterSpacing: 4 },
  subtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 40, letterSpacing: 2 },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: '#334155', borderRadius: 12, color: 'white', padding: 15, marginBottom: 15 },
  button: { backgroundColor: '#b91c1c', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  outlineButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#b91c1c' },
  outlineButtonText: { color: '#f87171', fontWeight: 'bold', fontSize: 16 },
});
