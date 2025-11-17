// src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // Importe do seu firebase.js
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// 1. Criar o Contexto
const AuthContext = createContext();

// 2. Criar o Provedor (o "gerenciador")
export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null); // Usuário do Auth
    const [userProfile, setUserProfile] = useState(null); // Perfil do Firestore (com tipoConta)
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Monitora mudanças no login (login, logout)
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            
            if (user) {
                // Usuário logou -> Buscar perfil no Firestore
                const userDocRef = doc(db, 'user_info', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    setUserProfile({ id: user.uid, uid: user.uid, ...userDoc.data() });
                } else {
                    // Perfil não encontrado (pode ser um erro ou um usuário novo)
                    setUserProfile(null);
                    console.error("Perfil do usuário não encontrado no Firestore.");
                }
            } else {
                // Usuário deslogou
                setUserProfile(null);
            }
            setLoading(false);
        });

        // Limpa o monitor ao desmontar
        return () => unsubscribe();
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading
    };

    // 3. Fornecer o valor para os 'children'
    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

// 4. Criar um Hook customizado para facilitar o uso
export function useAuth() {
    return useContext(AuthContext);
}