"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { BarChart3, Users, Store, ShieldAlert, Bell, Upload, Image as ImageIcon, Database, Layers, Download, LogOut } from 'lucide-react';

export default function WebAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(true); // 初期状態をtrueにする
  const [actionLoading, setActionLoading] = useState(false);

  // ==================== 1. 分析用データ ====================
  const [analyticsData, setAnalyticsData] = useState<any>({
    dau: 0, mau: 0, total_posts: 0, total_battles: 0, 
    demographics: { males: 0, females: 0, teens: 0, twenties: 0, thirties: 0, overForties: 0, locations: {} }
  });

  // 他の各種ステート（ユーザー、UGC、ショップ等）
  const [users, setUsers] = useState<any[]>([]);
  const [ugcCards, setUgcCards] = useState<any[]>([]);
  const [bosses, setBosses] = useState<any[]>([]);
  const [elementsList, setElementsList] = useState<string[]>([]);
  const [raritiesList, setRaritiesList] = useState<string[]>([]);
  
  // フォーム用ステート群
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

  // ボス配置用ステート
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

  // お知らせ用ステート
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [targetGender, setTargetGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [targetAge, setTargetAge] = useState<'ALL' | 'TEENS' | 'TWENTIES' | 'THIRTIES'>('ALL');
  const [targetLocation, setTargetLocation] = useState('');

  // マスタ追加用ステート
  const [newElement, setNewElement] = useState('');
  const [newRarity, setNewRarity] = useState('');

  // 🛡️【最重要】アクセス時の権限チェックガード
  useEffect(() => {
    const checkAdminAuth = async () => {
      // 現在ログインしているユーザーのセッションを取得
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // ログインしていなければ即ログイン画面へ
        router.push('/login');
        return;
      }

      // ログインしている場合、roleがadminかデータベースを確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        // adminでなければログアウトさせてログイン画面へ戻す
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      // 権限チェック完了後に本番データをロード
      setLoading(false);
      fetchAnalytics();
      fetchUsers();
      fetchUgcCards();
      fetchBosses();
      fetchMasterData();
    };

    checkAdminAuth();
  }, [router]);

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ==========================================
  // データフェッチ関数
  // ==========================================
  const fetchAnalytics = async () => {
    try {
      const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
      const { data: profiles } = await supabase.from('profiles').select('*');
      
      let dau = 0; let mau = 0; let totalBattles = 0; const now = new Date();
      let males = 0; let females = 0; 
      let teens = 0; let twenties = 0; let thirties = 0; let overForties = 0;
      let locations: Record<string, number> = {};

      profiles?.forEach((p: any) => {
        if (p.last_sign_in_at) {
          const lastSignIn = new Date(p.last_sign_in_at);
          const diffDays = (now.getTime() - lastSignIn.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1) dau++;
          if (diffDays <= 30) mau++;
        }
        totalBattles += (p.total_wins || 0) + (p.boss_defeats || 0);

        if (p.gender === 'male' || p.gender === '男性') males++;
        else if (p.gender === 'female' || p.gender === '女性') females++;

        if (p.age_group === '10s') teens++;
        else if (p.age_group === '20s') twenties++;
        else if (p.age_group === '30s') thirties++;
        else if (p.age_group === '40s' || p.age_group === '50s+') overForties++;

        if (p.region) locations[p.region] = (locations[p.region] || 0) + 1;
      });

      setAnalyticsData({
        dau, mau, total_posts: totalCards || 0, total_battles: totalBattles,
        demographics: { males, females, teens, twenties, thirties, overForties, locations }
      });
    } catch (e) { console.log(e); }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { descending: false }).limit(50);
    if (data) setUsers(data);
  };

  const fetchUgcCards = async () => {
    try {
      let { data, error } = await supabase.from('cards').select(`id, card_name, image_url, is_hidden, created_at, player_id, profiles(player_name)`).order('created_at', { ascending: false }).limit(50);
      if (error) {
        const fallback = await supabase.from('cards').select('id, card_name, image_url, is_hidden, created_at, player_id').order('created_at', { ascending: false }).limit(50);
        data = fallback.data;
      }
      if (data) setUgcCards(data);
    } catch (err) {}
  };

  const fetchBosses = async () => {
    const { data } = await supabase.from('bosses').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setBosses(data);
  };

  const fetchMasterData = async () => {
    const { data } = await supabase.from('system_config').select('*').in('id', ['elements', 'rarities']);
    let els = ['火', '水', '雷', '風', '木', '土', '光', '闇'];
    let rars = ['N', 'R', 'SR', 'SSR', 'UR', 'DUST'];
    data?.forEach(d => {
      if (d.id === 'elements' && d.config_data.list) els = d.config_data.list;
      if (d.id === 'rarities' && d.config_data.list) rars = d.config_data.list;
    });
    setElementsList(els);
    setRaritiesList(rars);
  };

  // Web用画像読み込みハンドラ
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadBase64Image = async (base64String: string, pathPrefix: string) => {
    if (!base64String.startsWith('data:image')) return base64String;
    const base64Str = base64String.split(',')[1];
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'image/jpeg'});
    
    const fileName = `${pathPrefix}/${Date.now()}.jpg`;
    await supabase.storage.from('card_images').upload(fileName, blob, { contentType: 'image/jpeg' });
    return supabase.storage.from('card_images').getPublicUrl(fileName).data.publicUrl;
  };

  const exportAnalyticsCSV = () => {
    const header = "Date,DAU,MAU,Total_Cards,Total_Battles,Males,Females,Teens,Twenties,Thirties,OverForties\n";
    const row = `${new Date().toLocaleDateString()},${analyticsData.dau},${analyticsData.mau},${analyticsData.total_posts},${analyticsData.total_battles},${analyticsData.demographics.males},${analyticsData.demographics.females},${analyticsData.demographics.teens},${analyticsData.demographics.twenties},${analyticsData.demographics.thirties},${analyticsData.demographics.overForties}\n`;
    const csvString = header + row;
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 管理アクション群
  const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
    if(!window.confirm(`本当にこのユーザーを${currentBanStatus ? 'BAN解除' : 'BAN'}しますか？`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ is_banned: !currentBanStatus }).eq('id', userId);
      if (error) throw error;
      alert('ステータスを更新しました。');
      fetchUsers();
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  const handleToggleHideCard = async (cardId: string, currentHiddenStatus: boolean) => {
    if(!window.confirm(`このカードを${currentHiddenStatus ? '表示' : '非表示'}にしますか？`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('cards').update({ is_hidden: !currentHiddenStatus }).eq('id', cardId);
      if (error) throw error;
      alert('ステータスを更新しました。');
      fetchUgcCards();
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  const handleMintAction = async () => {
    setActionLoading(true);
    try {
      let finalCardImageUrl = cImage;
      let finalPackageUrl = cPackageImage;
      
      const cardDataToInsert: any = {
        card_name: cName || '名もなき特権カード', element: cAttr || '火', rarity: cRarity || 'SR',
        status_hp: parseInt(cHp) || 100, status_atk: parseInt(cAtk) || 50, status_def: parseInt(cDef) || 50, status_spd: parseInt(cSpd) || 50,
        status_total: (parseInt(cHp)||100)+(parseInt(cAtk)||50)+(parseInt(cDef)||50)+(parseInt(cSpd)||50),
        skill_name: cSkillName || '通常攻撃',
      };

      if (shopItemType === 'single' && cardGenMode === 'ai' && cAiPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: cAiPrompt } });
        finalCardImageUrl = data?.imageUrl || 'https://via.placeholder.com/300x400.png?text=AI+Generated';
      } else if (shopItemType === 'single' && cImage) {
        finalCardImageUrl = await uploadBase64Image(cImage, 'mint');
      }

      if (mintDest === 'shop') {
        if (cPackageImage) finalPackageUrl = await uploadBase64Image(cPackageImage, 'packages');
        const itemStats = shopItemType === 'pack' ? { item_type: 'pack', count: parseInt(packCardCount) || 5 } : { item_type: 'single', ...cardDataToInsert };

        const { error: shopError } = await supabase.from('shop_items').insert([{
          name: cName, description: shopItemType === 'pack' ? packDesc : `属性: ${cAttr} / レアリティ: ${cRarity}`,
          price: parseInt(cPrice) || 500, stock: parseInt(cStock) || 100,
          package_image_url: finalPackageUrl || finalCardImageUrl,
          card_image_url: shopItemType === 'single' ? finalCardImageUrl : null,
          stats: itemStats
        }]);
        if (shopError) throw shopError;
        alert(`ショップに出品しました！`);
      } else {
        const { error: fixError } = await supabase.from('fixed_cards').insert([{
          card_name: cName, trigger_type: 'admin_mint', image_url: finalCardImageUrl, stats: cardDataToInsert
        }]);
        if (fixError) throw fixError;
        alert('特権カードを生成・登録しました！');
      }
      setCName(''); setCImage(''); setCPackageImage(''); setCAiPrompt(''); setPackDesc('');
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  const handleCreateBoss = async () => {
    setActionLoading(true);
    try {
      let finalBossImageUrl = bossImageUrl;
      let finalDropCardUrl = dropCardUrl;
      
      if (bossImageMode === 'ai' && bossAiPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: bossAiPrompt } });
        if (data?.imageUrl) finalBossImageUrl = data.imageUrl;
      } else if (bossImageUrl) {
        finalBossImageUrl = await uploadBase64Image(bossImageUrl, 'bosses');
      }

      if (dropCardMode === 'ai' && dropCardPrompt) {
        const { data } = await supabase.functions.invoke('generate-card-image', { body: { prompt: dropCardPrompt } });
        if (data?.imageUrl) finalDropCardUrl = data.imageUrl;
      } else if (dropCardUrl) {
        finalDropCardUrl = await uploadBase64Image(dropCardUrl, 'boss_drops');
      }

      const { data: campData, error: campError } = await supabase.from('campaigns').insert([{
        title: `ボス出現: ${bName}`, sponsor_name: bSponsorName || '運営',
        target_lat: parseFloat(bLat), target_lng: parseFloat(bLng), radius_meters: parseInt(bRadius), is_active: true
      }]).select().single();
      if (campError) throw campError;

      const { error: dropError } = await supabase.from('fixed_cards').insert([{
        card_name: dropCardName || `【撃破報酬】${bName}`, trigger_type: 'boss_drop', image_url: finalDropCardUrl, sponsor_id: campData.id,
        stats: { element: dropCardAttr, rarity: dropCardRarity, hp: 100, atk: 50, def: 50, spd: 50 }
      }]);
      if (dropError) throw dropError;

      const { error: bossError = null } = await supabase.from('bosses').insert([{
        name: bName, hp: parseInt(bHp) || 1500, atk: parseInt(bAtk) || 100, def: parseInt(bDef) || 50,
        element: bElement, image_url: finalBossImageUrl, trigger_campaign_id: campData.id
      }]);
      if (bossError) throw bossError;

      alert('ボスとドロップカードをマップに配置しました！');
      fetchBosses();
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  const handleSendAnnouncement = async () => {
    if (!annTitle || !annBody) return alert('タイトルと本文を入力してください');
    setActionLoading(true);
    try {
      const targetCriteria = { gender: targetGender, age: targetAge, location: targetLocation };
      const { error } = await supabase.from('messages').insert([{ 
        sender_id: 'SYSTEM', 
        text: `📢【運営よりお知らせ】\n${annTitle}\n\n${annBody}\n\n(※対象: ${targetGender}/${targetAge}${targetLocation ? '/'+targetLocation : ''})`,
        metadata: targetCriteria
      }]);
      if (error) throw error;
      alert('お知らせを配信しました！');
      setAnnTitle(''); setAnnBody(''); setTargetLocation('');
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  const handleAddMaster = async (type: 'element' | 'rarity') => {
    setActionLoading(true);
    try {
      if (type === 'element') {
        if (!newElement) return;
        const updated = [...elementsList, newElement];
        await supabase.from('system_config').upsert({ id: 'elements', config_data: { list: updated } });
        setElementsList(updated); setNewElement('');
        alert(`「${newElement}」を属性に追加しました！`);
      } else {
        if (!newRarity) return;
        const updated = [...raritiesList, newRarity];
        await supabase.from('system_config').upsert({ id: 'rarities', config_data: { list: updated } });
        setRaritiesList(updated); setNewRarity('');
        alert(`「${newRarity}」をレアリティに追加しました！`);
      }
    } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
  };

  // 門番チェック中はローディングアニメーションを表示
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white">
        <p className="font-bold text-sm tracking-widest animate-pulse">セキュリティ関門を検証中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900 tracking-wide">COMMAND CENTER</h1>
        <button onClick={handleLogout} className="flex items-center text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 px-3 py-2 rounded-xl transition-colors">
          <LogOut size={14} className="mr-1" /> 司令部から離脱
        </button>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto px-6 py-3 bg-white border-b border-slate-200 mb-6 gap-2">
        {[
          { id: 'analytics', icon: <BarChart3 size={18} />, label: '分析' },
          { id: 'users', icon: <Users size={18} />, label: 'ユーザー' },
          { id: 'ugc', icon: <Layers size={18} />, label: 'UGC管理' },
          { id: 'mint', icon: <Store size={18} />, label: '生成/ショップ' },
          { id: 'bosses', icon: <ShieldAlert size={18} />, label: 'ボス/マップ' },
          { id: 'announcements', icon: <Bell size={18} />, label: 'お知らせ' },
          { id: 'master', icon: <Database size={18} />, label: 'マスタ拡張' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className="mr-2">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <main className="max-w-5xl mx-auto px-6">
        {/* === 1. 分析 === */}
        {activeTab === 'analytics' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">リアルタイム統計</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'DAU (日間)', val: analyticsData.dau },
                { label: 'MAU (月間)', val: analyticsData.mau },
                { label: '累計発行カード', val: analyticsData.total_posts },
                { label: '累計バトル数', val: analyticsData.total_battles },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 mb-1">{s.label}</p>
                  <p className="text-3xl font-black text-slate-900">{s.val}</p>
                </div>
              ))}
            </div>

            <hr className="border-slate-200 my-8" />
            
            <h2 className="text-xl font-bold text-slate-900 mb-6">ユーザー属性 (デモグラフィック)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-500 mb-3">男女比</p>
                <p className="font-bold text-sm">男性: <span className="text-blue-600">{analyticsData.demographics.males}</span>人</p>
                <p className="font-bold text-sm">女性: <span className="text-pink-600">{analyticsData.demographics.females}</span>人</p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-500 mb-3">年代分布</p>
                <p className="font-bold text-sm">10代以下: {analyticsData.demographics.teens}人</p>
                <p className="font-bold text-sm">20代: {analyticsData.demographics.twenties}人</p>
                <p className="font-bold text-sm">30代: {analyticsData.demographics.thirties}人</p>
                <p className="font-bold text-sm">40代以上: {analyticsData.demographics.overForties}人</p>
              </div>
            </div>

            <button onClick={exportAnalyticsCSV} className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors text-sm">
              <Download size={20} className="mr-2" /> 全データをCSVでエクスポート
            </button>
          </div>
        )}

        {/* === 2. ユーザー === */}
        {activeTab === 'users' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">登録ユーザー一覧</h2>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm">{u.player_name || '名称未設定'} (Lv: {u.player_level || 1})</span>
                      {u.is_banned && <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded">BANNED</span>}
                    </div>
                    <p className="text-xs text-slate-500">勝利: {u.total_wins || 0} | 討伐: {u.boss_defeats || 0} | ID: {u.id.substring(0,8)}...</p>
                  </div>
                  <button 
                    onClick={() => handleToggleBan(u.id, u.is_banned)} 
                    disabled={actionLoading}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${u.is_banned ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    {u.is_banned ? '解除' : 'BAN'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === 3. UGC管理 === */}
        {activeTab === 'ugc' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-2">ユーザー生成カード (UGC) 管理</h2>
            <p className="text-sm text-slate-500 mb-6">不適切なカードを非表示にできます。</p>
            <div className="space-y-3">
              {ugcCards.length === 0 ? <p className="text-center text-slate-400 py-10 text-sm">UGCカードがありません</p> : 
                ugcCards.map(c => (
                <div key={c.id} className="flex items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {c.image_url ? (
                    <img src={c.image_url} alt="card" className="w-12 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-12 h-16 bg-slate-200 flex items-center justify-center rounded-lg"><ImageIcon className="text-slate-400" size={20}/></div>
                  )}
                  <div className="flex-1 ml-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.card_name || '名称不明'}</span>
                      {c.is_hidden && <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded">非表示</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">作成者: {c.profiles?.player_name || c.player_id?.substring(0,8) || '不明'}</p>
                    <p className="text-xs text-slate-500">作成日: {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleHideCard(c.id, c.is_hidden)} 
                    disabled={actionLoading}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${c.is_hidden ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                  >
                    {c.is_hidden ? '表示' : '非表示'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === 4. 生成/ショップ === */}
        {activeTab === 'mint' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">カード生成 ＆ ショップ出品設定</h2>
            
            <div className="flex gap-4 mb-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mintDest" checked={mintDest === 'direct'} onChange={() => {setMintDest('direct'); setShopItemType('single');}} className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-700">特権MINT(直接配布)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mintDest" checked={mintDest === 'shop'} onChange={() => setMintDest('shop')} className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-700">ショップ出品</span>
              </label>
            </div>

            {mintDest === 'shop' && (
              <div className="flex gap-4 mb-6 p-4 bg-slate-50 rounded-xl text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="shopType" checked={shopItemType === 'single'} onChange={() => setShopItemType('single')} className="w-4 h-4" />
                  <span className="font-bold text-slate-700">単体カード</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="shopType" checked={shopItemType === 'pack'} onChange={() => setShopItemType('pack')} className="w-4 h-4" />
                  <span className="font-bold text-slate-700">カードパック (複数枚)</span>
                </label>
              </div>
            )}

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{shopItemType === 'pack' ? 'パック名' : 'カード名'}</label>
                <input type="text" value={cName} onChange={e=>setCName(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="名称を入力" />
              </div>

              {shopItemType === 'single' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">レアリティ</label>
                      <input type="text" value={cRarity} onChange={e=>setCRarity(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="UR" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">属性</label>
                      <input type="text" value={cAttr} onChange={e=>setCAttr(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="火" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ステータス (HP/ATK/DEF/SPD)</label>
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" value={cHp} onChange={e=>setCHp(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="HP" />
                      <input type="number" value={cAtk} onChange={e=>setCAtk(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="ATK" />
                      <input type="number" value={cDef} onChange={e=>setCDef(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="DEF" />
                      <input type="number" value={cSpd} onChange={e=>setCSpd(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="SPD" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">スキル名</label>
                    <input type="text" value={cSkillName} onChange={e=>setCSkillName(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                  </div>
                </>
              )}

              {mintDest === 'shop' && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">価格</label>
                    <input type="number" value={cPrice} onChange={e=>setCPrice(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">在庫数</label>
                    <input type="number" value={cStock} onChange={e=>setCStock(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-2">パッケージ画像</label>
                    <label className="flex flex-col items-center justify-center h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                      {cPackageImage ? <img src={cPackageImage} className="object-cover h-full w-full" alt="pkg" /> : <Upload className="text-slate-400" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCPackageImage)} />
                    </label>
                  </div>
                </div>
              )}

              {shopItemType === 'single' && (
                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2">カードデザイン</label>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={cardGenMode === 'manual'} onChange={()=>setCardGenMode('manual')} className="w-4 h-4"/> <span className="font-bold">画像アップロード</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={cardGenMode === 'ai'} onChange={()=>setCardGenMode('ai')} className="w-4 h-4"/> <span className="font-bold">AI自動生成</span></label>
                  </div>
                  {cardGenMode === 'manual' ? (
                    <label className="flex flex-col items-center justify-center h-40 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                      {cImage ? <img src={cImage} className="object-cover h-full" alt="card" /> : <ImageIcon className="text-slate-400" size={32} />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCImage)} />
                    </label>
                  ) : (
                    <textarea value={cAiPrompt} onChange={e=>setCAiPrompt(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none h-24" placeholder="AIのプロンプトを入力..." />
                  )}
                </div>
              )}
            </div>

            <button onClick={handleMintAction} disabled={actionLoading} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors text-sm">
              {actionLoading ? '処理中...' : (mintDest === 'shop' ? 'ショップに出品する' : '特権カードを配布する')}
            </button>
          </div>
        )}

        {/* === 5. ボス/マップ === */}
        {activeTab === 'bosses' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">マップ・ボス配置</h2>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ボス名</label>
                  <input type="text" value={bName} onChange={e=>setBName(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">協賛名</label>
                  <input type="text" value={bSponsorName} onChange={e=>setBSponsorName(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">属性</label>
                  <input type="text" value={bElement} onChange={e=>setBElement(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HP</label>
                  <input type="number" value={bHp} onChange={e=>setBHp(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ATK</label>
                  <input type="number" value={bAtk} onChange={e=>setBAtk(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">DEF</label>
                  <input type="number" value={bDef} onChange={e=>setBDef(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">緯度</label>
                  <input type="text" value={bLat} onChange={e=>setBLat(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">経度</label>
                  <input type="text" value={bLng} onChange={e=>setBLng(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">半径 (m)</label>
                  <input type="number" value={bRadius} onChange={e=>setBRadius(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">ボスのデザイン</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={bossImageMode === 'upload'} onChange={()=>setBossImageMode('upload')} className="w-4 h-4"/> <span className="font-bold">画像アップロード</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={bossImageMode === 'ai'} onChange={()=>setBossImageMode('ai')} className="w-4 h-4"/> <span className="font-bold">AI自動生成</span></label>
                </div>
                {bossImageMode === 'upload' ? (
                  <label className="flex flex-col items-center justify-center h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                    {bossImageUrl ? <img src={bossImageUrl} className="object-cover h-full" alt="boss" /> : <ImageIcon className="text-slate-400" />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setBossImageUrl)} />
                  </label>
                ) : (
                  <textarea value={bossAiPrompt} onChange={e=>setBossAiPrompt(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none h-20" placeholder="ボスの外見プロンプト..." />
                )}
              </div>

              <hr className="border-slate-200 my-6" />

              <h3 className="text-lg font-bold text-slate-900 mb-4">討伐ドロップカードの設定</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">カード名</label>
                  <input type="text" value={dropCardName} onChange={e=>setDropCardName(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">レアリティ</label>
                  <input type="text" value={dropCardRarity} onChange={e=>setDropCardRarity(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">属性</label>
                  <input type="text" value={dropCardAttr} onChange={e=>setDropCardAttr(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">ドロップカードデザイン</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={dropCardMode === 'upload'} onChange={()=>setDropCardMode('upload')} className="w-4 h-4"/> <span className="font-bold">画像アップロード</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={dropCardMode === 'ai'} onChange={()=>setDropCardMode('ai')} className="w-4 h-4"/> <span className="font-bold">AI自動生成</span></label>
                </div>
                {dropCardMode === 'upload' ? (
                  <label className="flex flex-col items-center justify-center h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                    {dropCardUrl ? <img src={dropCardUrl} className="object-cover h-full" alt="drop" /> : <ImageIcon className="text-slate-400" />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setDropCardUrl)} />
                  </label>
                ) : (
                  <textarea value={dropCardPrompt} onChange={e=>setDropCardPrompt(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none h-20" placeholder="報酬カードのプロンプト..." />
                )}
              </div>
            </div>
            <button onClick={handleCreateBoss} disabled={actionLoading} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors text-sm">
              {actionLoading ? '配置中...' : 'ボスと報酬カードを配置'}
            </button>
          </div>
        )}

        {/* === 6. お知らせ === */}
        {activeTab === 'announcements' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">お知らせ配信 (セグメント指定)</h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">配信ターゲット: 性別</label>
                <div className="flex gap-2">
                  {['ALL', 'MALE', 'FEMALE'].map(g => (
                    <button key={g} onClick={()=>setTargetGender(g)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${targetGender === g ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{g === 'ALL' ? '全員' : g === 'MALE' ? '男性のみ' : '女性のみ'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">配信ターゲット: 年代</label>
                <div className="flex flex-wrap gap-2">
                  {['ALL', 'TEENS', 'TWENTIES', 'THIRTIES'].map(a => (
                    <button key={a} onClick={()=>setTargetAge(a)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${targetAge === a ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{a === 'ALL' ? '全年代' : a === 'TEENS' ? '10代' : a === 'TWENTIES' ? '20代' : '30代以上'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">配信ターゲット: 所属地域 (空欄で全国)</label>
                <input type="text" value={targetLocation} onChange={e=>setTargetLocation(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" placeholder="例: 関東" />
              </div>
              
              <hr className="border-slate-200 my-6" />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">お知らせタイトル</label>
                <input type="text" value={annTitle} onChange={e=>setAnnTitle(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">お知らせ本文</label>
                <textarea value={annBody} onChange={e=>setAnnBody(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl outline-none h-32" />
              </div>
            </div>
            <button onClick={handleSendAnnouncement} disabled={actionLoading} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors text-sm">
              {actionLoading ? '配信中...' : 'この条件でセグメント配信'}
            </button>
          </div>
        )}

        {/* === 7. マスタ拡張 === */}
        {activeTab === 'master' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">データベース拡張 (属性 / レアリティ)</h2>
            <div className="space-y-6 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">現在の属性一覧</label>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-600 font-medium text-xs border border-slate-200">{elementsList.join(' / ')}</p>
                <div className="flex gap-2 mt-2">
                  <input type="text" value={newElement} onChange={e=>setNewElement(e.target.value)} className="flex-1 bg-slate-100 p-3 rounded-xl outline-none text-xs" placeholder="新属性を追加 (例: 毒)" />
                  <button onClick={()=>handleAddMaster('element')} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-bold text-xs">追加</button>
                </div>
              </div>
              <hr className="border-slate-200" />
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">現在のレアリティ一覧</label>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-600 font-medium text-xs border border-slate-200">{raritiesList.join(' / ')}</p>
                <div className="flex gap-2 mt-2">
                  <input type="text" value={newRarity} onChange={e=>setNewRarity(e.target.value)} className="flex-1 bg-slate-100 p-3 rounded-xl outline-none text-xs" placeholder="新レアリティを追加 (例: EX)" />
                  <button onClick={()=>handleAddMaster('rarity')} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-bold text-xs">追加</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
