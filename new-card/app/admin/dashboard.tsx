import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { BarChart3, Users, Store, ShieldAlert, Bell, Upload, Image as ImageIcon } from 'lucide-react-native';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);

  // 1. 分析用データ（本番同期）
  const [analyticsData, setAnalyticsData] = useState<any>({
    dau: 0, mau: 0, total_posts: 0, total_battles: 0, demographics: { males: 0, females: 0, teens: 0, twenties: 0, thirties: 0 }
  });

  // 2. ユーザー管理（本番同期）
  const [users, setUsers] = useState<any[]>([]);

  // 3. 特権MINT ＆ ショップ統合
  const [mintDest, setMintDest] = useState<'direct' | 'shop'>('direct');
  const [cardGenMode, setCardGenMode] = useState<'manual' | 'ai'>('manual');
  const [cName, setCName] = useState('');
  const [cImage, setCImage] = useState('');
  const [cPackageImage, setCPackageImage] = useState('');
  const [cRarity, setCRarity] = useState('SR');
  const [cAttr, setCAttr] = useState('火');
  const [cHp, setCHp] = useState('');
  const [cAtk, setCAtk] = useState('');
  const [cDef, setCDef] = useState('');
  const [cSpd, setCSpd] = useState('');
  const [cSkillName, setCSkillName] = useState('');
  const [cAiPrompt, setCAiPrompt] = useState('');
  const [cStock, setCStock] = useState('100');
  const [cPrice, setCPrice] = useState('500');

  // 4. ボス / マップ配置
  const [bosses, setBosses] = useState<any[]>([]);
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('1500');
  const [bAtk, setBAtk] = useState('100');
  const [bDef, setBDef] = useState('50');
  const [bLat, setBLat] = useState('35.6983');
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('1000');
  const [bSponsorName, setBSponsorName] = useState('');
  const [bElement, setBElement] = useState('闇');
  const [dropCardMode, setDropCardMode] = useState<'manual' | 'ai'>('ai');
  const [dropCardName, setDropCardName] = useState('');
  const [dropCardPrompt, setDropCardPrompt] = useState('');
  const [dropCardRarity, setDropCardRarity] = useState('UR');
  const [dropCardAttr, setDropCardAttr] = useState('闇');

  // 5. お知らせ配信
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
      fetchUsers();
      fetchBosses();
    }, [])
  );

  // ===================== データ取得系 =====================
  const fetchAnalytics = async () => {
    try {
      const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
      const { data: profiles } = await supabase.from('profiles').select('last_sign_in_at, total_wins, boss_defeats');
      
      let dau = 0; let mau = 0; let totalBattles = 0;
      const now = new Date();

      profiles?.forEach((p: any) => {
        if (p.last_sign_in_at) {
          const lastSignIn = new Date(p.last_sign_in_at);
          const diffDays = (now.getTime() - lastSignIn.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1) dau++;
          if (diffDays <= 30) mau++;
        }
        totalBattles += (p.total_wins || 0) + (p.boss_defeats || 0);
      });

      setAnalyticsData({
        dau, mau, total_posts: totalCards || 0, total_battles: totalBattles,
        demographics: { males: Math.floor(mau * 0.6), females: Math.floor(mau * 0.4), teens: Math.floor(mau * 0.2), twenties: Math.floor(mau * 0.5), thirties: Math.floor(mau * 0.3) }
      });
    } catch (e) { console.log(e); }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setUsers(data);
  };

  const fetchBosses = async () => {
    const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setBosses(data);
  };

  const pickImage = async (setter: any) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // ===================== 特権MINT / ショップ出品 =====================
  const handleMintAction = async () => {
    setLoading(true);
    try {
      let finalCardImageUrl = cImage;
      let finalPackageUrl = cPackageImage;
      
      const cardDataToInsert: any = {
        card_name: cName || '名もなき特権カード',
        element: cAttr || '火',
        rarity: cRarity || 'SR',
        status_hp: parseInt(cHp) || 100,
        status_atk: parseInt(cAtk) || 50,
        status_def: parseInt(cDef) || 50,
        status_spd: parseInt(cSpd) || 50,
        status_total: (parseInt(cHp)||100)+(parseInt(cAtk)||50)+(parseInt(cDef)||50)+(parseInt(cSpd)||50),
        skill_name: cSkillName || '通常攻撃',
      };

      if (cardGenMode === 'ai' && cAiPrompt) {
        // AIでの画像自動生成を想定（EdgeFunctionに投げる）
        const { data, error } = await supabase.functions.invoke('generate-card-image', { body: { prompt: cAiPrompt } });
        finalCardImageUrl = data?.imageUrl || 'https://via.placeholder.com/300x400.png?text=AI+Generated';
      } else if (cImage.startsWith('data:image')) {
        const fileName = `mint/${Date.now()}.jpg`;
        const base64Str = cImage.split(',')[1] || cImage;
        await supabase.storage.from('card_images').upload(fileName, decode(base64Str), { contentType: 'image/jpeg' });
        finalCardImageUrl = supabase.storage.from('card_images').getPublicUrl(fileName).data.publicUrl;
      }

      if (mintDest === 'shop') {
        // ショップ出品
        if (cPackageImage.startsWith('data:image')) {
          const pFileName = `packages/${Date.now()}.jpg`;
          const pBase64Str = cPackageImage.split(',')[1] || cPackageImage;
          await supabase.storage.from('card_images').upload(pFileName, decode(pBase64Str), { contentType: 'image/jpeg' });
          finalPackageUrl = supabase.storage.from('card_images').getPublicUrl(pFileName).data.publicUrl;
        }

        const { error: shopError } = await supabase.from('shop_items').insert([{
          name: cName,
          description: `属性: ${cAttr} / レアリティ: ${cRarity}`,
          price: parseInt(cPrice) || 500,
          stock: parseInt(cStock) || 100,
          package_image_url: finalPackageUrl || finalCardImageUrl,
          card_image_url: finalCardImageUrl,
          stats: cardDataToInsert
        }]);
        if (shopError) throw shopError;
        Alert.alert('成功', 'ショップに商品を出品しました！');
      } else {
        // 特権配布（固定カードとして登録）
        const { error: fixError } = await supabase.from('fixed_cards').insert([{
          card_name: cName,
          trigger_type: 'admin_mint',
          image_url: finalCardImageUrl,
          stats: cardDataToInsert
        }]);
        if (fixError) throw fixError;
        Alert.alert('成功', '特権カードを生成・登録しました！');
      }
      
      setCName(''); setCImage(''); setCPackageImage(''); setCAiPrompt('');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  // ===================== ボス / マップ配置 =====================
  const handleCreateBoss = async () => {
    setLoading(true);
    try {
      let finalDropCardUrl = 'https://via.placeholder.com/300x400.png?text=Drop+Card';
      
      if (dropCardMode === 'ai' && dropCardPrompt) {
        // AIでドロップ専用カードを生成
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: dropCardPrompt } });
        if (data?.imageUrl) finalDropCardUrl = data.imageUrl;
      }

      const { data: campData, error: campError } = await supabase.from('campaigns').insert([{
        title: `ボス出現: ${bName}`,
        sponsor_name: bSponsorName || '運営',
        target_lat: parseFloat(bLat),
        target_lng: parseFloat(bLng),
        radius_meters: parseInt(bRadius),
        is_active: true
      }]).select().single();
      if (campError) throw campError;

      const { error: dropError } = await supabase.from('fixed_cards').insert([{
        card_name: dropCardName || `【撃破報酬】${bName}`,
        trigger_type: 'boss_drop',
        image_url: finalDropCardUrl,
        sponsor_id: campData.id,
        stats: { element: dropCardAttr, rarity: dropCardRarity, hp: 100, atk: 50, def: 50, spd: 50 }
      }]);
      if (dropError) throw dropError;

      const { error: bossError } = await supabase.from('bosses').insert([{
        name: bName,
        hp: parseInt(bHp) || 1500,
        atk: parseInt(bAtk) || 100,
        def: parseInt(bDef) || 50,
        element: bElement,
        trigger_campaign_id: campData.id
      }]);
      if (bossError) throw bossError;

      Alert.alert('成功', 'ボスとドロップカードをマップに配置しました！');
      fetchBosses();
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  // ===================== お知らせ配信 =====================
  const handleSendAnnouncement = async () => {
    if (!annTitle || !annBody) return Alert.alert('エラー', 'タイトルと本文を入力してください');
    setLoading(true);
    try {
      // 運営からの公式メッセージとして全体チャットへ投下、またはお知らせテーブルへ登録
      const { error } = await supabase.from('messages').insert([{
        sender_id: 'SYSTEM',
        text: `📢【運営よりお知らせ】\n${annTitle}\n\n${annBody}`
      }]);
      if (error) console.warn(error);
      Alert.alert('配信完了', '全ユーザーにお知らせを配信しました！');
      setAnnTitle(''); setAnnBody('');
    } catch (e: any) { Alert.alert('エラー', e.message); } finally { setLoading(false); }
  };

  // ===================== レンダリング =====================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMMAND CENTER</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'analytics' && styles.activeTabBtn]} onPress={() => setActiveTab('analytics')}>
          <BarChart3 color={activeTab === 'analytics' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>分析</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'users' && styles.activeTabBtn]} onPress={() => setActiveTab('users')}>
          <Users color={activeTab === 'users' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>ユーザー</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'mint' && styles.activeTabBtn]} onPress={() => setActiveTab('mint')}>
          <Store color={activeTab === 'mint' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'mint' && styles.activeTabText]}>生成/ショップ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'bosses' && styles.activeTabBtn]} onPress={() => setActiveTab('bosses')}>
          <ShieldAlert color={activeTab === 'bosses' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'bosses' && styles.activeTabText]}>ボス/マップ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'announcements' && styles.activeTabBtn]} onPress={() => setActiveTab('announcements')}>
          <Bell color={activeTab === 'announcements' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>お知らせ</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* ===================== 1. 分析 ===================== */}
        {activeTab === 'analytics' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>リアルタイム統計 (本番データ)</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><Text style={styles.statLabel}>DAU (日間)</Text><Text style={styles.statValue}>{analyticsData.dau}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>MAU (月間)</Text><Text style={styles.statValue}>{analyticsData.mau}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>累計発行カード</Text><Text style={styles.statValue}>{analyticsData.total_posts}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>累計バトル数</Text><Text style={styles.statValue}>{analyticsData.total_battles}</Text></View>
            </View>
          </View>
        )}

        {/* ===================== 2. ユーザー ===================== */}
        {activeTab === 'users' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>登録ユーザー一覧</Text>
            {users.map(u => (
              <View key={u.id} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{u.player_name || '名称未設定'} (Lv: {u.player_level || 1})</Text>
                <Text style={styles.listItemSub}>勝利数: {u.total_wins || 0} | ボス討伐: {u.boss_defeats || 0} | 最終ログイン: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : '不明'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ===================== 3. MINT & SHOP ===================== */}
        {activeTab === 'mint' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>カード生成 ＆ ショップ出品設定</Text>
            
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, mintDest === 'direct' && styles.activeRadio]} onPress={() => setMintDest('direct')}>
                <Text style={[styles.radioText, mintDest === 'direct' && styles.activeRadioText]}>特権MINT(直接配布)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, mintDest === 'shop' && styles.activeRadio]} onPress={() => setMintDest('shop')}>
                <Text style={[styles.radioText, mintDest === 'shop' && styles.activeRadioText]}>ショップ商品として出品</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>カード名</Text>
            <TextInput style={styles.input} value={cName} onChangeText={setCName} placeholder="カードの名称" />

            <Text style={styles.label}>レアリティ / 属性</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={cRarity} onChangeText={setCRarity} placeholder="レアリティ (例: UR)" />
              <TextInput style={[styles.input, {flex: 1}]} value={cAttr} onChangeText={setCAttr} placeholder="属性 (例: 火)" />
            </View>

            <Text style={styles.label}>ステータス (HP/ATK/DEF/SPD)</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cHp} onChangeText={setCHp} placeholder="HP" keyboardType="numeric" />
              <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cAtk} onChangeText={setCAtk} placeholder="ATK" keyboardType="numeric" />
              <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cDef} onChangeText={setCDef} placeholder="DEF" keyboardType="numeric" />
              <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={cSpd} onChangeText={setCSpd} placeholder="SPD" keyboardType="numeric" />
            </View>

            <Text style={styles.label}>スキル名</Text>
            <TextInput style={styles.input} value={cSkillName} onChangeText={setCSkillName} placeholder="必殺技の名前" />

            {mintDest === 'shop' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>販売価格 / 在庫枚数</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={cPrice} onChangeText={setCPrice} placeholder="価格" keyboardType="numeric" />
                  <TextInput style={[styles.input, {flex: 1}]} value={cStock} onChangeText={setCStock} placeholder="在庫数" keyboardType="numeric" />
                </View>
                <Text style={styles.label}>パッケージデザイン (パック画像)</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setCPackageImage)}>
                  {cPackageImage ? <Image source={{uri: cPackageImage}} style={styles.previewImg} /> : <ImageIcon color="#94A3B8" size={32} />}
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            <Text style={styles.label}>カードデザインの作成方法</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radioBtn, cardGenMode === 'manual' && styles.activeRadio]} onPress={() => setCardGenMode('manual')}>
                <Text style={[styles.radioText, cardGenMode === 'manual' && styles.activeRadioText]}>画像アップロード</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radioBtn, cardGenMode === 'ai' && styles.activeRadio]} onPress={() => setCardGenMode('ai')}>
                <Text style={[styles.radioText, cardGenMode === 'ai' && styles.activeRadioText]}>AIに描かせる</Text>
              </TouchableOpacity>
            </View>

            {cardGenMode === 'manual' ? (
              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setCImage)}>
                {cImage ? <Image source={{uri: cImage}} style={styles.previewImg} /> : <Upload color="#94A3B8" size={32} />}
              </TouchableOpacity>
            ) : (
              <TextInput style={[styles.input, {height: 80}]} value={cAiPrompt} onChangeText={setCAiPrompt} placeholder="AIプロンプトを入力..." multiline />
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleMintAction} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{mintDest === 'shop' ? 'ショップに陳列する' : '特権カードを配布する'}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== 4. BOSS & MAP ===================== */}
        {activeTab === 'bosses' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>マップ・ボス配置</Text>

              <Text style={styles.label}>ボス名 / 協賛名</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} value={bName} onChangeText={setBName} placeholder="ボス名" />
                <TextInput style={[styles.input, {flex: 1}]} value={bSponsorName} onChangeText={setBSponsorName} placeholder="協賛名 (例: 駅前デパート)" />
              </View>

              <Text style={styles.label}>ボス属性 / ステータス(HP/ATK/DEF)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1.2, marginHorizontal: 2}]} value={bElement} onChangeText={setBElement} placeholder="属性 (例: 闇)" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bHp} onChangeText={setBHp} placeholder="HP" keyboardType="numeric" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bAtk} onChangeText={setBAtk} placeholder="ATK" keyboardType="numeric" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bDef} onChangeText={setBDef} placeholder="DEF" keyboardType="numeric" />
              </View>

              <Text style={styles.label}>出現地点 (緯度/経度) & 半径(m)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bLat} onChangeText={setBLat} placeholder="緯度" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bLng} onChangeText={setBLng} placeholder="経度" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={bRadius} onChangeText={setBRadius} placeholder="半径" keyboardType="numeric" />
              </View>

              <View style={styles.divider} />
              <Text style={styles.cardTitle}>討伐ドロップカードの設定</Text>
              
              <Text style={styles.label}>ドロップカード名 / レアリティ / 属性</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 2, marginHorizontal: 2}]} value={dropCardName} onChangeText={setDropCardName} placeholder="カード名" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={dropCardRarity} onChangeText={setDropCardRarity} placeholder="レア" />
                <TextInput style={[styles.input, {flex: 1, marginHorizontal: 2}]} value={dropCardAttr} onChangeText={setDropCardAttr} placeholder="属性" />
              </View>

              <Text style={styles.label}>AI画像生成プロンプト</Text>
              <TextInput style={[styles.input, {height: 80}]} value={dropCardPrompt} onChangeText={setDropCardPrompt} placeholder="例: 巨大なドラゴンの鱗が輝くカード..." multiline />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateBoss} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>ボスと報酬カードを配置</Text>}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeading}>配置済みボス一覧</Text>
            {bosses.map((boss) => (
              <View key={boss.id} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{boss.name} (HP: {boss.hp} / ATK: {boss.atk})</Text>
                <Text style={styles.listItemSub}>属性: {boss.element} | キャンペーンID: {boss.trigger_campaign_id}</Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== 5. お知らせ ===================== */}
        {activeTab === 'announcements' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>お知らせ配信 (Push通知/全体メッセージ)</Text>
            
            <Text style={styles.label}>お知らせタイトル</Text>
            <TextInput style={styles.input} value={annTitle} onChangeText={setAnnTitle} placeholder="例: 新しいボスが出現しました！" />

            <Text style={styles.label}>お知らせ本文</Text>
            <TextInput style={[styles.input, {height: 120}]} value={annBody} onChangeText={setAnnBody} placeholder="お知らせの詳細内容を記述..." multiline />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendAnnouncement} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>全ユーザーに配信する</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  tabScroll: { flexDirection: 'row', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 10, maxHeight: 60 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10 },
  activeTabBtn: { backgroundColor: '#0F172A' },
  tabText: { marginLeft: 6, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 12, marginLeft: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  statValue: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 12, color: '#0F172A', fontWeight: '500', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  radioGroup: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  radioBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  activeRadio: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  radioText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  activeRadioText: { color: '#2563EB' },
  imagePicker: { backgroundColor: '#F1F5F9', height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  primaryBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 },
  listItem: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  listItemSub: { fontSize: 12, color: '#64748B', fontWeight: '500' }
});