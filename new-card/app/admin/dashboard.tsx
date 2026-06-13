import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { BarChart3, Users, Store, ShieldAlert, Bell, Upload, Image as ImageIcon, Database, Layers } from 'lucide-react-native';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);

  // 1. 分析用データ
  const [analyticsData, setAnalyticsData] = useState<any>({
    dau: 0, mau: 0, total_posts: 0, total_battles: 0, demographics: { males: 0, females: 0, teens: 0, twenties: 0, thirties: 0 }
  });

  // 2. ユーザー管理
  const [users, setUsers] = useState<any[]>([]);

  // 3. UGCカード管理 (新規追加)
  const [ugcCards, setUgcCards] = useState<any[]>([]);

  // 4. 特権MINT ＆ ショップ統合
  const [mintDest, setMintDest] = useState<'direct' | 'shop'>('direct');
  const [shopItemType, setShopItemType] = useState<'single' | 'pack'>('single');
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
  const [packCardCount, setPackCardCount] = useState('5');
  const [packDesc, setPackDesc] = useState('ランダムなカードが排出されるパックです。');

  // 5. ボス / マップ配置
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
  const [bossImageMode, setBossImageMode] = useState<'upload' | 'ai'>('upload');
  const [bossImageUrl, setBossImageUrl] = useState('');
  const [bossAiPrompt, setBossAiPrompt] = useState('');

  const [dropCardMode, setDropCardMode] = useState<'upload' | 'ai'>('ai');
  const [dropCardUrl, setDropCardUrl] = useState('');
  const [dropCardName, setDropCardName] = useState('');
  const [dropCardPrompt, setDropCardPrompt] = useState('');
  const [dropCardRarity, setDropCardRarity] = useState('UR');
  const [dropCardAttr, setDropCardAttr] = useState('闇');

  // 6. お知らせ配信
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  // 7. マスタ拡張用
  const [elementsList, setElementsList] = useState<string[]>([]);
  const [raritiesList, setRaritiesList] = useState<string[]>([]);
  const [newElement, setNewElement] = useState('');
  const [newRarity, setNewRarity] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
      fetchUsers();
      fetchUgcCards();
      fetchBosses();
      fetchMasterData();
    }, [])
  );

  // ===================== データ取得系 =====================
  const fetchAnalytics = async () => { /* 既存のまま */ };

  const fetchUsers = async () => {
    // is_banned も取得する
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setUsers(data);
  };

  const fetchUgcCards = async () => {
    // ユーザーが生成したカードを取得 (profilesとJOINして作成者名も取得)
    const { data, error } = await supabase
      .from('cards')
      .select(`
        id, card_name, image_url, is_hidden, created_at,
        profiles!cards_author_id_fkey(player_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setUgcCards(data);
    if (error) console.log('UGC Fetch Error:', error);
  };

  const fetchBosses = async () => { /* 既存のまま */ };
  const fetchMasterData = async () => { /* 既存のまま */ };

  const pickImage = async (setter: any) => { /* 既存のまま */ };
  const uploadBase64Image = async (base64String: string, pathPrefix: string) => { /* 既存のまま */ return base64String; };

  // ===================== BAN / UGC管理 アクション =====================

  // ユーザーのBAN状態を切り替える
  const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
    const action = currentBanStatus ? 'BAN解除' : 'BAN';
    Alert.alert(
      `${action}の確認`,
      `本当にこのユーザーを${action}しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '実行', 
          style: currentBanStatus ? 'default' : 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.from('profiles').update({ is_banned: !currentBanStatus }).eq('id', userId);
              if (error) throw error;
              Alert.alert('成功', `ユーザーを${action}しました。`);
              fetchUsers(); // リストを更新
            } catch (e: any) {
              Alert.alert('エラー', e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // UGCカードの非表示状態を切り替える
  const handleToggleHideCard = async (cardId: string, currentHiddenStatus: boolean) => {
    const action = currentHiddenStatus ? '表示' : '非表示';
    Alert.alert(
      `${action}の確認`,
      `このカードを${action}状態にしますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '実行', 
          style: currentHiddenStatus ? 'default' : 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.from('cards').update({ is_hidden: !currentHiddenStatus }).eq('id', cardId);
              if (error) throw error;
              Alert.alert('成功', `カードを${action}にしました。`);
              fetchUgcCards(); // リストを更新
            } catch (e: any) {
              Alert.alert('エラー', e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };


  // ===================== その他既存アクション =====================
  const handleMintAction = async () => { /* 既存のまま */ };
  const handleCreateBoss = async () => { /* 既存のまま */ };
  const handleSendAnnouncement = async () => { /* 既存のまま */ };
  const handleAddMaster = async (type: 'element' | 'rarity') => { /* 既存のまま */ };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMMAND CENTER</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {/* ...既存のタブ群... */}
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'analytics' && styles.activeTabBtn]} onPress={() => setActiveTab('analytics')}>
          <BarChart3 color={activeTab === 'analytics' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>分析</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'users' && styles.activeTabBtn]} onPress={() => setActiveTab('users')}>
          <Users color={activeTab === 'users' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>ユーザー</Text>
        </TouchableOpacity>
        
        {/* 新規追加：UGCカード管理タブ */}
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'ugc' && styles.activeTabBtn]} onPress={() => setActiveTab('ugc')}>
          <Layers color={activeTab === 'ugc' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'ugc' && styles.activeTabText]}>UGC管理</Text>
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
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'master' && styles.activeTabBtn]} onPress={() => setActiveTab('master')}>
          <Database color={activeTab === 'master' ? '#FFF' : '#64748B'} size={18} />
          <Text style={[styles.tabText, activeTab === 'master' && styles.activeTabText]}>マスタ拡張</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* ...既存タブの内容（省略せずそのまま利用）... */}

        {/* ===================== 2. ユーザー (BAN機能追加) ===================== */}
        {activeTab === 'users' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>登録ユーザー一覧</Text>
            {users.map(u => (
              <View key={u.id} style={styles.listItem}>
                <View style={{flex: 1}}>
                  <View style={styles.row}>
                    <Text style={styles.listItemTitle}>{u.player_name || '名称未設定'} (Lv: {u.player_level || 1})</Text>
                    {u.is_banned && <Text style={styles.bannedBadge}>BANNED</Text>}
                  </View>
                  <Text style={styles.listItemSub}>勝利: {u.total_wins || 0} | 討伐: {u.boss_defeats || 0}</Text>
                  <Text style={styles.listItemSub}>ID: {u.id.substring(0, 10)}...</Text>
                </View>
                
                {/* BAN切り替えボタン */}
                <TouchableOpacity 
                  style={[styles.actionBtn, u.is_banned ? styles.unbanBtn : styles.banBtn]} 
                  onPress={() => handleToggleBan(u.id, u.is_banned)}
                  disabled={loading}
                >
                  <Text style={styles.actionBtnText}>{u.is_banned ? '解除' : 'BAN'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ===================== 3. UGC管理 (新規追加) ===================== */}
        {activeTab === 'ugc' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ユーザー生成カード (UGC) 管理</Text>
            <Text style={{color:'#64748B', fontSize: 13, marginBottom: 16}}>
              不適切なカード（公序良俗に反する画像やテキスト）を非表示にできます。
            </Text>

            {ugcCards.map(c => (
              <View key={c.id} style={styles.ugcItem}>
                {c.image_url ? (
                  <Image source={{ uri: c.image_url }} style={styles.ugcThumb} />
                ) : (
                  <View style={[styles.ugcThumb, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                    <ImageIcon color="#94A3B8" size={24} />
                  </View>
                )}
                
                <View style={{flex: 1, marginLeft: 12}}>
                  <View style={styles.row}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>{c.card_name}</Text>
                    {c.is_hidden && <Text style={styles.bannedBadge}>非表示</Text>}
                  </View>
                  <Text style={styles.listItemSub}>作成者: {c.profiles?.player_name || '不明'}</Text>
                  <Text style={styles.listItemSub}>作成日: {new Date(c.created_at).toLocaleDateString()}</Text>
                </View>

                {/* 非表示切り替えボタン */}
                <TouchableOpacity 
                  style={[styles.actionBtn, c.is_hidden ? styles.unbanBtn : styles.hideBtn]} 
                  onPress={() => handleToggleHideCard(c.id, c.is_hidden)}
                  disabled={loading}
                >
                  <Text style={styles.actionBtnText}>{c.is_hidden ? '表示' : '非表示'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ...その他の既存タブUIは先程のコードと同様... */}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ...既存のスタイル... */
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
  
  // 新規追加スタイル
  row: { flexDirection: 'row', alignItems: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  listItemTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  listItemSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  
  bannedBadge: { backgroundColor: '#FEE2E2', color: '#EF4444', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  banBtn: { backgroundColor: '#EF4444' },
  unbanBtn: { backgroundColor: '#10B981' },
  hideBtn: { backgroundColor: '#F59E0B' },

  ugcItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  ugcThumb: { width: 50, height: 70, borderRadius: 8, resizeMode: 'cover' },
});