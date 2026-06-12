// hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

// アプリがフォアグラウンド（起動中）のときの通知挙動設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        saveTokenToSupabase(token);
      }
    });

    // 通知を受信したときのイベントリスナー（アプリ起動中）
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('通知を受信しました:', notification);
    });

    // ユーザーが通知をタップしてアプリを開いたときのイベントリスナー
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('通知がタップされました:', response);
      // 将来的に、特定の画面（お知らせ画面など）へルーティングさせる処理をここに記述可能
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}

// 🔐 通知権限の要求とトークンの取得
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F71',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('通知許可エラー', 'プッシュ通知の権限が拒否されました。設定から変更してください。');
      return;
    }
    
    // Expoのプッシュサーバー用トークンを取得
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
  } else {
    console.log('エミュレータ環境ではプッシュ通知を利用できません。実機でテストしてください。');
  }

  return token;
}

// 💾 取得したトークンを個々のプロファイルに紐付けて保存
async function saveTokenToSupabase(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', user.id);
      
    console.log('Supabaseへプッシュトークンの保存に成功しました');
  } catch (error) {
    console.error('トークン保存エラー:', error);
  }
}