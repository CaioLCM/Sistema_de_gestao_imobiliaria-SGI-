// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
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
export const auth = getAuth(app);