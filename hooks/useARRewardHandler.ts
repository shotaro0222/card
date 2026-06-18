import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase'; // ご自身のSupabaseクライアントパスに合わせる

export function useARRewardHandler(currentUserId: string | null) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rewardedCard, setRewardedCard] = useState<any>(null); // 獲得したカードデータを保持（UI表示用）

  useEffect(() => {
    // 💡 アプリ起動中およびバックグラウンドからの復帰時にURLを監視
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // 💡 アプリが完全に終了している状態からURLで起動された場合の初回チェック
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, [currentUserId]);

  const handleDeepLink = async (event: { url: string }) => {
    if (!currentUserId) return; // ログインしていない場合は処理しない（必要ならログイン画面へ誘導）

    try {
      const parsedUrl = Linking.parse(event.url);
      
      // カスタムスキームのパスが 'ar-reward' の場合のみ処理
      if (parsedUrl.path === 'ar-reward' || parsedUrl.hostname === 'ar-reward') {
        const promoId = parsedUrl.queryParams?.promo_id as string;
        const isWin = parsedUrl.queryParams?.is_win === 'true';

        if (promoId) {
          await processArReward(promoId, isWin);
        }
      }
    } catch (error) {
      console.error('URL解析エラー:', error);
    }
  };

  const processArReward = async (promoId: string, isWin: boolean) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // ==========================================
      // 1. 重複取得チェック (同日・同キャンペーンでの複数取得を防止)
      // ==========================================
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const { data: historyData } = await supabase
        .from('ar_reward_history')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('promo_id', promoId)
        .gte('created_at', `${today}T00:00:00Z`) // 今日の0時以降のデータを検索
        .single();

      if (historyData) {
        Alert.alert('お知らせ', 'この場所での本日の特典は既に受け取り済みです。また明日お越しください！');
        setIsProcessing(false);
        return;
      }

      // ==========================================
      // 2. キャンペーン情報とカードステータスの取得
      // ==========================================
      // ダッシュボードで設定した promo_links テーブルまたはシステム設定から取得
      // ※ここでは client_specific (個別店舗) の設定を取得する想定
      const { data: promoData, error: promoError } = await supabase
        .from('promo_links')
        .select('*')
        .eq('id', promoId)
        .single();

      if (promoError || !promoData) {
        throw new Error('対象のキャンペーン情報が見つかりません。');
      }

      // 当たり/ハズレに応じてステータスと画像を振り分け
      const targetStats = isWin ? promoData.ar_win_stats : promoData.ar_base_stats;
      const targetImageUrl = isWin ? promoData.ar_win_asset_url : promoData.ar_asset_url;

      if (!targetStats) {
        throw new Error('カードのステータス情報が設定されていません。');
      }

      // ==========================================
      // 3. ユーザーのインベントリにカードを付与 (INSERT)
      // ==========================================
      const newCardData = {
        player_id: currentUserId,
        card_name: targetStats.name || 'AR特典カード',
        image_url: targetImageUrl,
        rarity: targetStats.rarity || 'N',
        element: targetStats.element || '無',
        status_hp: targetStats.hp || 100,
        status_atk: targetStats.atk || 50,
        status_def: targetStats.def || 50,
        status_spd: targetStats.spd || 50,
        status_total: (targetStats.hp||100) + (targetStats.atk||50) + (targetStats.def||50) + (targetStats.spd||50),
        skill_name: 'ARスキャンボーナス',
        feature: 'AR報酬',
        is_active: true
      };

      const { data: insertedCard, error: insertError } = await supabase
        .from('cards')
        .insert([newCardData])
        .select()
        .single();

      if (insertError) throw insertError;

      // ==========================================
      // 4. 取得履歴を記録 (二重取り防止用)
      // ==========================================
      await supabase.from('ar_reward_history').insert([{
        user_id: currentUserId,
        promo_id: promoId,
        is_win: isWin,
        card_id: insertedCard.id
      }]);

      // 成功時の状態更新（UIで獲得モーダルを出すトリガーにする）
      setRewardedCard(insertedCard);
      Alert.alert('獲得成功！', `「${newCardData.card_name}」を獲得しました！デッキ編成から確認できます。`);

    } catch (error: any) {
      console.error(error);
      Alert.alert('エラー', '特典の受け取りに失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // UI側で「モーダルを閉じる」際に呼ぶ関数
  const clearRewardedCard = () => setRewardedCard(null);

  return { isProcessing, rewardedCard, clearRewardedCard };
}