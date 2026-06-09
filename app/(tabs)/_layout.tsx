import { Tabs } from 'expo-router';
import { Home, Layers, Swords, Bell, ShoppingCart, MessageSquare } from 'lucide-react-native'; // MessageSquareを追加

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#020617', borderTopColor: '#334155' },
      tabBarActiveTintColor: '#f87171',
      tabBarInactiveTintColor: '#64748b',
      headerStyle: { backgroundColor: '#020617' },
      headerTintColor: '#f87171',
    }}>
      <Tabs.Screen name="index" options={{ title: 'FORGE', tabBarIcon: ({ color }) => <Home color={color} /> }} />
      <Tabs.Screen name="deck" options={{ title: 'DECK', tabBarIcon: ({ color }) => <Layers color={color} /> }} />
      <Tabs.Screen name="battle" options={{ title: 'ARENA', tabBarIcon: ({ color }) => <Swords color={color} /> }} />
      <Tabs.Screen name="events" options={{ title: 'EVENTS', tabBarIcon: ({ color }) => <Bell color={color} /> }} />
      <Tabs.Screen name="shop" options={{ title: 'SHOP', tabBarIcon: ({ color }) => <ShoppingCart color={color} /> }} />
      {/* チャット・トレードタブを追加 */}
      <Tabs.Screen name="chat" options={{ title: 'TRADE', tabBarIcon: ({ color }) => <MessageSquare color={color} /> }} />
    </Tabs>
  );
}
