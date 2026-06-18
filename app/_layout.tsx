import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Alert, Modal, View, Text, Image, Button, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase'; // ※パスは環境に合わせて調整してください
import { useARRewardHandler } from '../hooks/useARRewardHandler'; // 💡 作成したフックをインポート

export default function RootLayout() {
  const router = useRouter();
  
  // 💡 フックに渡すために現在のログインユーザーIDを保持するステート
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 初回レンダリング時と認証状態の変更時にユーザーIDを取得・更新
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user.id || null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id || null);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 💡 AR報酬受け取りフックの呼び出し
  const { isProcessing, rewardedCard, clearRewardedCard } = useARRewardHandler(currentUserId);

  useEffect(() => {
    // ディープリンクのシグナルを検知・処理するハンドラー
    const handleIncomingURL = async (event: Linking.EventType) => {
      if (!event.url) return;

      const parsed = Linking.parse(event.url);
      const { path, queryParams } = parsed;

      // ========================================================
      // 1. アイデア1: プロモカードをインベントリに自動格納 (既存コード)
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
      // 2. アイデア2: ARで確認後、レイドバトルへ直行 (既存コード)
      // ========================================================
      else if (path === 'start-battle' && queryParams?.boss_id) {
        Alert.alert('💥 戦闘開始', '現実世界からボスデータを走査。迎撃体勢に入ります！');
        // 例: バトル画面へ遷移
        router.push(`/battle/${queryParams.boss_id}`);
      }

      // ========================================================
      // 3. アイデア3: AR物撮りから戻ってきてSNSシェアをトリガー (既存コード)
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
  }, [router]);

  return (
    <>
      {/* 既存の画面遷移設定 */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin/dashboard" />
      </Stack>

      {/* 🎁 獲得モーダル（画面の最前面に表示されるように Stack の下に配置） */}
      {rewardedCard && (
        <Modal transparent={true} animationType="fade" visible={!!rewardedCard}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🎉 カードをGETしました！</Text>
              
              <Image 
                source={{ uri: rewardedCard.image_url }} 
                style={styles.cardImage} 
                resizeMode="contain"
              />
              
              <Text style={styles.cardName}>{rewardedCard.card_name}</Text>
              <Text style={styles.cardMeta}>属性: {rewardedCard.element} / レア: {rewardedCard.rarity}</Text>

              <View style={styles.closeBtn}>
                <Button title="閉じる" onPress={clearRewardedCard} color="#0ea5e9" />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// 💡 モーダル用の簡単なスタイル
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#0f172a',
  },
  cardImage: {
    width: 200,
    height: 280,
    marginBottom: 20,
    borderRadius: 12,
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  cardMeta: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 8,
    marginBottom: 24,
  },
  closeBtn: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  }
});