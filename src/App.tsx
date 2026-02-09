import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect } from 'react';

import Login from './pages/Login';
import AppLayout from './pages/AppLayout';
import { initializePushNotifications } from './services/notificationService';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';

import 'leaflet/dist/leaflet.css';
import './theme/variables.css';

import L from 'leaflet';

setupIonicReact();

// Fix icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const App: React.FC = () => {
  useEffect(() => {
    // Initialiser les notifications push au démarrage
    initializePushNotifications().catch((err) => {
      console.error('Failed to initialize push notifications:', err);
    });
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>

          {/* Login */}
          <Route exact path="/login" component={Login} />

          {/* App avec menu */}
          <Route path="/app" component={AppLayout} />

          {/* Redirection par défaut */}
          <Route exact path="/">
            <Redirect to="/login" />
          </Route>

        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
