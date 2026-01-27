import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyBvN43r8R_5BwurgJL29N-nDKUs5W5vuGs",
  authDomain: "arabe-8144d.firebaseapp.com",
  projectId: "arabe-8144d",
  storageBucket: "arabe-8144d.appspot.com",
  messagingSenderId: "560164445602",
  appId: "1:560164445602:web:f1b3f108f71df4d81026fb"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Exporter les services
export const auth = getAuth(app);
export const db = getFirestore(app); 