import { Redirect } from 'expo-router';

export default function RootIndex() {
  // 起動した瞬間、強制的にタブレイアウトの「index(カード化)」へ飛ばす
  return <Redirect href="/(tabs)/" />;
}