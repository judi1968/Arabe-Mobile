import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText,
  IonButton
} from '@ionic/react';

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correction des icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Recalcule la taille de la carte pour mobile et redraw des tuiles
const MapAutoResize: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleResize = () => {
      // Délai pour s'assurer que le DOM est mis à jour
      setTimeout(() => {
        map.invalidateSize();
        
        // Redessiner toutes les couches
        map.eachLayer((layer: any) => {
          if (layer instanceof L.TileLayer) {
            layer.redraw();
          }
        });
        
        // Recentrer légèrement pour forcer le rendu
        const center = map.getCenter();
        map.setView(center, map.getZoom());
      }, 150);
    };

    // Exécuter immédiatement
    handleResize();

    // Écouter les événements de redimensionnement
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [map]);

  return <>{children}</>;
};

// Composant pour initialiser la carte correctement
const MapInit: React.FC = () => {
  const map = useMapEvents({
    load: () => {
      console.log('Carte chargée - initialisation');
      setTimeout(() => {
        map.invalidateSize();
        // Forcer un rendu des tuiles
        const center = map.getCenter();
        map.setView(center, map.getZoom(), { animate: false });
      }, 250);
    },
  });
  return null;
};

// Recentre la carte sur la position utilisateur
const RecenterMap: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      // Petit délai pour s'assurer que la carte est prête
      setTimeout(() => {
        map.setView(position, 15, { animate: true });
        // Forcer un redessin après recentrage
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      }, 200);
    }
  }, [position, map]);
  
  return null;
};

const Home: React.FC = () => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<any>(null);

  const defaultPosition: [number, number] = [48.8566, 2.3522]; // Paris comme fallback

  const loadLocation = async () => {
    try {
      let coords: any;

      if (window.navigator && window.navigator.geolocation) {
        // Web fallback
        coords = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
      } else {
        // Mobile Capacitor
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          setError('Permission GPS refusée. Activez le GPS pour voir votre position.');
          return;
        }
        coords = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });
      }

      const newPosition: [number, number] = [coords.coords.latitude, coords.coords.longitude];
      setPosition(newPosition);
      setError(null);
      
      // Marquer la carte comme prête
      setIsMapReady(true);
      
    } catch (err: any) {
      console.error('Erreur géolocalisation :', err);
      setError('Impossible de récupérer la position GPS. Vérifiez les permissions ou la connexion.');
      setPosition(defaultPosition);
      setIsMapReady(true);
    }
  };

  useEffect(() => {
    // Attendre que le composant soit monté
    setTimeout(() => {
      loadLocation();
    }, 100);
  }, []);

  // Fonction pour forcer le redimensionnement de la carte
  const forceMapResize = () => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 100);
    }
  };

  // Gérer le clic sur le bouton réessayer
  const handleRetry = async () => {
    setError(null);
    await loadLocation();
    // Redimensionner après chargement
    setTimeout(forceMapResize, 300);
  };

  return (
    <IonPage style={{ height: '100vh' }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent 
        fullscreen 
        style={{ 
          '--background': 'transparent',
          height: '100%'
        }}
      >
        <div style={{ 
          height: '100%', 
          width: '100%', 
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Carte */}
          <MapContainer
            ref={mapRef}
            center={position || defaultPosition}
            zoom={position ? 15 : 12}
            maxZoom={19}
            minZoom={2}
            style={{ 
              height: '100%', 
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1
            }}
            whenReady={() => {  // Changé de whenCreated à whenReady
              if (mapRef.current) {
                // Forcer un redimensionnement après création
                setTimeout(() => {
                  mapRef.current.invalidateSize();
                }, 200);
              }
            }}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            zoomControl={true}
          >
            {/* TileLayer */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c']}
              crossOrigin="anonymous"
              maxZoom={19}
              minZoom={2}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              updateWhenIdle={true}
              keepBuffer={2}
            />

            {position && (
              <>
                <Marker position={position}>
                  <Popup>📍 Vous êtes ici</Popup>
                </Marker>
                <RecenterMap position={position} />
              </>
            )}

            <MapAutoResize children={undefined} />
            <MapInit />
          </MapContainer>

          {/* Overlay pour erreur / chargement */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              zIndex: 1000,
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              borderBottom: '1px solid #eee',
              display: error || !position ? 'block' : 'none'
            }}
          >
            {error && (
              <>
                <IonText color="danger">
                  <p style={{ margin: '0 0 15px 0' }}>{error}</p>
                </IonText>
                <IonButton onClick={handleRetry} expand="block">
                  Réessayer la géolocalisation
                </IonButton>
                <IonButton 
                  onClick={forceMapResize} 
                  expand="block" 
                  fill="outline"
                  style={{ marginTop: '10px' }}
                >
                  Redimensionner la carte
                </IonButton>
              </>
            )}
            
            {!error && !position && (
              <div style={{ padding: '20px' }}>
                <p style={{ margin: '0 0 15px 0' }}>Chargement de la position...</p>
                <IonButton onClick={loadLocation} expand="block">
                  Forcer le chargement
                </IonButton>
              </div>
            )}
          </div>

          {/* Bouton flottant pour recharger la carte */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 1000
            }}
          >
            <IonButton 
              onClick={forceMapResize}
              size="small"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                '--background': '#3880ff',
                '--background-activated': '#3171e0'
              }}
            >
              ↻
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;