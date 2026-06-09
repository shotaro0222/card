import { Tabs } from 'expo-router';
import { Camera, Layers, MapPin, Bell, ShoppingBag, MessageCircle } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { 
        backgroundColor: '#FFFFFF', 
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        elevation: 0, // Androidの影を消す
        height: 60,
        paddingBottom: 10,
      },
      tabBarActiveTintColor: '#3B82F6', // 親しみやすいブルー
      tabBarInactiveTintColor: '#94A3B8',
      headerStyle: { 
        backgroundColor: '#FFFFFF',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      },
      headerTitleStyle: {
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: 1,
      },
      headerTitleAlign: 'center',
    }}>
      {/* 誰もが分かる直感的なアイコンと名前に変更 */}
      <Tabs.Screen name="index" options={{ title: 'カード化', tabBarIcon: ({ color }) => <Camera color={color} size={24} /> }} />
      <Tabs.Screen name="deck" options={{ title: '図鑑', tabBarIcon: ({ color }) => <Layers color={color} size={24} /> }} />
      <Tabs.Screen name="battle" options={{ title: '冒険', tabBarIcon: ({ color }) => <MapPin color={color} size={24} /> }} />
      <Tabs.Screen name="events" options={{ title: 'お知らせ', tabBarIcon: ({ color }) => <Bell color={color} size={24} /> }} />
      <Tabs.Screen name="shop" options={{ title: 'ストア', tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} /> }} />
      <Tabs.Screen name="chat" options={{ title: '交換', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} /> }} />
    </Tabs>
  );
}
