import { Redirect } from 'expo-router';

export default function Index() {
  // アプリ起動時に強制的にタブレイアウト( /(tabs) )へ遷移させる
  return <Redirect href="/(tabs)" />;
}