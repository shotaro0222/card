import { Tabs } from 'expo-router';
import { Camera, Layers, MapPin, Bell, ShoppingBag, MessageCircle, Swords } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { 
        backgroundColor: '#FFFFFF', 
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        height: 65, // 高さを少し確保
        paddingBottom: 10,
        position: 'absolute', // コンテンツに押し出されないよう固定
      },
      tabBarActiveTintColor: '#3B82F6',
      tabBarInactiveTintColor: '#94A3B8',
      headerShown: true, // ヘッダーを出すことで枠組みを安定させる
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: '#FFFFFF' },
      headerTitleStyle: { fontWeight: '800', color: '#0F172A' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'カード生成', tabBarIcon: ({ color }) => <Camera color={color} size={24} /> }} />
      <Tabs.Screen name="deck" options={{ title: '図鑑', tabBarIcon: ({ color }) => <Layers color={color} size={24} /> }} />
      <Tabs.Screen name="battle" options={{ title: '冒険', tabBarIcon: ({ color }) => <MapPin color={color} size={24} /> }} />
      <Tabs.Screen name="arena" options={{ title: '闘技場', tabBarIcon: ({ color }) => <Swords color={color} size={24} /> }} />
      <Tabs.Screen name="events" options={{ title: 'お知らせ', tabBarIcon: ({ color }) => <Bell color={color} size={24} /> }} />
      <Tabs.Screen name="shop" options={{ title: 'ストア', tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} /> }} />
      <Tabs.Screen name="chat" options={{ title: '交換', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} /> }} />
    </Tabs>
  );
}