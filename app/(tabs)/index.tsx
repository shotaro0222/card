import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, SafeAreaView } from 'react-native';
import { Camera } from 'lucide-react-native';

export default function ForgeScreen() {
  const [customName, setCustomName] = useState<string>('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 開発モード表示 */}
        <View style={styles.devBadge}>
          <Text style={styles.devText}>🛠️ 開発モード: 無制限</Text>
        </View>

        <View style={styles.mainBox}>
          <Text style={styles.instruction}>好きな名前を指定（任意）</Text>
          <TextInput
            style={styles.input}
            placeholder="カードの名称を入力..."
            value={customName}
            onChangeText={setCustomName}
          />
          
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Camera color="#FFFFFF" size={24} style={{ marginRight: 10 }} />
            <Text style={styles.actionButtonText}>カメラを起動</Text>
          </TouchableOpacity>
          
          <Text style={styles.subInfo}>現実の風景や商品を撮影してカード化</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingBottom: 100 // タブバーに被らないよう余白を確保
  },
  devBadge: { 
    backgroundColor: '#EFF6FF', 
    paddingHorizontal: 16, 
    paddingVertical: 6, 
    borderRadius: 20,
    marginBottom: 40 
  },
  devText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  mainBox: { 
    width: '85%', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  instruction: { fontSize: 14, color: '#64748B', marginBottom: 15, fontWeight: '600' },
  input: { 
    width: '100%', 
    backgroundColor: '#F1F5F9', 
    padding: 15, 
    borderRadius: 12, 
    fontSize: 16, 
    marginBottom: 20 
  },
  actionButton: { 
    flexDirection: 'row',
    backgroundColor: '#3B82F6', 
    width: '100%', 
    height: 60, 
    borderRadius: 15, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subInfo: { color: '#94A3B8', fontSize: 12, marginTop: 15, fontWeight: '500' }
});