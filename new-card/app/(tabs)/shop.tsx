import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';

// 💡 将来RevenueCatを導入したらコメントアウトを外す
// import Purchases from 'react-native-purchases';

/**
 * 💡 課金有効化フラグ
 * ストア登録が終わるまでは false (モック動作) にしておく。
 * true にすると、実際に RevenueCat 経由で Apple/Google の決済画面が呼ばれるようになる。
 */
const ENABLE_IN_APP_PURCHASE = false;

/**
 * 💡 ストアに登録するプロダクトIDの定義
 * Apple/Googleそれぞれのストアで登録するアイテムのID。
 */
const STORE_PRODUCT_IDS = {
  premium: 'sub_premium_monthly_500', // 例: プレミアムパスのID
  tickets_10: 'cons_tickets_10_100',  // 例: チケット10枚のID
};

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState(0);
  const [packs, setPacks] = useState<any[]>([]);

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles')
      .select('is_premium, forge_tickets, is_admin')
      .eq('id', user.id)
      .single();

    if (profile) {
      setIsAdmin(profile.is_admin || false);
      setIsPremium(profile.is_premium || profile.is_admin); 
      setTickets(profile.forge_tickets || 0);
    }

    const { data: packData } = await supabase.from('card_packs').select('*').eq('is_active', true);
    if (packData) setPacks(packData);
    
    setLoading(false);
  };

  // 👑 プレミアムパス購入フロー
  const buyPremium = async () => {
    if (isAdmin) {
      Alert.alert('ゴッドモード', 'ブラザーは既に全知全能の管理者だ！プレミアム機能は永久解放されているぜ！');
      return;
    }

    Alert.alert("購入確認", "プレミアムパス(￥500/月)を契約しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "購入", onPress: async () => {
          setLoading(true);
          try {
            // 💰 【本番決済フロー】
            if (ENABLE_IN_APP_PURCHASE && !isAdmin) {
              // const { customerInfo } = await Purchases.purchaseProduct(STORE_PRODUCT_IDS.premium);
              // if (typeof customerInfo.entitlements.active['premium'] === "undefined") {
              //   throw new Error("サブスクリプションの有効化が確認できませんでした");
              // }
              console.log("RevenueCat: プレミアムパス決済成功");
            }

            // 💾 【DB更新フロー】決済が成功した（またはモック）場合のみここが実行される
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
              setIsPremium(true);
              Alert.alert('契約完了', 'プレミアム機能が解放されました！');
            }
          } catch (error: any) {
            // ユーザーが決済画面でキャンセルした場合はエラーメッセージを出さない
            if (!error.userCancelled) {
              Alert.alert('決済エラー', '購入処理中にエラーが発生しました。');
              console.error("Purchase error:", error);
            }
          } finally {
            setLoading(false);
          }
      }}
    ]);
  };

  // 🎟️ 錬成チケット購入フロー
  const buyTickets = async () => {
    const title = isAdmin ? "【無料】チケット追加" : "購入確認";
    const msg = isAdmin ? "ゴッドモード権限でチケット10枚を無料で追加するぜ！" : "チケット10枚(￥100)を購入しますか？";

    Alert.alert(title, msg, [
      { text: "キャンセル", style: "cancel" },
      { text: isAdmin ? "追加" : "購入", onPress: async () => {
          setLoading(true);
          try {
            // 💰 【本番決済フロー】
            if (ENABLE_IN_APP_PURCHASE && !isAdmin) {
              // await Purchases.purchaseProduct(STORE_PRODUCT_IDS.tickets_10);
              console.log("RevenueCat: チケット決済成功");
            }

            // 💾 【DB更新フロー】
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const newAmount = tickets + 10;
              await supabase.from('profiles').update({ forge_tickets: newAmount }).eq('id', user.id);
              setTickets(newAmount);
              Alert.alert('完了', 'チケットが追加されました！');
            }
          } catch (error: any) {
            if (!error.userCancelled) {
              Alert.alert('決済エラー', '購入処理中にエラーが発生しました。');
            }
          } finally {
            setLoading(false);
          }
      }}
    ]);
  };

  // 📦 パック購入フロー
  const buyPack = async (pack: any) => {
    const title = isAdmin ? "【無料】パック入手" : "パック購入確認";
    const msg = isAdmin ? `ゴッドモード権限で「${pack.title}」を無料でゲットするぜ！` : `「${pack.title}」(￥${pack.price_jpy}) を購入しますか？`;

    Alert.alert(title, msg, [
      { text: "キャンセル", style: "cancel" },
      { text: isAdmin ? "入手" : "購入", onPress: async () => {
          setLoading(true);
          try {
            // 💰 【本番決済フロー】
            if (ENABLE_IN_APP_PURCHASE && !isAdmin) {
              // パックごとにストアIDが異なるため、DBに保存された store_product_id を使う想定
              // const storeProductId = pack.store_product_id;
              // await Purchases.purchaseProduct(storeProductId);
              console.log(`RevenueCat: パック(${pack.title})決済成功`);
            }

            // 💾 【DB更新フロー】
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newCards = pack.contents.map((cardData: any) => ({
              player_id: user.id,
              card_name: cardData.name,
              image_url: pack.image_url || 'https://via.placeholder.com/400x400/1e293b/f87171?text=SECRET', 
              feature: cardData.feature,
              skill_name: cardData.skill,
              status_hp: cardData.hp,
              status_atk: cardData.atk,
              status_def: cardData.def,
              status_spd: cardData.spd,
              status_total: cardData.hp + cardData.atk + cardData.def + cardData.spd,
              rarity: cardData.rarity || 'P',
              card_type: 'influencer',
              is_active: false
            }));

            const { error } = await supabase.from('cards').insert(newCards);
            
            if (error) throw error;
            
            Alert.alert('獲得完了！', `パックを開封し、${newCards.length}枚のカードをDECKに追加したぞ！`);
          } catch (error: any) {
            if (!error.userCancelled) {
              Alert.alert('エラー', '購入またはカードの付与に失敗しました。');
              console.error(error);
            }
          } finally {
            setLoading(false);
          }
      }}
    ]);
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#f59e0b" style={{marginTop: 50}} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <Text style={styles.header}>SHOP</Text>

      {isAdmin && (
        <View style={styles.adminBanner}>
          <Text style={styles.adminBannerText}>👑 ゴッドモード発動中: 全アイテム無料獲得可能</Text>
        </View>
      )}
      
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productTitle}>👑 プレミアムパス</Text>
          <Text style={styles.price}>{isAdmin ? '永久無料' : '￥500 / 月'}</Text>
        </View>
        <Text style={styles.desc}>・1日の錬成回数が【無制限】に！</Text>
        <Text style={styles.desc}>・カードに【好きな名前】を指定可能！</Text>
        {isPremium ? (
          <View style={styles.ownedBadge}><Text style={styles.ownedText}>{isAdmin ? '管理者権限で適用中' : '契約中'}</Text></View>
        ) : (
          <TouchableOpacity style={styles.buyBtn} onPress={buyPremium}>
            <Text style={styles.buyBtnText}>契約する</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productTitle}>🎟️ 錬成チケット x10</Text>
          <Text style={styles.price}>{isAdmin ? '￥0 (God Mode)' : '￥100'}</Text>
        </View>
        <Text style={styles.desc}>・現在の所持数: {tickets}枚</Text>
        <TouchableOpacity style={[styles.buyBtn, { backgroundColor: isAdmin ? '#854D0E' : '#3b82f6' }]} onPress={buyTickets}>
          <Text style={styles.buyBtnText}>{isAdmin ? '無料で追加' : '購入する'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.header, { marginTop: 20, fontSize: 18, color: '#c084fc' }]}>INFLUENCER PACKS</Text>
      
      {packs.map(pack => (
        <View key={pack.id} style={[styles.productCard, { borderColor: '#c084fc' }]}>
          <View style={styles.productHeader}>
            <Text style={[styles.productTitle, { color: '#c084fc', flex: 1 }]} numberOfLines={1}>📦 {pack.title}</Text>
            <Text style={styles.price}>{isAdmin ? '￥0 (God Mode)' : `￥${pack.price_jpy}`}</Text>
          </View>
          <Text style={[styles.desc, { color: '#e2e8f0', fontWeight: 'bold' }]}>by {pack.influencer_name}</Text>
          <Text style={styles.desc}>{pack.description}</Text>
          <TouchableOpacity style={[styles.buyBtn, { backgroundColor: isAdmin ? '#854D0E' : '#c084fc' }]} onPress={() => buyPack(pack)}>
            <Text style={styles.buyBtnText}>{isAdmin ? '無料でゲット' : 'パックを購入する'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  header: { fontSize: 24, fontWeight: '900', color: '#f59e0b', marginBottom: 20, marginTop: 40, letterSpacing: 2 },
  adminBanner: { backgroundColor: '#FEF08A', padding: 12, borderRadius: 8, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#EAB308' },
  adminBannerText: { color: '#854D0E', fontWeight: 'bold', fontSize: 14 },
  productCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  productTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b', marginLeft: 10 },
  desc: { color: '#94a3b8', fontSize: 13, marginBottom: 8, lineHeight: 20 },
  buyBtn: { backgroundColor: '#f59e0b', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buyBtnText: { color: '#020617', fontWeight: 'bold', fontSize: 16 },
  ownedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#10b981' },
  ownedText: { color: '#10b981', fontWeight: 'bold' }
});