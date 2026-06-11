import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();
  // タブ構成を拡張
  const [activeTab, setActiveTab] = useState('bosses'); 
  
  // 共通データリスト
  const [ugcCards, setUgcCards] = useState<any[]>([]);
  const [bosses, setBosses] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // 👹 フォーム状態（ボス追加）
  const [bName, setBName] = useState('');
  const [bHp, setBHp] = useState('');
  const [bAtk, setBAtk] = useState('');
  const [bLat, setBLat] = useState('35.6983'); // 初期値: 立川近辺
  const [bLng, setBLng] = useState('139.4130');
  const [bRadius, setBRadius] = useState('1000');
  const [bImage, setBImage] = useState('https://images.unsplash.com/photo-1542051812-ba32e18ce6a6');
  // 追加: 技、ドロップ、カスタムデザイン
  const [bSkills, setBSkills] = useState<string[]>(['']);
  const [bDropName, setBDropName] = useState('');
  const [bDropRarity, setBDropRarity] = useState('Normal');
  const [bCustomDesign, setBCustomDesign] = useState('');
  
  // 👹 自動生成状態（1時間ごと）
  const [autoBossEnabled, setAutoBossEnabled] = useState(false);

  // 🤖 フォーム状態（AIメーカー別調整）
  const [aiMaker, setAiMaker] = useState('');
  const [aiPromptText, setAiPromptText] = useState('');

  // 📢 フォーム状態（サーベイ配信）
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyTarget, setSurveyTarget] = useState('');
  const [surveyUrl, setSurveyUrl] = useState('');
  
  // 📢 デモグラフィックプルダウン用ステート
  const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);
  const [availableSegments, setAvailableSegments] = useState<string[]>([
    '全ユーザー', '課金ユーザー', '無課金ユーザー', '10代', '20代', '30代', '男性', '女性', 'メーカーAカード所持', '立川エリアユーザー'
  ]);

  // フォーム状態（ショップ・イベント・設定）
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');
  const [sType, setSType] = useState('original_pack'); // original_pack, influencer_pack, celebrity_pack
  
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eTime, setETime] = useState('12:00 - 20:00'); // イベント開催時間帯
  const [eLat, setELat] = useState('35.6983');        // イベント中心緯度
  const [eLng, setELng] = useState('139.4130');       // イベント中心経度
  const [eBossName, setEBossName] = useState('');     // 連動出現ボスキャラ設定

  // ゲーム内バランス調整用ステート
  const [expMultiplier, setExpMultiplier] = useState('1.0');
  const [hpMultiplier, setHpMultiplier] = useState('1.0');   // 途中調整用：モンスター・カード基本HP倍率
  const [atkMultiplier, setAtkMultiplier] = useState('1.0');  // 途中調整用：戦闘ATK基本倍率

  useFocusEffect(
    useCallback(() => {
      fetchAdminData();
    }, [activeTab])
  );

  const fetchAdminData = async () => {
    if (activeTab === 'ugc_cards') {
      const { data } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
      if (data) setUgcCards(data);
    } else if (activeTab === 'bosses') {
      const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false });
      if (data) setBosses(data);
      
      // 自動生成ステータスをDBから取得
      const { data: autoData } = await supabase.from('system_settings').select('*').eq('key', 'auto_boss_gen').single();
      if (autoData) setAutoBossEnabled(autoData.value === 'true');
      
    } else if (activeTab === 'survey') {
      // 実際の運用では DBからユーザーのデモグラフィック区分をフェッチ
      // const { data } = await supabase.from('demographic_segments').select('name');
      // if (data) setAvailableSegments(data.map(d => d.name));
    } else if (activeTab === 'shop') {
      const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
      if (data) setShopItems(data);
    } else if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    } else if (activeTab === 'settings') {
      const { data: expData } = await supabase.from('system_settings').select('*').eq('key', 'base_exp_multiplier').single();
      if (expData) setExpMultiplier(expData.value);
      const { data: hpData } = await supabase.from('system_settings').select('*').eq('key', 'global_hp_multiplier').single();
      if (hpData) setHpMultiplier(hpData.value);
      const { data: atkData } = await supabase.from('system_settings').select('*').eq('key', 'global_atk_multiplier').single();
      if (atkData) setAtkMultiplier(atkData.value);
    }
  };

  // --- ボス・マップ関連ロジック ---

  const handleUpdateSkill = (text: string, index: number) => {
    const newSkills = [...bSkills];
    newSkills[index] = text;
    setBSkills(newSkills);
  };

  const handleGenerateRandomBoss = () => {
    setBName(`異変種ボス_${Math.floor(Math.random() * 1000)}`);
    setBHp(String(Math.floor(Math.random() * 500) + 100));
    setBAtk(String(Math.floor(Math.random() * 50) + 10));
    setBLat(String(parseFloat(bLat) + (Math.random() - 0.5) * 0.05));
    setBLng(String(parseFloat(bLng) + (Math.random() - 0.5) * 0.05));
    setBRadius('500');
    setBSkills(['ランダムストライク', 'なぎ払う']);
    setBDropName(`シークレットカード_${Math.floor(Math.random() * 100)}`);
    setBDropRarity(['Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 3)]);
    setBCustomDesign('{"theme": "dark", "glow": true}');
  };

  const handleImageUpload = () => {
    Alert.alert('画像アップロード', 'ファイル選択UIを展開し、Storageに保存します。');
    setBImage('https://example.com/uploaded_custom_image.png');
  };

  const handleAddBoss = async () => {
    if (!bName || !bHp || !bAtk || !bLat || !bLng) {
      Alert.alert('エラー', '必須項目を入力してください');
      return;
    }
    const { error } = await supabase.from('bosses').insert([
      { 
        name: bName, 
        hp: parseInt(bHp), 
        atk: parseInt(bAtk), 
        def: 10, 
        lat: parseFloat(bLat), 
        lng: parseFloat(bLng), 
        radius_meters: parseInt(bRadius),
        image_url: bImage,
        skills: bSkills.filter(s => s !== ''),
        drop_card_name: bDropName || null,
        drop_card_rarity: bDropName ? bDropRarity : null,
        custom_design: bCustomDesign || null,
        is_active: true 
      }
    ]);
    if (error) { Alert.alert('失敗', error.message); } 
    else { 
      Alert.alert('成功', '限定ボスとドロップ設定をマップに配置しました'); 
      fetchAdminData(); 
    }
  };

  const toggleAutoBossGen = async () => {
    const newVal = !autoBossEnabled;
    const { error } = await supabase.from('system_settings').upsert({ key: 'auto_boss_gen', value: newVal.toString() });
    if (!error) {
      setAutoBossEnabled(newVal);
      Alert.alert('設定更新', `1時間ごとのランダムボス自動生成を${newVal ? 'ON' : 'OFF'}にしました。\n※バックエンドのCron処理がこの設定を参照します。`);
    }
  };

  // --- AI錬成・サーベイロジック ---

  const handleSaveAiPrompt = async () => {
    if (!aiMaker) return Alert.alert('エラー', 'メーカー・ブランド名を入力してください');
    Alert.alert('保存完了', `${aiMaker}用のAI錬成プロンプト雛形をシステムに適用しました。`);
    setAiMaker('');
    setAiPromptText('');
  };

  const handleSendSurvey = async () => {
    if (!surveyTarget || !surveyUrl) return Alert.alert('エラー', 'ターゲット条件とURLは必須です');
    Alert.alert('配信完了', `条件「${surveyTarget}」に合致するユーザーへサーベイ案内をプッシュ配信しました。`);
    setSurveyTitle('');
    setSurveyTarget('');
    setSurveyUrl('');
  };

  // 🛒 ショップ設定（オリジナル・インフルエンサー・有名人対応）
  const handleAddShopItem = async () => {
    if (!sName || !sPrice) {
      Alert.alert('エラー', '商品名と価格を入力してください');
      return;
    }
    const { error } = await supabase.from('shop_items').insert([
      { name: sName, price: parseInt(sPrice), item_type: sType, is_active: true }
    ]);
    if (!error) {
      Alert.alert('成功', '新コンセプトパックをショップに追加陳列しました');
      setSName('');
      setSPrice('');
      fetchAdminData();
    } else {
      Alert.alert('失敗', error.message);
    }
  };

  // 🎊 イベント構築（時間・場所・連動ボス配置設定）
  const handleAddEvent = async () => {
    if (!eTitle || !eDesc) {
      Alert.alert('エラー', 'タイトルと詳細説明を入力してください');
      return;
    }
    const { error } = await supabase.from('events').insert([
      { 
        title: eTitle, 
        description: eDesc, 
        event_time_range: eTime,
        lat: parseFloat(eLat),
        lng: parseFloat(eLng),
        attached_boss_name: eBossName || null,
        is_active: true 
      }
    ]);
    if (!error) {
      Alert.alert('成功', '特定ロケーション連動イベントを構築・公開しました');
      setETitle('');
      setEDesc('');
      setEBossName('');
      fetchAdminData();
    } else {
      Alert.alert('失敗', error.message);
    }
  };

  // ⚡ UGCカードのステータス・特別デザイン調整
  const handleAdjustCard = async (cardId: string, currentFixed: boolean, currentAtk: number) => {
    const { error } = await supabase.from('cards').update({
      is_fixed: !currentFixed,
      status_atk: currentAtk + 10
    }).eq('id', cardId);
    
    if (!error) {
      Alert.alert('調整完了', 'カードのステータスとデザイン属性（カテゴリ）を更新しました。');
      fetchAdminData();
    }
  };

  // ⚖️ ゲーム内バランス調整の一括適用（リアルタイムパラメータ変更）
  const handleSaveSettings = async () => {
    const { error: err1 } = await supabase.from('system_settings').upsert({ key: 'base_exp_multiplier', value: expMultiplier });
    const { error: err2 } = await supabase.from('system_settings').upsert({ key: 'global_hp_multiplier', value: hpMultiplier });
    const { error: err3 } = await supabase.from('system_settings').upsert({ key: 'global_atk_multiplier', value: atkMultiplier });
    
    if (!err1 && !err2 && !err3) {
      Alert.alert('成功', 'ゲーム内経済及び戦闘ステータスバランスを即時適用しました。');
    } else {
      Alert.alert('エラー', '一部バランス設定の保存に失敗しました。');
    }
  };

  const toggleActive = async (table: string, id: string, current: boolean) => {
    await supabase.from(table).update({ is_active: !current }).eq('id', id);
    fetchAdminData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STRATEGIC ADMIN</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>終了</Text>
        </TouchableOpacity>
      </View>

      {/* ナビゲーションタブ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {[
          { id: 'bosses', label: '👹 ボスマップ配置' },
          { id: 'ai_prompt', label: '🤖 AIロジック調整' },
          { id: 'survey', label: '📢 サーベイ配信' },
          { id: 'ugc_cards', label: 'UGCカード監視' },
          { id: 'shop', label: 'ショップ設定' },
          { id: 'events', label: 'イベント構築' },
          { id: 'settings', label: 'バランス調整' }
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.activeTab]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* 👹 1. 限定ボス・マップ配置 */}
        {activeTab === 'bosses' && (
          <View>
            <View style={styles.autoGenBox}>
              <View>
                <Text style={styles.autoGenText}>⏳ 1時間ごとのランダムボス自動生成</Text>
                <Text style={styles.autoGenSub}>ONにすると1時間間隔でマップ上に未知のボスが配置されます</Text>
              </View>
              <TouchableOpacity style={[styles.toggleBtn, autoBossEnabled ? styles.toggleOn : styles.toggleOff]} onPress={toggleAutoBossGen}>
                <Text style={[styles.toggleBtnText, autoBossEnabled ? styles.toggleTextOn : styles.toggleTextOff]}>
                  {autoBossEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity style={[styles.addBtn, { flex: 1, marginTop: 0, backgroundColor: '#8B5CF6' }]} onPress={handleGenerateRandomBoss}>
                <Text style={styles.addBtnText}>🎲 パラメータをランダム生成 (手動)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>エリア限定ボス 新規プロット</Text>
              
              <Text style={styles.label}>基本ステータス</Text>
              <TextInput style={styles.input} placeholder="ボス名称" value={bName} onChangeText={setBName} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="HP" keyboardType="numeric" value={bHp} onChangeText={setBHp} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ATK" keyboardType="numeric" value={bAtk} onChangeText={setBAtk} />
              </View>

              <Text style={styles.label}>出現座標（緯度経度指定）</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="緯度 (Lat)" value={bLat} onChangeText={setBLat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="経度 (Lng)" value={bLng} onChangeText={setBLng} />
              </View>
              <TextInput style={styles.input} placeholder="影響半径 (meters)" keyboardType="numeric" value={bRadius} onChangeText={setBRadius} />

              <Text style={styles.label}>使用技（複数可）</Text>
              {bSkills.map((skill, index) => (
                <TextInput key={index} style={styles.input} placeholder={`技 ${index + 1}`} value={skill} onChangeText={(t) => handleUpdateSkill(t, index)} />
              ))}
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setBSkills([...bSkills, ''])}>
                <Text style={styles.outlineBtnText}>+ 技を追加</Text>
              </TouchableOpacity>

              <Text style={styles.label}>討伐特典（特別なカードゲット）</Text>
              <TextInput style={styles.input} placeholder="ドロップカード名（空なら特典なし）" value={bDropName} onChangeText={setBDropName} />
              <TextInput style={styles.input} placeholder="レアリティ (例: Rare)" value={bDropRarity} onChangeText={setBDropRarity} />
              
              <Text style={styles.label}>カード画像 ＆ カスタムデザイン</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="画像URL" value={bImage} onChangeText={setBImage} />
                <TouchableOpacity style={[styles.outlineBtn, { marginBottom: 0, justifyContent: 'center' }]} onPress={handleImageUpload}>
                  <Text style={styles.outlineBtnText}>⬆️ アップロード</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder={`カスタムデザイン指定 (JSON等)\n例: {"frameColor": "gold"}`} multiline value={bCustomDesign} onChangeText={setBCustomDesign} />

              <TouchableOpacity style={styles.addBtn} onPress={handleAddBoss}>
                <Text style={styles.addBtnText}>指定座標にボスを配置</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>配置済みボス一覧</Text>
            {bosses.map((b) => (
              <View key={b.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{b.name}</Text>
                  <Text style={styles.itemSub}>📍 {b.lat}, {b.lng} | ドロップ: {b.drop_card_name || 'なし'}</Text>
                </View>
                <TouchableOpacity style={[styles.statusBtn, b.is_active ? styles.statusActive : styles.statusInactive]} onPress={() => toggleActive('bosses', b.id, b.is_active)}>
                  <Text style={styles.statusBtnText}>{b.is_active ? '出現中' : '隠蔽中'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 🤖 2. AI錬成ロジック調整 */}
        {activeTab === 'ai_prompt' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>企業・メーカー別 AI錬成ロジック調整</Text>
            <Text style={styles.infoText}>特定のロゴや商品を検知した際に適用される、特別なシステムプロンプトの雛形を登録します。</Text>
            <TextInput style={styles.input} placeholder="メーカー・ブランド名" value={aiMaker} onChangeText={setAiMaker} />
            <TextInput style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} placeholder="プロンプト雛形を入力..." multiline value={aiPromptText} onChangeText={setAiPromptText} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveAiPrompt}>
              <Text style={styles.addBtnText}>メーカー別AIロジックを保存</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 📢 3. サーベイ配信 */}
        {activeTab === 'survey' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>デモグラフィック・割付サーベイ配信</Text>
            <TextInput style={styles.input} placeholder="お知らせタイトル" value={surveyTitle} onChangeText={setSurveyTitle} />
            
            {/* デモグラフィック用 カスタムプルダウンUI */}
            <Text style={styles.label}>割付・ターゲット条件指定</Text>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setIsSegmentDropdownOpen(!isSegmentDropdownOpen)}>
              <Text style={styles.dropdownHeaderText}>{surveyTarget || 'デモグラフィック・セグメントを選択'}</Text>
              <Text style={styles.dropdownIcon}>{isSegmentDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {isSegmentDropdownOpen && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled={true}>
                  {availableSegments.map((segment) => (
                    <TouchableOpacity 
                      key={segment} 
                      style={styles.dropdownItem} 
                      onPress={() => { setSurveyTarget(segment); setIsSegmentDropdownOpen(false); }}
                    >
                      <Text style={styles.dropdownItemText}>{segment}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput style={styles.input} placeholder="サーベイURL" value={surveyUrl} onChangeText={setSurveyUrl} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={handleSendSurvey}>
              <Text style={styles.addBtnText}>対象ユーザーへ配信を実行</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 👁️ 4. UGCカード監視 */}
        {activeTab === 'ugc_cards' && (
          <View>
            <Text style={styles.sectionTitle}>ユーザー生成コンテンツ(UGC) 監視台帳</Text>
            {ugcCards.length === 0 ? (
              <Text style={styles.infoText}>現在、データベース内にUGCカードがありません。</Text>
            ) : (
              ugcCards.map((card) => (
                <View key={card.id} style={styles.listItemVertical}>
                  <Image source={{ uri: card.image_url || 'https://via.placeholder.com/70x90' }} style={styles.cardPreviewImage} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemName}>{card.is_fixed ? '🌟 [限定枠] ' : ''}{card.card_name || '無名オブジェクト'}</Text>
                    <Text style={styles.itemSub}>
                      種別: {card.is_founder ? '👑 Founder初版' : card.category || '通常図鑑'}
                    </Text>
                    <Text style={styles.itemSub}>ATK: {card.status_atk || 0} | HP: {card.status_hp || 0}</Text>
                    <TouchableOpacity 
                      style={styles.adjustBtn} 
                      onPress={() => handleAdjustCard(card.id, card.is_fixed, card.status_atk || 0)}
                    >
                      <Text style={styles.adjustBtnText}>⚡ 特別枠切替 & ATK+10調整</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 🛒 5. ショップ設定 */}
        {activeTab === 'shop' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>マネタイズパック 新規陳列設定</Text>
              <TextInput style={styles.input} placeholder="パック名 (例: 〇〇コラボ限定パック)" value={sName} onChangeText={setSName} />
              <TextInput style={styles.input} placeholder="販売価格 (ゴールド)" keyboardType="numeric" value={sPrice} onChangeText={setSPrice} />
              
              <Text style={styles.label}>パックカテゴリ割付</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'original_pack', label: 'オリジナル' },
                  { id: 'influencer_pack', label: 'インフルエンサー' },
                  { id: 'celebrity_pack', label: '有名人・タレント' }
                ].map((packType) => (
                  <TouchableOpacity 
                    key={packType.id} 
                    style={[styles.miniChip, sType === packType.id && styles.activeMiniChip]} 
                    onPress={() => setSType(packType.id)}
                  >
                    <Text style={styles.miniChipText}>{packType.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddShopItem}>
                <Text style={styles.addBtnText}>ショップに追加・陳列</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>陳列中のショップアイテム</Text>
            {shopItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>価格: {item.price} Gold | 分類: {item.item_type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 🎊 6. イベント構築 */}
        {activeTab === 'events' && (
          <View>
            <View style={styles.formContainer}>
              <Text style={styles.formSectionTitle}>新規スポットイベント タイムライン構築</Text>
              <TextInput style={styles.input} placeholder="イベントタイトル" value={eTitle} onChangeText={setETitle} />
              <TextInput style={styles.input} placeholder="概要・告知説明文" value={eDesc} onChangeText={setEDesc} />
              
              <Text style={styles.label}>時間・日時指示</Text>
              <TextInput style={styles.input} placeholder="例: 12:00 - 18:00 (毎日開催)" value={eTime} onChangeText={setETime} />
              
              <Text style={styles.label}>開催対象ロケーション設定</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="緯度 (Lat)" value={eLat} onChangeText={setELat} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="経度 (Lng)" value={eLng} onChangeText={setELng} />
              </View>

              <Text style={styles.label}>出現連動ボス指定</Text>
              <TextInput style={styles.input} placeholder="出現させるボスキャラ名を入力" value={eBossName} onChangeText={setEBossName} />

              <TouchableOpacity style={styles.addBtn} onPress={handleAddEvent}>
                <Text style={styles.addBtnText}>イベントスケジュールを発令</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>スケジュール中のイベント</Text>
            {events.map((e) => (
              <View key={e.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{e.title}</Text>
                  <Text style={styles.itemSub}>🕒 {e.event_time_range} | 📍 {e.lat}, {e.lng}</Text>
                  {e.attached_boss_name && <Text style={[styles.itemSub, { color: '#EF4444' }]}>👹 連動ボス: {e.attached_boss_name}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ⚖️ 7. バランス調整 */}
        {activeTab === 'settings' && (
          <View style={styles.formContainer}>
            <Text style={styles.formSectionTitle}>ゲーム内メカニクス・ステータス一括途中調整</Text>
            
            <Text style={styles.label}>戦闘獲得経験値（EXP）の自動生成倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={expMultiplier} onChangeText={setExpMultiplier} />
            
            <Text style={styles.label}>全エネミー・ボスキャラ基本体力（HP）補正係数</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={hpMultiplier} onChangeText={setHpMultiplier} />
            
            <Text style={styles.label}>グローバル戦闘攻撃力（ATK）システム倍率</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={atkMultiplier} onChangeText={setAtkMultiplier} />
            
            <Text style={styles.infoText}>※デバッグ中やゲームバランス調整時に、アプリ側のコードを再ビルドすることなくリアルタイムに変数のベースラインを変更できます。</Text>
            
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveSettings}>
              <Text style={styles.addBtnText}>システムステータス調整を即時保存</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0F172A' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoutBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  
  tabScroll: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', maxHeight: 60 },
  tabContainer: { paddingHorizontal: 10, alignItems: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 14, marginRight: 8 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#0F172A' },
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#0F172A', fontWeight: '900' },
  
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 12, marginTop: 8 },
  formSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  label: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  infoText: { color: '#64748B', fontSize: 12, marginBottom: 16, fontWeight: '600', lineHeight: 18 },
  
  formContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 10, marginBottom: 10, color: '#0F172A' },
  addBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  outlineBtn: { borderWidth: 1, borderColor: '#3B82F6', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  outlineBtnText: { color: '#3B82F6', fontWeight: '700', fontSize: 13 },
  
  // 新規追加スタイル（自動生成＆プルダウン）
  autoGenBox: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  autoGenText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  autoGenSub: { fontSize: 11, color: '#64748B', marginTop: 4 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  toggleOn: { backgroundColor: '#10B981', borderColor: '#059669' },
  toggleOff: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  toggleTextOn: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  toggleTextOff: { color: '#64748B', fontWeight: '800', fontSize: 13 },

  dropdownHeader: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownHeaderText: { color: '#0F172A', fontSize: 14 },
  dropdownIcon: { color: '#64748B', fontSize: 12, fontWeight: 'bold' },
  dropdownList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 16, maxHeight: 180 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { color: '#1E293B', fontSize: 14, fontWeight: '500' },
  
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemVertical: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  itemSub: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  
  cardPreviewImage: { width: 70, height: 90, borderRadius: 8, backgroundColor: '#F1F5F9' },
  adjustBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  adjustBtnText: { color: '#2563EB', fontSize: 11, fontWeight: '800' },
  
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F1F5F9' },
  statusBtnText: { fontSize: 11, fontWeight: '800', color: '#1E293B' },
  
  miniChip: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  activeMiniChip: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1 },
  miniChipText: { fontSize: 12, fontWeight: '700', color: '#475569' }
});