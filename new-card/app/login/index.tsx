"use client";

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function WebLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('入力してください');
    setLoading(false);
    setLoading(true);

    try {
      // 1. Supabase Authでログイン
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. profiles テーブルからロール（権限）を確認
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profileError) throw profileError;

        // 3. 管理者でなければ即座にログアウトさせて拒否
        if (profile?.role !== 'admin') {
          await supabase.auth.signOut();
          alert('アクセス権限がありません。運営管理者アカウントのみログイン可能です。');
          return;
        }

        // 管理者ならダッシュボードへ
        router.push('/');
      }
    } catch (err: any) {
      alert(`ログイン失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 text-white">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
        <h1 className="text-3xl font-black text-center tracking-wider mb-2">VOID CARD</h1>
        <p className="text-xs text-slate-400 text-center font-bold mb-8">COMMAND CENTER LOG-IN</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">管理者メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">パスワード</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors text-sm mt-6 shadow-lg shadow-blue-600/20">
            {loading ? '認証を検証中...' : 'マスターゲートを開放'}
          </button>
        </form>
      </div>
    </div>
  );
}
