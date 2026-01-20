import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText,
  IonButton
} from '@ionic/react';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState } from 'react';

const Home: React.FC = () => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Position par défaut si GPS indisponible
  const defaultPosition: [number, number] = [0, 0]; // centre du monde

  const loadLocation = async () => {
    try {
      let coords: any;

      if (window.navigator && window.navigator.geolocation) {
        // WEB
        coords = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      } else {
        // MOBILE (Capacitor)
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          setError('Permission GPS refusée. Activez le GPS pour voir votre position.');
          return;
        }
        coords = await Geolocation.getCurrentPosition();
      }

      setPosition([coords.coords.latitude, coords.coords.longitude]);
      setError(null);
    } catch (err: any) {
      console.error('Erreur géolocalisation :', err);
      setError('Impossible de récupérer la position GPS. Vérifiez les permissions ou la connexion.');
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Cartes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Carte toujours visible */}
        <MapContainer
          center={position ?? defaultPosition}
          zoom={position ? 15 : 2}
          style={{ height: '100vh', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {position && (
            <Marker position={position}>
              <Popup>📍 Vous êtes ici</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Overlay pour erreur / chargement */}
        {(error || !position) && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '16px',
              backgroundColor: 'rgba(255,255,255,0.85)',
              zIndex: 1000,
              textAlign: 'center',
            }}
          >
            {error && (
              <>
                <IonText color="danger">
                  <p>{error}</p>
                </IonText>
                <IonButton onClick={loadLocation}>Réessayer</IonButton>
              </>
            )}
            {!error && !position && <p>Chargement de la position...</p>}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Home;
