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

const AppLayout: React.FC = () => {
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
              <IonLabel>Liste</IonLabel>
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
