import { Tabs } from 'expo-router';
import { Camera, Layers, MapPin, Bell, ShoppingBag, MessageCircle } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { 
        backgroundColor: '#0B1220',
        borderTopWidth: 1,
        borderTopColor: '#263449',
        height: 72,
        paddingTop: 7,
        paddingBottom: 8,
        position: 'absolute', // コンテンツに押し出されないよう固定
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
      },
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '800',
      },
      tabBarItemStyle: {
        padding: 0, // アイテム間の余白を極力減らしてテキスト表示領域を広げる
      },
      tabBarActiveTintColor: '#FBBF24',
      tabBarInactiveTintColor: '#64748B',
      headerShown: true, // ヘッダーを出すことで枠組みを安定させる
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: '#0B1220' },
      headerTintColor: '#F8FAFC',
      headerTitleStyle: { fontWeight: '900', color: '#F8FAFC', letterSpacing: 0.5 },
    }}>
      {/* 「カード生成」を「カード」に変更して文字切れを防止 */}
      <Tabs.Screen name="index" options={{ title: 'カード', tabBarIcon: ({ color }) => <Camera color={color} size={24} /> }} />
      <Tabs.Screen name="deck" options={{ title: '図鑑', tabBarIcon: ({ color }) => <Layers color={color} size={24} /> }} />
      <Tabs.Screen name="battle" options={{ title: '冒険', tabBarIcon: ({ color }) => <MapPin color={color} size={24} /> }} />
      <Tabs.Screen name="arena" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ title: 'お知らせ', tabBarIcon: ({ color }) => <Bell color={color} size={24} /> }} />
      <Tabs.Screen name="shop" options={{ title: 'ストア', tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} /> }} />
      <Tabs.Screen name="chat" options={{ title: '交換', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} /> }} />
    </Tabs>
  );
}