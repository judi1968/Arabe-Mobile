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
  IonLabel,
  IonIcon
} from '@ionic/react';

import { Route, Redirect } from 'react-router-dom';
import Home from './Home';
import List from './List';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { useHistory } from 'react-router';
import { home, power } from 'ionicons/icons';
import logo from '../assets/images/logo.jpg'
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
              <IonIcon icon={home}></IonIcon>
              <IonLabel style={{'margin-left': '10px'}}>Accueil</IonLabel>
            </IonItem>
            <IonItem button onClick={deconnexion}>
              <IonIcon icon={power}></IonIcon>
              <IonLabel style={{'margin-left': '10px'}}>Déconnexion</IonLabel>
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
            <IonTitle> <span style={{ 'display' : 'flex' , 'align-items' : 'center'}}> <img src={logo} alt="Logo" style={{ width: 50 }} /><span style={{ 'color' : 'rgb(91, 7, 94)'}}><b>Arabe</b></span> </span></IonTitle>
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
