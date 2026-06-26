import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase'; // ご自身のSupabaseクライアントパスに合わせる

export function useARRewardHandler(currentUserId: string | null) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rewardedCard, setRewardedCard] = useState<any>(null); // 獲得した報酬データ（プレビュー用）を保持
  const [encounteredBoss, setEncounteredBoss] = useState<any>(null); // 遭遇したボスデータを保持

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => {
      subscription.remove();
    };
  }, [currentUserId]);

  const handleDeepLink = async (event: { url: string }) => {
    if (!currentUserId) return;

    try {
      const parsedUrl = Linking.parse(event.url);
      
      if (parsedUrl.path === 'ar-reward' || parsedUrl.hostname === 'ar-reward') {
        const promoId = parsedUrl.queryParams?.promo_id as string;
        // ⚠️ セキュリティ対策: URLから is_win は受け取らない

        if (promoId) {
          await processArReward(promoId);
        }
      }
    } catch (error) {
      console.error('URL解析エラー:', error);
    }
  };

  const processArReward = async (promoId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // ==========================================
      // 1. キャンペーン情報の取得と検証
      // ==========================================
      const { data: promoData, error: promoError } = await supabase
        .from('promo_links')
        .select('*')
        .eq('id', promoId)
        .single();

      if (promoError || !promoData) {
        throw new Error('対象のキャンペーン情報が見つかりません。');
      }

      // 🕒 期間チェックの追加
      const now = new Date();
      const startDate = new Date(promoData.start_date);
      const endDate = new Date(promoData.end_date);
      
      if (now < startDate || now > endDate) {
        Alert.alert('お知らせ', 'このキャンペーンは期間外です。');
        return;
      }

      // ==========================================
      // 2. 重複取得チェック
      // ==========================================
      const today = new Date().toISOString().split('T')[0];
      const { data: historyData } = await supabase
        .from('ar_reward_history')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('promo_id', promoId)
        .gte('created_at', `${today}T00:00:00Z`)
        .single();

      if (historyData) {
        Alert.alert('お知らせ', '本日の特典は既に受け取り済みです。また明日お越しください！');
        return;
      }

      // ==========================================
      // 3. 報酬タイプに応じた処理の分岐
      // ==========================================
      // 管理画面で設定した報酬タイプ ('card' or 'boss' を想定)
      const rewardType = promoData.reward_type || 'card';

      if (rewardType === 'boss') {
        // 😈 ボスバトルの処理
        // ボスの情報をセットし、UI側でバトル画面への遷移を促す
        setEncounteredBoss({
          bossId: promoData.boss_id,
          bossName: promoData.boss_name,
          // その他バトルに必要なデータ
        });
        
        // 履歴を記録
        await supabase.from('ar_reward_history').insert([{
          user_id: currentUserId,
          promo_id: promoId,
          is_win: true, // ボス遭遇フラグとして利用
          reward_type: 'boss'
        }]);

      } else {
        // 🎴 カード付与の処理（rewardsテーブルへ送る）
        // 🎲 ここでアプリ側で確率計算を行う (不正防止)
        // 例: promoData.win_rate が 0.1 の場合、10%の確率で当たり
        const winRate = promoData.win_rate || 0.5; // 設定がない場合は50%とする等
        const isWin = Math.random() < winRate;

        const targetStats = isWin ? promoData.ar_win_stats : promoData.ar_base_stats;
        const targetImageUrl = isWin ? promoData.ar_win_asset_url : promoData.ar_asset_url;

        if (!targetStats) throw new Error('カードのステータス情報が設定されていません。');

        const cardName = targetStats.name || 'AR特典カード';
        const hp = targetStats.hp || 10;
        const atk = targetStats.atk || 10;
        const def = targetStats.def || 10;
        const spd = targetStats.spd || 10;
        const total = hp + atk + def + spd;

        // rewardsテーブルへ挿入するデータ
        const rewardData = {
          player_id: currentUserId,
          title: `🎁 AR特典報酬: ${cardName}`,
          description: isWin ? 'ARスキャン大当たりの報酬です！' : 'ARスキャンの参加報酬です！',
          reward_type: 'card',
          reward_data: {
            card_name: cardName,
            image_url: targetImageUrl,
            status_total: total,
            status_hp: hp,
            status_atk: atk,
            status_def: def,
            status_spd: spd,
            rarity: targetStats.rarity || 'N',
            element: targetStats.element || '無',
            is_fixed: true // ARキャンペーン報酬なので基本は固定カード扱い
          },
          is_claimed: false
        };

        const { error: insertError } = await supabase
          .from('rewards')
          .insert([rewardData]);

        if (insertError) throw insertError;

        // 履歴を記録（rewardsに入れたのでcard_idは不要、記録用データのみ）
        await supabase.from('ar_reward_history').insert([{
          user_id: currentUserId,
          promo_id: promoId,
          is_win: isWin,
          reward_type: 'card'
        }]);

        // UI表示用に報酬のカードデータをセット
        setRewardedCard(rewardData.reward_data);
        
        // 当たりハズレでメッセージを変える
        const message = isWin 
          ? '大当たり！レアカードが報酬ボックスに送られました！' 
          : 'ノーマルカードが報酬ボックスに送られました！';
        Alert.alert('獲得成功！', message);
      }

    } catch (error: any) {
      console.error(error);
      Alert.alert('エラー', error.message || '処理に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearRewardedCard = () => setRewardedCard(null);
  const clearEncounteredBoss = () => setEncounteredBoss(null);

  return { 
    isProcessing, 
    rewardedCard, 
    clearRewardedCard,
    encounteredBoss,
    clearEncounteredBoss
  };
}