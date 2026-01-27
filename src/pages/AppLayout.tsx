import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRouterOutlet,
  IonMenu,
  IonButtons,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel
} from '@ionic/react';

import { Route, Redirect } from 'react-router-dom';
import Home from './Home';
import List from './List';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { useHistory } from 'react-router';

const AppLayout: React.FC = () => {
  const history = useHistory();


    const deconnexion = async () => {
    try {
    await signOut(auth); 
    history.replace('/login'); 
    } catch (e) {
    console.error('Erreur de déconnexion', e);
    }
    };
  return (
    <>
      {/* MENU GLOBAL */}
      <IonMenu contentId="main-content">
        <IonHeader>
          <IonToolbar color="tertiary">
            <IonTitle>Menu</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <IonList>
            <IonItem routerLink="/app/home">
              <IonLabel>Accueil</IonLabel>
            </IonItem>
            <IonItem routerLink="/app/list">
              <IonLabel>Mes signalements</IonLabel>
            </IonItem>
            <IonItem routerLink="/app/list">
              <IonLabel>Tableau recapitulatif</IonLabel>
            </IonItem>
            <IonItem button onClick={deconnexion}>
              <IonLabel>Déconnexion</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>

      {/* LAYOUT PRINCIPAL */}
      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton />
            </IonButtons>
            <IonTitle>Arabe</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <IonRouterOutlet>

            <Route exact path="/app">
              <Redirect to="/app/home" />
            </Route>

            <Route path="/app/home" component={Home} />
            <Route path="/app/list" component={List} />

          </IonRouterOutlet>
        </IonContent>
      </IonPage>
    </>
  );
};

export default AppLayout;
