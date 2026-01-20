import { IonContent, IonList, IonItem, IonLabel, IonButton } from '@ionic/react';

const List: React.FC = () => {
  return (
    <IonContent className="ion-padding">
      <IonList>
        <IonItem>
          <IonLabel>Item 1</IonLabel>
        </IonItem>
        <IonItem>
          <IonLabel>Item 2</IonLabel>
        </IonItem>
      </IonList>

      <IonButton routerLink="/app/home">
        Retour accueil
      </IonButton>
    </IonContent>
  );
};

export default List;
