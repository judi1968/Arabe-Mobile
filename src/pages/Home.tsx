import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText,
  IonButton,
  IonAlert,
  IonLoading
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

// Type pour un point personnalisé
interface CustomPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  color?: string;
}

// Composant pour détecter les clics sur la carte
const MapClickHandler: React.FC<{ 
  onMapClick: (lat: number, lng: number) => void 
}> = ({ onMapClick }) => {
  const map = useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Recalcule la taille de la carte pour mobile
const MapAutoResize: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
        map.eachLayer((layer: any) => {
          if (layer instanceof L.TileLayer) {
            layer.redraw();
          }
        });
      }, 150);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [map]);

  return <>{children}</>;
};

// Recentre la carte
const RecenterMap: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      setTimeout(() => {
        map.setView(position, 15, { animate: true });
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
  const [showAddPointAlert, setShowAddPointAlert] = useState(false);
  const [clickedPoint, setClickedPoint] = useState<{lat: number, lng: number} | null>(null);
  const [pointName, setPointName] = useState('');
  const [pointDescription, setPointDescription] = useState('');
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<any>(null);

  const defaultPosition: [number, number] = [48.8566, 2.3522];

  // Créer une icône personnalisée pour les points ajoutés
  const createCustomIcon = (color: string = '#ff4444') => {
    return new L.Icon({
      iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  };

  const loadLocation = async () => {
    setIsLoading(true);
    try {
      let coords: any;

      if (window.navigator && window.navigator.geolocation) {
        coords = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
      } else {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          setError('Permission GPS refusée. Activez le GPS pour voir votre position.');
          setIsLoading(false);
          return;
        }
        coords = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });
      }

      setPosition([coords.coords.latitude, coords.coords.longitude]);
      setError(null);
    } catch (err: any) {
      console.error('Erreur géolocalisation :', err);
      setError('Impossible de récupérer la position GPS. Vérifiez les permissions ou la connexion.');
      setPosition(defaultPosition);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      loadLocation();
    }, 100);
  }, []);

  const forceMapResize = () => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 100);
    }
  };

  const handleRetry = async () => {
    setError(null);
    await loadLocation();
    setTimeout(forceMapResize, 300);
  };

  // Gestion du clic sur la carte
  const handleMapClick = (lat: number, lng: number) => {
    setClickedPoint({ lat, lng });
    setShowAddPointAlert(true);
  };

  // Ajouter un nouveau point
  const addNewPoint = () => {
    if (!clickedPoint || !pointName.trim()) return;

    const newPoint: CustomPoint = {
      id: Date.now().toString(),
      lat: clickedPoint.lat,
      lng: clickedPoint.lng,
      name: pointName,
      description: pointDescription,
      color: '#3880ff' // Couleur bleue par défaut
    };

    setCustomPoints(prev => [...prev, newPoint]);
    
    // Réinitialiser les champs
    setPointName('');
    setPointDescription('');
    setClickedPoint(null);
    setShowAddPointAlert(false);
  };

  // Supprimer un point
  const deletePoint = (id: string) => {
    setCustomPoints(prev => prev.filter(point => point.id !== id));
  };

  return (
    <IonPage style={{ height: '100vh' }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte Interactive</IonTitle>
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
            whenReady={() => {
              if (mapRef.current) {
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

            {/* Marqueur de position actuelle */}
            {position && (
              <>
                <Marker position={position}>
                  <Popup>
                    <strong>📍 Votre position actuelle</strong><br />
                    Latitude: {position[0].toFixed(6)}<br />
                    Longitude: {position[1].toFixed(6)}
                  </Popup>
                </Marker>
                <RecenterMap position={position} />
              </>
            )}

            {/* Points personnalisés */}
            {customPoints.map(point => (
              <Marker 
                key={point.id} 
                position={[point.lat, point.lng]}
                icon={createCustomIcon(point.color)}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <strong>{point.name}</strong><br />
                    <small>
                      Lat: {point.lat.toFixed(6)}<br />
                      Lng: {point.lng.toFixed(6)}
                    </small>
                    {point.description && (
                      <>
                        <hr style={{ margin: '8px 0' }} />
                        <p>{point.description}</p>
                      </>
                    )}
                    <div style={{ marginTop: '10px' }}>
                      <IonButton 
                        size="small" 
                        color="danger"
                        onClick={() => deletePoint(point.id)}
                      >
                        Supprimer
                      </IonButton>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Gestionnaire de clics sur la carte */}
            <MapClickHandler onMapClick={handleMapClick} />

            <MapAutoResize children={undefined} />
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
              </>
            )}
            
            {!error && !position && isLoading && (
              <div style={{ padding: '20px' }}>
                <p style={{ margin: '0 0 15px 0' }}>Chargement de la position...</p>
              </div>
            )}
          </div>

          {/* Boutons flottants */}
          <div
            style={{
              position: 'absolute',
              top: '70px',
              right: '20px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <IonButton 
              onClick={forceMapResize}
              size="small"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                '--background': '#3880ff'
              }}
              title="Redimensionner la carte"
            >
              ↻
            </IonButton>

            <IonButton 
              onClick={() => setPosition(position || defaultPosition)}
              size="small"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                '--background': '#10dc60'
              }}
              title="Recentrer sur ma position"
            >
              📍
            </IonButton>

            <IonButton 
              onClick={() => {
                if (position) {
                  setClickedPoint({ lat: position[0], lng: position[1] });
                  setShowAddPointAlert(true);
                }
              }}
              size="small"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                '--background': '#ffcc00'
              }}
              title="Ajouter un point à ma position"
              disabled={!position}
            >
              ➕
            </IonButton>
          </div>

          {/* Panneau des points ajoutés */}
          {customPoints.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '10px',
                padding: '15px',
                maxWidth: '300px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                Points ajoutés ({customPoints.length})
              </h4>
              {customPoints.map(point => (
                <div 
                  key={point.id} 
                  style={{ 
                    marginBottom: '8px', 
                    padding: '8px', 
                    backgroundColor: '#f8f9fa',
                    borderRadius: '5px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{point.name}</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>
                    {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </IonContent>

      {/* Alert pour ajouter un point */}
      <IonAlert
        isOpen={showAddPointAlert}
        onDidDismiss={() => {
          setShowAddPointAlert(false);
          setClickedPoint(null);
        }}
        header="Ajouter un point"
        subHeader={clickedPoint ? 
          `Latitude: ${clickedPoint.lat.toFixed(6)}\nLongitude: ${clickedPoint.lng.toFixed(6)}` : 
          ''
        }
        message="Renseignez les informations du point"
        inputs={[
          {
            name: 'name',
            type: 'text',
            placeholder: 'Nom du point *',
            value: pointName,
            handler: (input) => {
              setPointName(input.value || '');
            },
            attributes: {
              required: true
            }
          },
          {
            name: 'description',
            type: 'textarea',
            placeholder: 'Description (optionnel)',
            value: pointDescription,
            handler: (input) => {
              setPointDescription(input.value || '');
            }
          }
        ]}
        buttons={[
          {
            text: 'Annuler',
            role: 'cancel',
            handler: () => {
              setPointName('');
              setPointDescription('');
            }
          },
          {
            text: 'Ajouter',
            handler: (data) => {
              if (!data.name.trim()) {
                alert('Le nom du point est requis');
                return false;
              }
              setPointName(data.name);
              setPointDescription(data.description || '');
              setTimeout(addNewPoint, 50);
              return true;
            }
          }
        ]}
      />

      <IonLoading
        isOpen={isLoading}
        message={'Chargement de votre position...'}
      />
    </IonPage>
  );
};

export default Home;