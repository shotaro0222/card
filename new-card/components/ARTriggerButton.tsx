import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { Box, ScanLine } from 'lucide-react-native'; // アイコンはお好みのものを使用

interface ARTriggerButtonProps {
  type: 'promo' | 'boss' | 'ugc';
  targetId: string;
  label: string;
  color?: string;
}

export function ARTriggerButton({ type, targetId, label, color = '#8B5CF6' }: ARTriggerButtonProps) {
  
  const handleLaunchAR = async () => {
    // 💡 Vercelで公開するWebARページのURLに書き換えてください
    const vercelARUrl = `https://your-vercel-domain.app/ar?type=${type}&id=${targetId}`;
    
    const canOpen = await Linking.canOpenURL(vercelARUrl);
    if (canOpen) {
      await Linking.openURL(vercelARUrl);
    } else {
      Alert.alert('エラー', 'ブラウザを開くことができませんでした。');
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.btn, { backgroundColor: color }]} 
      onPress={handleLaunchAR}
      activeOpacity={0.8}
    >
      {type === 'ugc' ? <Box color="#FFF" size={20} style={styles.icon} /> : <ScanLine color="#FFF" size={20} style={styles.icon} />}
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { 
    flexDirection: 'row',
    paddingVertical: 16, 
    paddingHorizontal: 24,
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4
  },
  icon: {
    marginRight: 8
  },
  btnText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '900', 
    letterSpacing: 1 
  }
});
