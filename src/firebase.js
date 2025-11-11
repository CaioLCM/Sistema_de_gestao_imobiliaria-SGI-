// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { collection, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCLflfAuTvsh4UTp9fTxDohvFNm9z6mFLE",
  authDomain: "sgii-db3f2.firebaseapp.com",
  projectId: "sgii-db3f2",
  storageBucket: "sgii-db3f2.firebasestorage.app",
  messagingSenderId: "314644198883",
  appId: "1:314644198883:web:b66c0007f2fcf87605dcd6",
  measurementId: "G-EN2SPY8VYS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// init auth
export const auth = getAuth(app);

// init firestore
export const db = getFirestore(app);

// collection refs
export const userInfoCollection = collection(db, 'user_info');
export const imoveisCollection = collection(db, 'imoveis');
export const pagamentosCollection = collection(db, 'pagamentos');
export const documentosCollection = collection(db, 'documentos');