import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent
} from '@ionic/react';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState } from 'react';

const Home: React.FC = () => {

  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      const pos = await Geolocation.getCurrentPosition();
      setPosition([pos.coords.latitude, pos.coords.longitude]);
    };

    loadLocation();
  }, []);

  if (!position) {
    return <IonPage><IonContent>Chargement...</IonContent></IonPage>;
  }

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
