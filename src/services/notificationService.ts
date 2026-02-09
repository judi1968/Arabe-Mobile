import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '../firebase/firebaseConfig';

export const initializePushNotifications = async () => {
  try {
    // Demander la permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      // Enregistrer le device avec Firebase
      await PushNotifications.register();
      
      // Obtenir le token FCM
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: 'BO2jKPzwfN3s-yHkiVZkX5qKhAm1g_TZdHz3b0O8ytjKWEMj9I1xCwqw5VPR0s3gVZ0bT-x0RG7_F1z0zQKzfvs',
      });

      console.log('FCM Token:', token);
      await saveFCMToken(token);

      // Écouter les notifications
      setupPushNotificationListeners();
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

const setupPushNotificationListeners = () => {
  // Écouter les notifications en arrière-plan
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
    // Afficher une notification personnalisée si nécessaire
  });

  // Écouter l'action sur la notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
    // Traiter l'action utilisateur
    handleNotificationAction(notification);
  });

  // Écouter les erreurs
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Push registration error:', error);
  });
};

const saveFCMToken = async (token: string) => {
  try {
    // Envoyer le token à votre backend/Firebase Firestore
    // Vous pouvez implémenter cela selon votre architecture
    localStorage.setItem('fcm_token', token);
    console.log('FCM token saved:', token);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};

const handleNotificationAction = (notification: any) => {
  // Traiter l'action sur la notification
  // Par exemple, rediriger vers une page spécifique
  const data = notification.actionId || notification.notification?.data;
  
  if (data) {
    console.log('Handling notification action with data:', data);
    // Vous pouvez ajouter de la logique de navigation ici
  }
};

export const getStoredFCMToken = (): string | null => {
  return localStorage.getItem('fcm_token');
};
