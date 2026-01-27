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
  IonList
} from '@ionic/react';
import { refreshOutline, locationOutline, addOutline, logOutOutline, saveOutline } from 'ionicons/icons';

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
  GeoPoint
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
  const [clickedPoint, setClickedPoint] = useState<{lat: number, lng: number} | null>(null);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  // Champs du formulaire de signalement
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatut, setFormStatut] = useState<number>(1);
  const [formSurface, setFormSurface] = useState<string>('');
  const [formBudget, setFormBudget] = useState<string>('');
  const [formAvancement, setFormAvancement] = useState<string>('0');
  const [formEntreprise, setFormEntreprise] = useState<string>('');
  
  const mapRef = useRef<any>(null);
  const history = useHistory();

  const defaultPosition: [number, number] = [-18.8792, 47.5079]; // Antananarivo

  // Créer une icône personnalisée pour les signalements
  const createSignalementIcon = (statut: number) => {
    let color = '#ff4444'; // Rouge par défaut (Nouveau)
    
    if (statut === 2) color = '#ffcc00'; // Jaune (En cours)
    if (statut === 3) color = '#10dc60'; // Vert (Résolu)
    
    return new L.Icon({
      iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  };

  // Charger les entreprises depuis Firebase
  useEffect(() => {
    if (auth.currentUser) {
      setUserEmail(auth.currentUser.email || '');
      
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
        
        // Sélectionner la première entreprise par défaut
        if (entreprisesList.length > 0 && !formEntreprise) {
          setFormEntreprise(entreprisesList[0].nom);
        }
      });
      
      // Charger les signalements
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

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormTitre('');
    setFormDescription('');
    setFormStatut(1);
    setFormSurface('');
    setFormBudget('');
    setFormAvancement('0');
    if (entreprises.length > 0) {
      setFormEntreprise(entreprises[0].nom);
    }
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

  return (
    <IonPage style={{ height: '100vh' }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte des Signalements - {userEmail}</IonTitle>
          <IonButton slot="end" onClick={handleLogout} fill="clear">
            <IonIcon icon={logOutOutline} />
            Déconnexion
          </IonButton>
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

            {/* Signalements depuis Firebase */}
            {signalements.map(signalement => (
              <Marker 
                key={signalement.id} 
                position={[signalement.position.latitude, signalement.position.longitude]}
                icon={createSignalementIcon(signalement.statut)}
              >
                <Popup>
                  <div style={{ minWidth: '250px' }}>
                    <strong>{signalement.titre}</strong><br />
                    <small>
                      <IonText color={getStatutColor(signalement.statut)}>
                        Statut: {getStatutText(signalement.statut)}
                      </IonText>
                      <br />
                      Entreprise: {signalement.entreprise_responsable}<br />
                      Avancement: {signalement.avancement}%<br />
                      {signalement.userEmail && `Par: ${signalement.userEmail}`}
                    </small>
                    {signalement.description && (
                      <>
                        <hr />
                        <p style={{ fontSize: '12px' }}>{signalement.description}</p>
                      </>
                    )}
                    {signalement.budget && (
                      <p style={{ fontSize: '12px', marginTop: '5px' }}>
                        <strong>Budget:</strong> {signalement.budget} €
                      </p>
                    )}
                    {auth.currentUser?.uid === signalement.utilisateur_id && (
                      <div style={{ marginTop: '10px' }}>
                        <IonButton size="small" color="danger" onClick={() => supprimerSignalement(signalement.id)}>
                          Supprimer
                        </IonButton>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

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
          <IonFab vertical="top" horizontal="end" slot="fixed" style={{ top: '70px' }}>
            <IonFabButton size="small" onClick={forceMapResize}>
              <IonIcon icon={refreshOutline} />
            </IonFabButton>
          </IonFab>

          <IonFab vertical="top" horizontal="end" slot="fixed" style={{ top: '130px' }}>
            <IonFabButton size="small" onClick={() => position && setPosition(position)}>
              <IonIcon icon={locationOutline} />
            </IonFabButton>
          </IonFab>

          <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: '20px' }}>
            <IonFabButton onClick={() => position && handleMapClick(position[0], position[1])}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>

          {/* Statistiques */}
          {signalements.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '70px',
              left: '10px',
              zIndex: 1000,
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              minWidth: '120px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📊 Signalements</div>
              <div>Total: {signalements.length}</div>
              <div>Nouveaux: {signalements.filter(s => s.statut === 1).length}</div>
              <div>En cours: {signalements.filter(s => s.statut === 2).length}</div>
              <div>Résolus: {signalements.filter(s => s.statut === 3).length}</div>
            </div>
          )}
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
                <IonLabel position="stacked">Statut</IonLabel>
                <IonSelect 
                  value={formStatut} 
                  onIonChange={e => setFormStatut(e.detail.value)}
                >
                  <IonSelectOption value={1}>Nouveau</IonSelectOption>
                  <IonSelectOption value={2}>En cours</IonSelectOption>
                  <IonSelectOption value={3}>Résolu</IonSelectOption>
                </IonSelect>
              </IonItem>
              
              <IonItem>
                <IonLabel position="stacked">Entreprise responsable</IonLabel>
                <IonSelect 
                  value={formEntreprise} 
                  onIonChange={e => setFormEntreprise(e.detail.value)}
                >
                  {entreprises.map(entreprise => (
                    <IonSelectOption key={entreprise.id} value={entreprise.nom}>
                      {entreprise.nom}
                    </IonSelectOption>
                  ))}
                </IonSelect>
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
              
              <IonItem>
                <IonLabel position="stacked">Budget (€)</IonLabel>
                <IonInput
                  type="number"
                  value={formBudget}
                  onIonChange={e => setFormBudget(e.detail.value || '')}
                  placeholder="Ex: 1500"
                />
              </IonItem>
              
              <IonItem>
                <IonLabel position="stacked">Avancement (%)</IonLabel>
                <IonInput
                  type="number"
                  value={formAvancement}
                  onIonChange={e => setFormAvancement(e.detail.value || '')}
                  min="0"
                  max="100"
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

      <IonLoading isOpen={isLoading} message="Enregistrement en cours..." />
      
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