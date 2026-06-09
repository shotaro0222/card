import { Tabs } from 'expo-router';
import { Home, Layers, Swords, Bell, ShoppingCart } from 'lucide-react-native'; // ShoppingCartを追加

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
      {/* SHOPタブを追加 */}
      <Tabs.Screen name="shop" options={{ title: 'SHOP', tabBarIcon: ({ color }) => <ShoppingCart color={color} /> }} />
    </Tabs>
  );
}
