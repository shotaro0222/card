import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Sparkles } from 'lucide-react-native'; // 💡 キラキラアイコンを使用

interface LogoProps {
  scale?: number;
  color?: string;
  bgColor?: string; // 枠の右上を透過させるための背景色
}

export default function SnapCardLogo({ scale = 1, color = '#0F172A', bgColor = '#F8FAFC' }: LogoProps) {
  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      {/* メインの枠と文字 */}
      <View style={[styles.box, { borderColor: color }]}>
        <Text style={[styles.text, { color }]}>SNAP</Text>
        <Text style={[styles.text, { color }]}>CARD</Text>
      </View>
      
      {/* 右上のキラキラ装飾（枠線を隠すためにbgColorを敷く） */}
      <View style={[styles.sparkleContainer, { backgroundColor: bgColor }]}>
        <Sparkles size={24} color={color} strokeWidth={2.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: 150,
    height: 90,
    alignSelf: 'center',
  },
  box: {
    borderWidth: 3,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  text: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6, // 💡 SNAP CARDの文字間隔を広げてロゴっぽく
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed',
  },
  sparkleContainer: {
    position: 'absolute',
    top: -12,
    right: -12,
    padding: 4,
  }
});
