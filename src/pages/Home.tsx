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
  IonSegmentButton,
  IonGrid,
  IonRow,
  IonCol,
  IonActionSheet
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
  speedometerOutline,
  cameraOutline,
  imageOutline,
  closeCircleOutline,
  trashOutline,
  eyeOutline,
  list,
  listSharp,
  warning,
  colorFill,
  pencil,
  pin,
  fileTraySharp,
  fileTray,
  mapOutline,
  documentOutline
} from 'ionicons/icons';

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './template.css'

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
  photos?: string[]; // Ajout du champ photos (optionnel pour compatibilité)
}

// Type pour une entreprise
interface Entreprise {
  id: string;
  nom: string;
}

// Type pour une photo (nouveau)
interface Photo {
  id: string;
  base64: string;
  name: string;
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

// NOUVEAU: Fonction pour compresser les images
const compressImage = (base64: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Redimensionner si trop large
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compresser en JPEG avec qualité réduite
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } else {
        resolve(base64); // Retourner l'original si erreur
      }
    };
    
    img.onerror = () => {
      resolve(base64); // Retourner l'original si erreur
    };
  });
};

// NOUVEAU: Fonction pour compresser toutes les photos
const compressAllPhotos = async (photos: Photo[]): Promise<string[]> => {
  const compressedPhotos: string[] = [];
  
  for (const photo of photos) {
    try {
      // Vérifier la taille actuelle
      console.log('Taille originale:', photo.base64.length, 'bytes');
      
      // Compresser l'image
      const compressed = await compressImage(photo.base64, 800, 0.6);
      
      // Vérifier si encore trop grande
      if (compressed.length > 900000) { // Laisser une marge
        // Compression encore plus agressive
        const moreCompressed = await compressImage(compressed, 600, 0.5);
        compressedPhotos.push(moreCompressed);
        console.log('Photo compressée agressivement:', moreCompressed.length, 'bytes');
      } else {
        compressedPhotos.push(compressed);
        console.log('Photo compressée:', compressed.length, 'bytes');
      }
    } catch (error) {
      console.error('Erreur compression:', error);
      // Garder l'original si erreur
      compressedPhotos.push(photo.base64);
    }
  }
  
  return compressedPhotos;
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
  
  // NOUVEAU: États pour les photos
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            synchronise_firebase: data.synchronise_firebase,
            photos: data.photos || [] // Charger les photos si elles existent
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
    setFormEntreprise(null);
    // NOUVEAU: Réinitialiser les photos
    setSelectedPhotos([]);
  };

  // NOUVEAU: Fonction de capture de photo améliorée avec compression
  const capturePhotoFromCamera = async () => {
    return new Promise<string>((resolve) => {
      const canvas = document.createElement('canvas');
      const video = document.createElement('video');
      
      navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      }).then(stream => {
        video.srcObject = stream;
        video.play();
        
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          setTimeout(() => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const base64 = canvas.toDataURL('image/jpeg', 0.8); // Qualité 80%
              
              // Arrêter le flux
              stream.getTracks().forEach(track => track.stop());
              
              resolve(base64);
            }
          }, 500);
        };
      }).catch(error => {
        console.error('Erreur caméra:', error);
        resolve('');
      });
    });
  };

  const takePhoto = async () => {
    try {
      // Vérifier si l'API MediaDevices est disponible
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Démarrer la caméra directement
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'user', // Caméra selfie
              width: { ideal: 1024 }, // Réduire la résolution
              height: { ideal: 768 }
            }, 
            audio: false 
          });
          
          // Créer une interface caméra personnalisée
          const cameraModal = document.createElement('div');
          cameraModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          `;
          
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.playsInline = true;
          video.style.cssText = `
            max-width: 100%;
            max-height: 70%;
            object-fit: contain;
          `;
          
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 20px;
          `;
          
          const captureBtn = document.createElement('button');
          captureBtn.textContent = 'Prendre la photo';
          captureBtn.style.cssText = `
            padding: 12px 24px;
            background: #3880ff; 
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            font-family: 'Segoe UI';

          `;
          
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = '✕ Annuler';
          cancelBtn.style.cssText = `
            padding: 12px 24px;
            background: #6c757d;
            font-family: 'Segoe UI';
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          `;
          
          const canvas = document.createElement('canvas');
          canvas.style.display = 'none';
          
          // Assembler l'interface
          buttonContainer.appendChild(captureBtn);
          buttonContainer.appendChild(cancelBtn);
          cameraModal.appendChild(video);
          cameraModal.appendChild(buttonContainer);
          document.body.appendChild(cameraModal);
          document.body.appendChild(canvas);
          
          // Fonction pour capturer la photo
          const capturePhoto = async () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Convertir en base64 avec qualité réduite
              let base64 = canvas.toDataURL('image/jpeg', 0.7); // Qualité 70%
              
              // COMPRESSER l'image
              try {
                base64 = await compressImage(base64, 800, 0.6);
              } catch (compressError) {
                console.error('Erreur compression:', compressError);
              }
              
              // Afficher la taille pour débogage
              console.log('Taille photo après compression:', base64.length, 'bytes');
              
              const newPhoto: Photo = {
                id: Date.now().toString(),
                base64: base64,
                name: `photo_${Date.now()}.jpg`
              };
              
              setSelectedPhotos(prev => [...prev, newPhoto]);
              setToastMessage('Photo prise avec succès');
              setShowToast(true);
            }
            
            // Nettoyer
            cleanupCamera();
          };
          
          // Fonction de nettoyage
          const cleanupCamera = () => {
            // Arrêter le flux vidéo
            stream.getTracks().forEach(track => track.stop());
            
            // Supprimer les éléments du DOM
            if (cameraModal.parentNode) {
              cameraModal.parentNode.removeChild(cameraModal);
            }
            if (canvas.parentNode) {
              canvas.parentNode.removeChild(canvas);
            }
            
            setShowPhotoOptions(false);
          };
          
          // Événements
          captureBtn.onclick = capturePhoto;
          cancelBtn.onclick = cleanupCamera;
          
          // Échappement avec la touche ESC
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cleanupCamera();
          };
          document.addEventListener('keydown', handleKeyDown);
          
          // Nettoyer l'écouteur d'événement
          const cleanupListener = () => {
            document.removeEventListener('keydown', handleKeyDown);
          };
          cameraModal.addEventListener('click', cleanupListener);
          
          return; // Sortir de la fonction
        } catch (error) {
          console.log('Accès direct à la caméra refusé ou non disponible:', error);
          // Continuer avec la méthode input file
        }
      }
      
      // Méthode de repli: input file standard
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      // Essayer d'ouvrir la caméra (fonctionne sur mobile, peut ouvrir l'explorateur sur desktop)
      input.setAttribute('capture', 'user');
      
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            let base64 = reader.result as string;
            
            // COMPRESSER l'image si elle est trop grande
            if (base64.length > 500000) { // Si > 500KB
              try {
                base64 = await compressImage(base64, 800, 0.6);
                console.log('Photo compressée depuis galerie:', base64.length, 'bytes');
              } catch (compressError) {
                console.error('Erreur compression galerie:', compressError);
              }
            }
            
            const newPhoto: Photo = {
              id: Date.now().toString(),
              base64: base64,
              name: file.name || `photo_${Date.now()}.jpg`
            };
            
            setSelectedPhotos(prev => [...prev, newPhoto]);
            setToastMessage('Photo ajoutée');
            setShowToast(true);
          };
          reader.readAsDataURL(file);
        }
        setShowPhotoOptions(false);
        
        // Nettoyer
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };
      
      document.body.appendChild(input);
      input.click();
      
    } catch (error) {
      console.error('Erreur caméra:', error);
      setToastMessage('Erreur lors de la prise de photo');
      setShowToast(true);
    }
  };

  // NOUVEAU: Sélectionner des photos depuis la galerie
  const selectFromGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // NOUVEAU: Gérer la sélection de fichiers avec compression
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPhotos: Photo[] = [];
      
      // Limiter à 5 photos maximum
      const limitedFiles = Array.from(files).slice(0, 5);
      
      for (const file of limitedFiles) {
        const reader = new FileReader();
        
        await new Promise<void>((resolve) => {
          reader.onloadend = async () => {
            let base64 = reader.result as string;
            
            // Vérifier la taille et compresser si nécessaire
            if (base64.length > 300000) { // Si > 300KB
              try {
                base64 = await compressImage(base64, 800, 0.6);
                console.log('Photo compressée:', base64.length, 'bytes');
              } catch (compressError) {
                console.error('Erreur compression:', compressError);
              }
            }
            
            const newPhoto: Photo = {
              id: Date.now().toString() + Math.random(),
              base64: base64,
              name: file.name
            };
            newPhotos.push(newPhoto);
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      
      setSelectedPhotos(prev => [...prev, ...newPhotos]);
      setShowPhotoOptions(false);
      
      // Avertir si trop de photos
      if (files.length > 5) {
        setToastMessage('Maximum 5 photos sélectionnées');
        setShowToast(true);
      }
    }
  };

  // NOUVEAU: Supprimer une photo
  const removePhoto = (photoId: string) => {
    setSelectedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  // NOUVEAU: Afficher une photo en grand
  const viewPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    setShowPhotoViewer(true);
  };

  // MODIFIÉ: Ajouter un nouveau signalement dans Firebase avec compression
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

    // NOUVEAU: Limiter le nombre de photos
    if (selectedPhotos.length > 5) {
      setToastMessage("Maximum 5 photos par signalement");
      setShowToast(true);
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      
      let photoBase64Array: string[] = [];
      
      if (selectedPhotos.length > 0) {
        // Afficher un message de compression
        setToastMessage("Compression des photos...");
        setShowToast(true);
        
        // COMPRESSER toutes les photos avant l'envoi
        photoBase64Array = await compressAllPhotos(selectedPhotos);
        
        // Vérifier si une photo est encore trop grande
        const tooLargePhoto = photoBase64Array.find(photo => photo.length > 900000);
        if (tooLargePhoto) {
          setToastMessage("Une photo est encore trop grande. Veuillez en choisir une plus petite.");
          setShowToast(true);
          setIsLoading(false);
          return;
        }
        
        // Vérifier la taille totale
        const totalSize = photoBase64Array.reduce((sum, photo) => sum + photo.length, 0);
        console.log('Taille totale des photos:', totalSize, 'bytes');
        
        if (totalSize > 3000000) { // 3MB max
          setToastMessage("Les photos sont trop grandes au total. Réduisez le nombre ou la taille.");
          setShowToast(true);
          setIsLoading(false);
          return;
        }
      }
      
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
        synchronise_firebase: true,
        // NOUVEAU: Ajouter les photos compressées
        photos: photoBase64Array
      };

      console.log("Envoi du signalement avec", photoBase64Array.length, "photos compressées");
      
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
      
      // Message d'erreur spécifique pour les photos trop grandes
      if (error.message.includes("longer than 1048487 bytes")) {
        setToastMessage("Erreur: Les photos sont trop grandes. Elles seront automatiquement compressées.");
        
        // Essayer avec compression plus agressive
        setTimeout(() => {
          setToastMessage("Réessayez avec des photos plus petites");
          setShowToast(true);
        }, 2000);
      } else {
        setToastMessage(`Erreur: ${error.message}`);
      }
      
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
    <IonPage  style={{ height: '100vh' }}>
      <IonHeader style={{ display:'flex', width:'100%'}} >  
        <IonToolbar style={{ padding: '10px'}}>
          <div className='filtretoolbar' >
            
            
            <IonSegment className='bg-tomato' style={{ color: 'white'}} value={filterType} onIonChange={e => setFilterType(e.detail.value as 'all' | 'mine')}>
              <IonSegmentButton value="all" style={{ '--color-checked': '#fc5130' }}>
                <IonIcon icon={peopleOutline} />
                <IonLabel>Tous</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="mine" style={{ '--color-checked': '#10dc60' }}>
                <IonIcon icon={personOutline} />
                <IonLabel>Mes signalements</IonLabel>
              </IonSegmentButton>
            </IonSegment>
            
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#202020' }}>
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
          </div>
          
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
                        {/* NOUVEAU: Badge pour les photos */}
                        {signalement.photos && signalement.photos.length > 0 && (
                          <IonBadge color="medium" style={{ marginLeft: '5px' }}>
                             {signalement.photos.length}
                          </IonBadge>
                        )}
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

          {/* Input file caché pour la galerie */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            multiple
            onChange={handleFileSelect}
          />

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
            <div style={{
              
            }}>
           
            <h2 style={{display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              alignContent: 'center', marginTop: 0 }}> <IonIcon icon={pencil} style={{ color : '#fc5130', marginRight: '5px'}} slot="start" size='large'/> <span style={{ color : '#fc5130'}}>Ajouter un nouveau signalement</span>  </h2>
            </div>
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <strong><IonIcon icon={pin} style={{ color : '#d03939', marginRight: '5px'}} slot="start"/>  Position sélectionnée:</strong><br />
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
              
              {/* NOUVEAU: Section pour ajouter des photos */}
              <IonItem>
                <IonLabel position="stacked">Photos (max 5)</IonLabel>
                <div style={{ width: '100%', marginTop: '10px' }}>
                  <IonButton 
                    expand="block" 
                    color="medium" 
                    fill="outline"
                    onClick={() => setShowPhotoOptions(true)}
                  >
                    <IonIcon icon={cameraOutline} slot="start" />
                    Ajouter des photos
                    {selectedPhotos.length > 0 && (
                      <IonBadge color="primary" slot="end" style={{ marginLeft: '8px' }}>
                        {selectedPhotos.length}/5
                      </IonBadge>
                    )}
                  </IonButton>
                  
                  {/* Affichage des photos sélectionnées */}
                  {selectedPhotos.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                        {selectedPhotos.length} photo(s) sélectionnée(s) - Compression automatique
                      </div>
                      <IonGrid>
                        <IonRow>
                          {selectedPhotos.map((photo, index) => (
                            <IonCol size="4" key={photo.id}>
                              <div style={{ position: 'relative' }}>
                                <img 
                                  src={photo.base64} 
                                  alt={`Photo ${index + 1}`}
                                  style={{ 
                                    width: '100%', 
                                    height: '80px', 
                                    objectFit: 'cover',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => viewPhoto(index)}
                                />
                                <IonButton 
                                  fill="clear" 
                                  size="small" 
                                  style={{ 
                                    position: 'absolute', 
                                    top: '-8px', 
                                    right: '-8px',
                                    padding: '0',
                                    minWidth: '24px',
                                    height: '24px',
                                    '--background': 'rgba(255, 255, 255, 0.9)',
                                    '--border-radius': '50%'
                                  }}
                                  onClick={() => removePhoto(photo.id)}
                                >
                                  <IonIcon icon={closeCircleOutline} color="danger" size="small" />
                                </IonButton>
                                <div style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  left: '2px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: 'white',
                                  fontSize: '9px',
                                  padding: '1px 3px',
                                  borderRadius: '2px'
                                }}>
                                  {(photo.base64.length / 1000).toFixed(0)}KB
                                </div>
                              </div>
                            </IonCol>
                          ))}
                        </IonRow>
                      </IonGrid>
                    </div>
                  )}
                </div>
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
                onClick={ajouterSignalement}
                disabled={!formTitre.trim()}
                className="btn-save"
              >
                <IonIcon icon={saveOutline} slot="start" />
                Enregistrer
              </IonButton>
              <style>{`
                .btn-save {
                  --background: #1623b0;
                  --background-hover: #0f1a8a;
                  --background-activated: #0b1466;
                  --color: white;
                  font-weight: bold;
                }
              `}</style>

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
          // height: '50vh',
          margin: '25vh 0 30vh 0',
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
              <h2 style={{display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              alignContent: 'center', marginTop: 0 }}> <IonIcon icon={documentOutline} style={{ color : '#fc5130', marginRight: '5px'}} slot="start" size='large'/> <span style={{ color : '#fc5130'}}>Detail du signalement</span>  </h2>
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
                  {/* NOUVEAU: Badge pour les photos */}
                  {selectedSignalement.photos && selectedSignalement.photos.length > 0 && (
                    <IonBadge color="medium" style={{ marginLeft: '10px', fontSize: '14px', padding: '5px 10px' }}>
                       {selectedSignalement.photos.length} photo(s)
                    </IonBadge>
                  )}
                </div>
                
                {/* NOUVEAU: Affichage des photos dans les détails */}
                {selectedSignalement.photos && selectedSignalement.photos.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                      <IonIcon icon={cameraOutline} style={{ marginRight: '8px', color: '#666' }} />
                      <strong>Photos:</strong>
                    </div>
                    <IonGrid>
                      <IonRow>
                        {selectedSignalement.photos.map((photo, index) => (
                          <IonCol size="4" key={index}>
                            <div 
                              style={{ 
                                position: 'relative',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSelectedPhotoIndex(index);
                                setShowPhotoViewer(true);
                              }}
                            >
                              <img 
                                src={photo} 
                                alt={`Photo ${index + 1}`}
                                style={{ 
                                  width: '100%', 
                                  height: '80px', 
                                  objectFit: 'cover',
                                  borderRadius: '5px',
                                  border: '1px solid #ddd'
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: '5px',
                                right: '5px',
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 5px',
                                borderRadius: '3px'
                              }}>
                                {/* {index + 1}/{selectedSignalement.photos.length} */}
                              </div>
                            </div>
                          </IonCol>
                        ))}
                      </IonRow>
                    </IonGrid>
                  </div>
                )}
                
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

      {/* NOUVEAU: ActionSheet pour les options photo */}
      <IonActionSheet
        isOpen={showPhotoOptions}
        onDidDismiss={() => setShowPhotoOptions(false)}
        header="Ajouter des photos"
        buttons={[
          {
            text: 'Prendre une photo',
            icon: cameraOutline,
            handler: takePhoto
          },
          {
            text: 'Choisir depuis la galerie',
            icon: imageOutline,
            handler: selectFromGallery
          },
          {
            text: 'Annuler',
            role: 'cancel'
          }
        ]}
      />

      {/* NOUVEAU: Visionneuse de photos */}
      {showPhotoViewer && selectedSignalement && selectedSignalement.photos && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          zIndex: 3000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            zIndex: 3001 
          }}>
            <IonButton 
              fill="clear" 
              color="light"
              onClick={() => setShowPhotoViewer(false)}
            >
              ✕
            </IonButton>
          </div>
          
          <div style={{ 
            width: '100%', 
            height: '70%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <img 
              src={selectedSignalement.photos[selectedPhotoIndex]} 
              alt={`Photo ${selectedPhotoIndex + 1}`}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          
          <div style={{ 
            position: 'absolute', 
            bottom: '80px', 
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px'
          }}>
            <IonButton 
              color="light" 
              fill="clear"
              disabled={selectedPhotoIndex === 0}
              onClick={() => setSelectedPhotoIndex(prev => prev - 1)}
            >
              Précédent
            </IonButton>
            
            <span style={{ color: 'white', fontSize: '16px' }}>
              {selectedPhotoIndex + 1} / {selectedSignalement.photos.length}
            </span>
            
            <IonButton 
              color="light" 
              fill="clear"
              disabled={selectedPhotoIndex === selectedSignalement.photos.length - 1}
              onClick={() => setSelectedPhotoIndex(prev => prev + 1)}
            >
              Suivant
            </IonButton>
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