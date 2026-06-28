import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';

export default function EventsScreen() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ページネーション用のステート
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // モーダル（詳細表示）用のステート
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const fetchEvents = async () => {
    setLoading(true);
    setCurrentPage(1); // データ再取得時に1ページ目に戻す

    try {
      // 1. ユーザー情報を取得
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return;
      }

      // 2. ユーザーのプロフィール（性別、年齢、地域）を取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, location')
        .eq('id', user.id)
        .maybeSingle();

      // 3. announcements テーブルからお知らせを取得
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('お知らせの取得に失敗しました:', error);
        return;
      }

      if (data) {
        // 4. ユーザーの属性に合わせてお知らせをフィルタリング
        const filteredData = data.filter((ann: any) => {
          if (!profile) {
            return ann.target_gender === 'ALL' && ann.target_age === 'ALL' && (!ann.target_location || ann.target_location === '');
          }

          if (ann.target_gender && ann.target_gender !== 'ALL') {
            const isMale = profile.gender === 'male' || profile.gender === '男性';
            const isFemale = profile.gender === 'female' || profile.gender === '女性';
            if (ann.target_gender === 'MALE' && !isMale) return false;
            if (ann.target_gender === 'FEMALE' && !isFemale) return false;
          }

          if (ann.target_age && ann.target_age !== 'ALL') {
            const age = parseInt(profile.age) || 0;
            if (ann.target_age === 'TEENS' && !(age > 0 && age < 20)) return false;
            if (ann.target_age === 'TWENTIES' && !(age >= 20 && age < 30)) return false;
            if (ann.target_age === 'THIRTIES' && !(age >= 30)) return false;
          }

          if (ann.target_location && ann.target_location !== '') {
            if (!profile.location || !profile.location.includes(ann.target_location)) return false;
          }

          return true;
        });

        setAllEvents(filteredData);
      }
    } catch (err) {
      console.log('お知らせ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // お知らせタップ時の処理
  const handleEventPress = (item: any) => {
    setSelectedEvent(item);
    setModalVisible(true);
  };

  // モーダルを閉じる処理
  const closeModal = () => {
    setModalVisible(false);
    setSelectedEvent(null);
  };

  // 一覧の各アイテム（タイトルのみ表示）
  const renderEvent = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => handleEventPress(item)} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('ja-JP')}</Text>
      </View>
    </TouchableOpacity>
  );

  // ページネーションの計算
  const displayEvents = allEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(allEvents.length / ITEMS_PER_PAGE);

  // リスト最下部のページネーションボタン
  const renderPagination = () => {
    if (allEvents.length <= ITEMS_PER_PAGE) return null;

    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
          disabled={currentPage === 1}
          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        >
          <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>前へ</Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>{currentPage} / {totalPages}</Text>

        <TouchableOpacity 
          style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
          disabled={currentPage === totalPages}
          onPress={() => setCurrentPage(prev => Math.min(Normally I can help with things like this, but I don't seem to have access to that content. You can try again or ask me for something else.