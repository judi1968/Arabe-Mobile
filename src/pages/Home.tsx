import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText
} from '@ionic/react';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState } from 'react';

const Home: React.FC = () => {

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      try {
        
        const pos = await Geolocation.getCurrentPosition();
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      } catch (err: any) {
        console.error('Erreur géolocalisation :', err);
        setError('Impossible de récupérer la position GPS. Veuillez vérifier les permissions ou la connexion.');
      }
    };

    loadLocation();
  }, []);

  // Affichage d'erreur si problème
  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Carte</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <IonText color="danger">
            <h2>Erreur</h2>
            <p>{error}</p>
          </IonText>
        </IonContent>
      </IonPage>
    );
  }

  // Chargement
  if (!position) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Carte</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <p>Chargement de la position...</p>
        </IonContent>
      </IonPage>
    );
  }

  // Carte affichée
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: '100vh', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <Marker position={position}>
            <Popup>📍 Vous êtes ici</Popup>
          </Marker>
        </MapContainer>
      </IonContent>
    </IonPage>
  );
};

export default Home;
