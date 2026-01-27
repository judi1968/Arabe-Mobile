import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonIcon,
  IonLoading
} from '@ionic/react';

import { personOutline, lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useHistory } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

import './assets/css/Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('test@gmail.com');
  const [motDePasse, setMotDePasse] = useState('test1234');
  const [erreur, setErreur] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const history = useHistory();

  const connecter = async () => {
    setErreur('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, motDePasse);
      history.push('/app/home');
    } catch (e: any) {
      setErreur('Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonPage className="login-container">
      <IonContent fullscreen className="ion-padding">

        <div className="login-card">
          <IonText className="login-title">
            <h1><i>ARABE</i></h1>
            <p>Connexion</p>
          </IonText>

          {erreur && <IonText color="danger">{erreur}</IonText>}

          {/* EMAIL */}
          <div className="input-group">
            <IonIcon icon={personOutline} />
            <IonInput
              placeholder="Email"
              type="email"
              value={email}
              onIonInput={e => setEmail(e.detail.value!)}
              style={{ flex: 1 }}
            />
          </div>

          {/* MOT DE PASSE */}
          <div className="input-group">
            <IonIcon icon={lockClosedOutline} />
            <IonInput
              placeholder="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              value={motDePasse}
              onIonInput={e => setMotDePasse(e.detail.value!)}
              style={{ flex: 1 }}
            />
            <IonIcon
              icon={showPassword ? eyeOffOutline : eyeOutline}
              className="eye-icon"
              onClick={() => setShowPassword(!showPassword)}
              style={{ cursor: 'pointer' }}
            />
          </div>

          <IonButton
            expand="block"
            className="login-button"
            onClick={connecter}
            disabled={isLoading}
          >
            Se connecter
          </IonButton>
        </div>

        <IonLoading
          isOpen={isLoading}
          message={'Connexion en cours...'}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;