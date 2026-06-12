import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, SafeAreaView } from 'react-native';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [customName, setCustomName] = useState<string>('');

  return (
    <SafeAreaView style={styles.container}>
      {/* 上部ステータス */}
      <View style={styles.statusRow}>
        <View style={styles.premiumPill}>
          <Text style={styles.premiumText}>🛠️ 開発モード: 無制限</Text>
        </View>
      </View>

      {/* メインのアクションエリア */}
      <View style={styles.centerArea}>
        <View style={styles.actionBox}>
          <TextInput
            style={styles.input}
            placeholder="好きな名前を指定 (任意)"
            placeholderTextColor="#94A3B8"
            value={customName}
            onChangeText={setCustomName}
            maxLength={15}
          />
          
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8}>
            <Camera color="#FFFFFF" size={28} style={{ marginRight: 10 }} />
            <Text style={styles.primaryButtonText}>カメラを起動</Text>
          </TouchableOpacity>
          <Text style={styles.subText}>現実の風景や商品を撮影してカード生成</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // flex: 1 がないとタブバーが押し出される原因になります
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
  premiumPill: { backgroundColor: '#EFF6FF', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  premiumText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  actionBox: { width: '100%', alignItems: 'center' },
  
  input: { backgroundColor: '#FFFFFF', width: '100%', padding: 18, borderRadius: 16, fontSize: 16, color: '#0F172A', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  primaryButton: { flexDirection: 'row', backgroundColor: '#3B82F6', width: '100%', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  
  subText: { color: '#64748b', fontSize: 13, marginTop: 15, fontWeight: '500' },
});