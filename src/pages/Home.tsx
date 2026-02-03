import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonText,
  IonButton,
  IonAlert,
  IonLoading,
  IonToast,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import { 
  refreshOutline, 
  locationOutline, 
  addOutline, 
  logOutOutline, 
  saveOutline,
  filterOutline,
  personOutline,
  peopleOutline,
  informationCircleOutline,
  calendarOutline,
  cashOutline,
  businessOutline,
  speedometerOutline
} from 'ionicons/icons';

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Import Firebase
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  GeoPoint,
  where
} from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

// Initialiser Firestore
const db = getFirestore();

// Correction des icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Type pour un signalement
interface Signalement {
  id: string;
  titre: string;
  description: string;
  position: { latitude: number; longitude: number };
  date_creation: any;
  statut: number; // 1: Nouveau, 2: En cours, 3: Résolu
  surface_m2: number | null;
  budget: number | null;
  avancement: number;
  entreprise_responsable: string;
  utilisateur_id: string;
  userEmail: string;
  synchronise_firebase: boolean;
}

// Type pour une entreprise
interface Entreprise {
  id: string;
  nom: string;
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
  const [showSignalementForm, setShowSignalementForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSignalement, setSelectedSignalement] = useState<Signalement | null>(null);
  const [clickedPoint, setClickedPoint] = useState<{lat: number, lng: number} | null>(null);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [filteredSignalements, setFilteredSignalements] = useState<Signalement[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'mine'>('all'); // 'all' ou 'mine'
  
  // Champs du formulaire de signalement
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatut, setFormStatut] = useState<number>(1);
  const [formSurface, setFormSurface] = useState<string>('');
  const [formBudget, setFormBudget] = useState<string>('0');
  const [formAvancement, setFormAvancement] = useState<string>('0');
  const [formEntreprise, setFormEntreprise] = useState(null);
  
  const mapRef = useRef<any>(null);
  const history = useHistory();

  const defaultPosition: [number, number] = [-18.8792, 47.5079]; // Antananarivo

  // Créer une icône personnalisée pour les signalements
  const createSignalementIcon = (statut: number, isMine: boolean = false) => {
  let color = '#ff4444'; // Rouge par défaut (Nouveau)
  
  if (statut === 2) color = '#ffcc00'; // Jaune (En cours)
  if (statut === 3) color = '#10dc60'; // Vert (Résolu)
  
  // Encoder correctement le SVG
  const svgToUrl = (svg: string) => {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  
  // SVG pour les signalements normaux (pin classique)
  const normalSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>`;
  
  // SVG pour mes signalements (cercle avec bordure)
  const mineSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="#3880ff" stroke-width="3"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`;
  
  const svgContent = isMine ? mineSVG : normalSVG;
  const size = isMine ? 28 : 24;
  const anchor = isMine ? 14 : 12;
  
  return new L.Icon({
    iconUrl: svgToUrl(svgContent),
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, -size],
  });
};

  // Charger les entreprises depuis Firebase
  useEffect(() => {
    if (auth.currentUser) {
      const user = auth.currentUser;
      setUserEmail(user.email || '');
      setUserId(user.uid);
      
      // Charger les entreprises
      const entreprisesRef = collection(db, "entreprises");
      const entreprisesQuery = query(entreprisesRef);
      
      const unsubscribeEntreprises = onSnapshot(entreprisesQuery, (snapshot) => {
        const entreprisesList: Entreprise[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          entreprisesList.push({
            id: doc.id,
            nom: data.nom
          });
        });
        setEntreprises(entreprisesList);
        
        
      });
      
      // Charger TOUS les signalements
      const signalementsRef = collection(db, "signalements");
      const signalementsQuery = query(signalementsRef, orderBy("date_creation", "desc"));
      
      const unsubscribeSignalements = onSnapshot(signalementsQuery, (snapshot) => {
        const signalementsList: Signalement[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          signalementsList.push({
            id: doc.id,
            titre: data.titre,
            description: data.description,
            position: data.position,
            date_creation: data.date_creation,
            statut: data.statut,
            surface_m2: data.surface_m2,
            budget: data.budget,
            avancement: data.avancement,
            entreprise_responsable: data.entreprise_responsable,
            utilisateur_id: data.utilisateur_id,
            userEmail: data.userEmail,
            synchronise_firebase: data.synchronise_firebase
          });
        });
        setSignalements(signalementsList);
        // Par défaut, afficher tous les signalements
        setFilteredSignalements(signalementsList);
      }, (error) => {
        console.error("Erreur lors du chargement:", error);
        setToastMessage("Erreur de chargement des données");
        setShowToast(true);
      });

      // Nettoyer les écouteurs
      return () => {
        unsubscribeEntreprises();
      };
    }
  }, []);

  // Filtrer les signalements quand le type de filtre change
  useEffect(() => {
    if (filterType === 'mine' && userId) {
      // Filtrer pour n'afficher que mes signalements
      const mesSignalements = signalements.filter(s => s.utilisateur_id === userId);
      setFilteredSignalements(mesSignalements);
    } else {
      // Afficher tous les signalements
      setFilteredSignalements(signalements);
    }
  }, [filterType, signalements, userId]);

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
          setError('Permission GPS refusée.');
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
      console.error('Erreur géolocalisation:', err);
      setError('Impossible de récupérer la position GPS.');
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
    setShowSignalementForm(true);
  };

  // Gestion du clic sur un signalement
  const handleSignalementClick = (signalement: Signalement) => {
    setSelectedSignalement(signalement);
    setShowDetailModal(true);
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormTitre('');
    setFormDescription('');
    setFormStatut(1);
    setFormSurface('');
    setFormBudget('');
    setFormAvancement('0');
    setFormEntreprise(null)
  };

  // Ajouter un nouveau signalement dans Firebase
  const ajouterSignalement = async () => {
    if (!clickedPoint || !formTitre.trim()) {
      setToastMessage("Le titre est obligatoire");
      setShowToast(true);
      return;
    }
    
    if (!auth.currentUser) {
      setToastMessage("Vous devez être connecté");
      setShowToast(true);
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      
      // Préparer les données du signalement
      const signalementData = {
        titre: formTitre.trim(),
        description: formDescription.trim(),
        position: new GeoPoint(clickedPoint.lat, clickedPoint.lng),
        date_creation: serverTimestamp(),
        statut: formStatut,
        surface_m2: formSurface ? parseFloat(formSurface) : null,
        budget: formBudget ? parseFloat(formBudget) : null,
        avancement: parseInt(formAvancement) || 0,
        entreprise_responsable: formEntreprise,
        utilisateur_id: user.uid,
        userEmail: user.email || '',
        synchronise_firebase: true
      };

      console.log("Envoi du signalement:", signalementData);
      
      // Ajouter le document dans la collection "signalements"
      const docRef = await addDoc(collection(db, "signalements"), signalementData);
      
      console.log("✅ Signalement ajouté avec ID:", docRef.id);
      
      // Afficher un message de succès
      setToastMessage("Signalement enregistré avec succès!");
      setShowToast(true);
      
      // Réinitialiser et fermer
      resetForm();
      setClickedPoint(null);
      setShowSignalementForm(false);
      
    } catch (error: any) {
      console.error("❌ Erreur lors de l'ajout:", error);
      setToastMessage(`Erreur: ${error.message}`);
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer un signalement
  const supprimerSignalement = async (id: string) => {
    if (!auth.currentUser) {
      setToastMessage("Vous devez être connecté");
      setShowToast(true);
      return;
    }

    try {
      await deleteDoc(doc(db, "signalements", id));
      setToastMessage("Signalement supprimé");
      setShowToast(true);
      setShowDetailModal(false);
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      setToastMessage(`Erreur: ${error.message}`);
      setShowToast(true);
    }
  };

  // Déconnexion
  const handleLogout = async () => {
    try {
      await signOut(auth);
      history.push('/');
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  // Obtenir le texte du statut
  const getStatutText = (statut: number) => {
    switch(statut) {
      case 1: return "Nouveau";
      case 2: return "En cours";
      case 3: return "Résolu";
      default: return "Inconnu";
    }
  };

  // Obtenir la couleur du statut
  const getStatutColor = (statut: number) => {
    switch(statut) {
      case 1: return "danger";
      case 2: return "warning";
      case 3: return "success";
      default: return "medium";
    }
  };

  // Formater la date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Date inconnue";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Date inconnue";
    }
  };

  return (
    <IonPage style={{ height: '100vh' }}>
      <IonHeader>
        <IonToolbar>
          {/* Sélecteur de filtre */}
          {/* <div style={{
            position: 'absolute',
            top: '70px',
            left: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: '10px',
            padding: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            minWidth: '180px'
          }}> */}
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IonIcon icon={filterOutline} />
              Filtre des signalements
            </div>
            
            <IonSegment value={filterType} onIonChange={e => setFilterType(e.detail.value as 'all' | 'mine')}>
              <IonSegmentButton value="all" style={{ '--color-checked': '#3880ff' }}>
                <IonIcon icon={peopleOutline} />
                <IonLabel>Tous</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="mine" style={{ '--color-checked': '#10dc60' }}>
                <IonIcon icon={personOutline} />
                <IonLabel>Mes signalements</IonLabel>
              </IonSegmentButton>
            </IonSegment>
            
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              <div>Total: {filteredSignalements.length} signalement(s)</div>
              <div>Nouveaux: {filteredSignalements.filter(s => s.statut === 1).length}</div>
              <div>En cours: {filteredSignalements.filter(s => s.statut === 2).length}</div>
              <div>Résolus: {filteredSignalements.filter(s => s.statut === 3).length}</div>
              {filterType === 'mine' && (
                <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#e6f7ff', borderRadius: '5px' }}>
                  <IonIcon icon={personOutline} size="small" /> {userId ? userEmail : 'Non connecté'}
                </div>
              )}
            </div>
          {/* </div> */}
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': 'transparent' }}>
        <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
          
          {/* Carte */}
          <MapContainer
            ref={mapRef}
            center={position || defaultPosition}
            zoom={position ? 15 : 12}
            maxZoom={19}
            minZoom={2}
            style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
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
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c']}
              crossOrigin="anonymous"
              attribution='&copy; OpenStreetMap'
            />

            {/* Position actuelle */}
            {position && (
              <>
                <Marker position={position}>
                  <Popup>
                    <strong>📍 Votre position actuelle</strong><br />
                    Lat: {position[0].toFixed(6)}<br />
                    Lng: {position[1].toFixed(6)}
                  </Popup>
                </Marker>
                <RecenterMap position={position} />
              </>
            )}

            {/* Signalements filtrés */}
            {filteredSignalements.map(signalement => {
              const isMine = signalement.utilisateur_id === userId;
              return (
                <Marker 
                  key={signalement.id} 
                  position={[signalement.position.latitude, signalement.position.longitude]}
                  icon={createSignalementIcon(signalement.statut, isMine)}
                  eventHandlers={{
                    click: () => handleSignalementClick(signalement)
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '250px', cursor: 'pointer' }}>
                      <strong>{signalement.titre}</strong><br />
                      <small>
                        <IonBadge color={getStatutColor(signalement.statut)}>
                          {getStatutText(signalement.statut)}
                        </IonBadge>
                        {isMine && <IonBadge color="primary" style={{ marginLeft: '5px' }}>Moi</IonBadge>}
                        <br />
                        <strong>Entreprise:</strong> {signalement.entreprise_responsable || 'Pas encore defini'}<br />
                        <strong>Avancement:</strong> {signalement.avancement}%<br />
                        <strong>Par:</strong> {signalement.userEmail}
                      </small>
                      <div style={{ marginTop: '10px' }}>
                        <IonButton size="small" onClick={() => handleSignalementClick(signalement)}>
                          <IonIcon icon={informationCircleOutline} slot="start" />
                          Détails
                        </IonButton>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

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

          

          {/* Boutons FAB */}
          

          {/* Légende */}
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '11px',
            minWidth: '150px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📌 Légende</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ff4444', borderRadius: '50%', marginRight: '5px' }}></div>
              <span>Nouveau</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ffcc00', borderRadius: '50%', marginRight: '5px' }}></div>
              <span>En cours</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#10dc60', borderRadius: '50%', marginRight: '5px' }}></div>
              <span>Résolu</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #eee' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#3880ff', borderRadius: '50%', border: '2px solid #3880ff', marginRight: '5px', position: 'relative' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}></div>
              </div>
              <span>Mes signalements</span>
            </div>
          </div>
        </div>
      </IonContent>

      {/* Modal pour ajouter un signalement */}
      {showSignalementForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '20px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>📋 Nouveau Signalement</h2>
            
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <strong>📍 Position sélectionnée:</strong><br />
              Latitude: {clickedPoint?.lat.toFixed(6)}<br />
              Longitude: {clickedPoint?.lng.toFixed(6)}
            </div>
            
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Titre *</IonLabel>
                <IonInput
                  value={formTitre}
                  onIonChange={e => setFormTitre(e.detail.value || '')}
                  placeholder="Ex: Route endommagée"
                />
              </IonItem>
              
              <IonItem>
                <IonLabel position="stacked">Description</IonLabel>
                <IonTextarea
                  value={formDescription}
                  onIonChange={e => setFormDescription(e.detail.value || '')}
                  placeholder="Décrivez le problème..."
                  rows={3}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Surface (m²)</IonLabel>
                <IonInput
                  type="number"
                  value={formSurface}
                  onIonChange={e => setFormSurface(e.detail.value || '')}
                  placeholder="Ex: 5.5"
                />
              </IonItem>
              
              
            </IonList>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <IonButton 
                expand="block" 
                color="medium" 
                onClick={() => {
                  setShowSignalementForm(false);
                  resetForm();
                }}
              >
                Annuler
              </IonButton>
              
              <IonButton 
                expand="block" 
                color="primary"
                onClick={ajouterSignalement}
                disabled={!formTitre.trim()}
              >
                <IonIcon icon={saveOutline} slot="start" />
                Enregistrer
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détail du signalement */}
      {showDetailModal && selectedSignalement && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '20px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>📄 Détails du Signalement</h2>
              <IonButton 
                fill="clear" 
                size="small" 
                onClick={() => setShowDetailModal(false)}
                style={{ margin: 0 }}
              >
                ✕
              </IonButton>
            </div>
            
            <IonCard style={{ marginBottom: '15px' }}>
              <IonCardHeader>
                <IonCardTitle>{selectedSignalement.titre}</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ marginBottom: '15px' }}>
                  <IonBadge color={getStatutColor(selectedSignalement.statut)} style={{ fontSize: '14px', padding: '5px 10px' }}>
                    {getStatutText(selectedSignalement.statut)}
                  </IonBadge>
                  {selectedSignalement.utilisateur_id === userId && (
                    <IonBadge color="primary" style={{ marginLeft: '10px', fontSize: '14px', padding: '5px 10px' }}>
                      <IonIcon icon={personOutline} /> Mon signalement
                    </IonBadge>
                  )}
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <IonIcon icon={informationCircleOutline} style={{ marginRight: '8px', color: '#666' }} />
                    <strong>Description:</strong>
                  </div>
                  <p style={{ marginLeft: '24px', marginTop: 0 }}>{selectedSignalement.description || "Aucune description"}</p>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <IonIcon icon={businessOutline} style={{ marginRight: '8px', color: '#666' }} />
                    <strong>Entreprise responsable:</strong>
                  </div>
                  <p style={{ marginLeft: '24px', marginTop: 0 }}>{selectedSignalement.entreprise_responsable || 'Pas encore defini'}</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <IonIcon icon={speedometerOutline} style={{ marginRight: '8px', color: '#666' }} />
                      <strong>Avancement:</strong>
                    </div>
                    <div style={{ marginLeft: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${selectedSignalement.avancement}%`, 
                              height: '100%', 
                              backgroundColor: getStatutColor(selectedSignalement.statut) === 'danger' ? '#ff4444' : 
                                             getStatutColor(selectedSignalement.statut) === 'warning' ? '#ffcc00' : '#10dc60',
                              borderRadius: '4px'
                            }}
                          ></div>
                        </div>
                        <span>{selectedSignalement.avancement || 0}%</span>
                      </div>
                    </div>
                  </div>
                  
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <IonIcon icon={cashOutline} style={{ marginRight: '8px', color: '#666' }} />
                        <strong>Budget:</strong>
                      </div>
                      <p style={{ marginLeft: '24px', marginTop: 0 }}>{selectedSignalement.budget || 0} Ar</p>
                    </div>
                  
                  {selectedSignalement.surface_m2 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <IonIcon icon={locationOutline} style={{ marginRight: '8px', color: '#666' }} />
                        <strong>Surface:</strong>
                      </div>
                      <p style={{ marginLeft: '24px', marginTop: 0 }}>{selectedSignalement.surface_m2} m²</p>
                    </div>
                  )}
                  
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <IonIcon icon={calendarOutline} style={{ marginRight: '8px', color: '#666' }} />
                      <strong>Date création:</strong>
                    </div>
                    <p style={{ marginLeft: '24px', marginTop: 0 }}>{formatDate(selectedSignalement.date_creation)}</p>
                  </div>
                </div>
                
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <strong>📍 Position:</strong><br />
                  Latitude: {selectedSignalement.position.latitude.toFixed(6)}<br />
                  Longitude: {selectedSignalement.position.longitude.toFixed(6)}
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <IonIcon icon={personOutline} style={{ marginRight: '8px', color: '#666' }} />
                    <strong>Créé par:</strong>
                  </div>
                  <p style={{ marginLeft: '24px', marginTop: 0 }}>{selectedSignalement.userEmail}</p>
                </div>
                
                {selectedSignalement.utilisateur_id === userId && (
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <IonButton 
                      expand="block" 
                      color="danger"
                      onClick={() => supprimerSignalement(selectedSignalement.id)}
                    >
                      Supprimer ce signalement
                    </IonButton>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <IonButton 
                expand="block" 
                color="medium" 
                onClick={() => setShowDetailModal(false)}
              >
                Fermer
              </IonButton>
              
              <IonButton 
                expand="block" 
                color="primary"
                onClick={() => {
                  // Recentrer la carte sur ce signalement
                  if (mapRef.current) {
                    mapRef.current.setView(
                      [selectedSignalement.position.latitude, selectedSignalement.position.longitude],
                      18,
                      { animate: true }
                    );
                    setShowDetailModal(false);
                  }
                }}
              >
                Voir sur la carte
              </IonButton>
            </div>
          </div>
        </div>
      )}

      <IonLoading isOpen={isLoading} message="Chargement ..." />
      
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="top"
      />
    </IonPage>
  );
};

export default Home;