import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText,
  IonButton
} from '@ionic/react';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correction des icônes par défaut Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Composant pour forcer Leaflet à recalculer la taille
const MapAutoResize: React.FC = ({ children }: any) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return <>{children}</>;
};

// Composant pour centrer et zoomer la carte sur l’utilisateur
const RecenterMap: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15, { animate: true });
  }, [position, map]);
  return null;
};

const Home: React.FC = () => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultPosition: [number, number] = [0, 0]; // fallback si GPS indisponible

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
    <IonPage style={{ height: '100%' }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ height: '100%' }}>
        {/* Carte toujours présente */}
        <MapContainer
          center={position ?? defaultPosition}
          zoom={position ? 15 : 2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {position && (
            <>
              <Marker position={position}>
                <Popup>📍 Vous êtes ici</Popup>
              </Marker>
              <RecenterMap position={position} />
            </>
          )}

          <MapAutoResize />
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
