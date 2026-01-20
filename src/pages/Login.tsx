import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonIcon
} from '@ionic/react';

import { personOutline, lockClosedOutline } from 'ionicons/icons';
import './assets/css/Login.css';

const Login: React.FC = () => {
  return (
    <IonPage className="login-container">
      <IonContent fullscreen >

        <div className="login-card">
          <IonText className="login-title">
            <h1><i>ARABE</i></h1>
            <p>Connection</p>
          </IonText>

          <div className="input-group">
            <IonIcon icon={personOutline} />
            <IonInput placeholder="Nom d'utilisateur" />
          </div>

          <div className="input-group">
            <IonIcon icon={lockClosedOutline} />
            <IonInput type="password" placeholder="Mot de passe" />
          </div>

          <IonButton expand="block" routerLink="/app/list" className="login-button">
            Se connecter
          </IonButton>
        </div>

      </IonContent>
    </IonPage>
  );
};


export default Login;