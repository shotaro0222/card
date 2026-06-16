import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // ※パスは環境に合わせて調整してください

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // ディープリンクのシグナルを検知・処理するハンドラー
    const handleIncomingURL = async (event: Linking.EventType) => {
      if (!event.url) return;

      const parsed = Linking.parse(event.url);
      const { path, queryParams } = parsed;

      // ========================================================
      // 1. アイデア1: プロモカードをインベントリに自動格納
      // ========================================================
      if (path === 'claim-promo' && queryParams?.promo_id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            Alert.alert('未ログイン', 'カードを受け取るにはログイン、または新規登録が必要です。');
            router.replace('/login');
            return;
          }

          const { data: promo } = await supabase
            .from('promo_links')
            .select('*, fixed_cards(*)')
            .eq('id', queryParams.promo_id)
            .single();

          if (!promo || !promo.fixed_cards) throw new Error('無効なプロファイルコードです。');

          const { error: insertErr } = await supabase.from('cards').insert([{
            player_id: user.id,
            card_name: `【限定】${promo.fixed_cards.card_name}`,
            image_url: promo.fixed_cards.image_url,
            feature: `${promo.corporate_name} コラボ限定アセット。`,
            skill_name: promo.fixed_cards.stats?.skill_name || 'タイアップバースト',
            status_hp: promo.fixed_cards.stats?.hp || 120,
            status_atk: promo.fixed_cards.stats?.atk || 60,
            status_def: promo.fixed_cards.stats?.def || 60,
            status_spd: promo.fixed_cards.stats?.spd || 60,
            status_total: 300,
            rarity: 'SSR',
            element: '光',
            is_active: true
          }]);

          if (insertErr) throw insertErr;

          Alert.alert('🎉 特典獲得！', `「${promo.fixed_cards.card_name}」をデッキへ格納しました！`);
          router.replace('/(tabs)');
        } catch (err: any) {
          Alert.alert('転送エラー', err.message);
        }
      }

      // ========================================================
      // 2. アイデア2: ARで確認後、レイドバトルへ直行
      // ========================================================
      else if (path === 'start-battle' && queryParams?.boss_id) {
        Alert.alert('💥 戦闘開始', '現実世界からボスデータを走査。迎撃体勢に入ります！');
        // 例: バトル画面へ遷移
        router.push(`/battle/${queryParams.boss_id}`);
      }

      // ========================================================
      // 3. アイデア3: AR物撮りから戻ってきてSNSシェアをトリガー
      // ========================================================
      else if (path === 'share-back' && queryParams?.card_id) {
        Alert.alert('📸 撮影完了', 'ハッシュタグを生成してSNSへシェアしますか？', [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: 'シェアする', 
            onPress: () => {
              // 例: SNS連携用の画面やネイティブのShareを呼び出す処理
              console.log('SNS Share triggered for card:', queryParams.card_id);
            }
          }
        ]);
      }
    };

    // イベントリスナーの登録（起動中・バックグラウンド復帰の両方を監視）
    const subscription = Linking.addEventListener('url', handleIncomingURL);

    // アプリが完全に閉じている状態からURLで起動された場合
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingURL({ url });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ご提示いただいた元コード
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin/dashboard" />
    </Stack>
  );
}
