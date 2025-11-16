import { auth, db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { doc, getDoc, query, where, getDocs } from 'firebase/firestore'
import { userInfoCollection } from '../../firebase'
import Geral from './geral/geral'
import "./menu.css"
import Imoveis from './imoveis/imoveis'
import Pagamentos from './pagamentos/pagamentos'
import Documentos from './documentos/documentos'
import Usuarios from './usuarios/usuarios'

export default function Dashboard() {
    const navigate = useNavigate()
    const [aba, setAba] = useState("geral")
    const [userInfo, setUserInfo] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                navigate('/', { replace: true })
                return
            }
            // Buscar informações do usuário pelo UID (recomendado)
            function normalize(userData, docId) {
                const normalized = { ...userData }
                // ensure uid
                normalized.uid = normalized.uid || docId || user.uid
                // normalize name fields
                normalized.nome = normalized.nome || normalized.name || normalized.fullName || ''
                // normalize tipoConta to short keys used in app
                const t = (normalized.tipoConta || '').toString().toLowerCase()
                if (t.includes('adm') || t.includes('admin') || t.includes('administrador')) normalized.tipoConta = 'adm'
                else if (t.includes('corretor')) normalized.tipoConta = 'corretor'
                else normalized.tipoConta = 'cliente'
                return normalized
            }

            try {
                // Primeiro tenta buscar pelo UID (prática recomendada)
                const ref = doc(db, 'user_info', user.uid)
                const snap = await getDoc(ref)
                if (snap.exists()) {
                    setUserInfo(normalize(snap.data(), snap.id))
                } else {
                    // fallback: buscar por email (caso o documento não use uid como id)
                    const q = query(userInfoCollection, where('email', '==', user.email))
                    const snapshot = await getDocs(q)
                    if (!snapshot.empty) {
                        const userData = snapshot.docs[0].data()
                        setUserInfo(normalize(userData, snapshot.docs[0].id))
                    } else {
                        // Se não tem perfil, fazer logout
                        await signOut(auth)
                        navigate('/', { replace: true })
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar usuário:', err)
            } finally {
                setLoading(false)
            }
        })

        return unsub
    }, [navigate])

    async function handleLogout() {
        try {
            await signOut(auth)
            navigate('/', { replace: true })
        } catch (err) {
            console.log("Erro no logout! ", err)
        }
    }

    function handleContent() {
        if (loading) {
            return (
                <div className="dashboard-content">
                    <div className="loading-spinner">Carregando...</div>
                </div>
            )
        }
        // permissões derivadas do tipo de conta
        const isAdmin = userInfo?.tipoConta === 'adm'
        const isCorretor = userInfo?.tipoConta === 'corretor'
        const canEdit = isAdmin || isCorretor

        switch (aba) {
            case "geral":
                return <Geral userInfo={userInfo} canEdit={canEdit} />
            case "imoveis":
                return <Imoveis userInfo={userInfo} canEdit={canEdit} />
            case "pagamentos":
                return <Pagamentos userInfo={userInfo} canEdit={canEdit} />
            case "documentos":
                return <Documentos userInfo={userInfo} canEdit={canEdit} />
            case "contas":
                return <Usuarios userInfo={userInfo} canCreateAccounts={isAdmin} />
            default:
                return <div className="dashboard-content">Página não encontrada</div>
        }
    }

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading-spinner">Carregando...</div>
            </div>
        )
    }

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>Sistema de Gerenciamento</h2>
                    <div className="user-info">
                        <p className="user-name">{userInfo?.nome || 'Usuário'}</p>
                        <p className="user-role">
                            {userInfo?.tipoConta === 'adm' ? 'Administrador' :
                             userInfo?.tipoConta === 'corretor' ? 'Corretor' : 'Cliente'}
                        </p>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button 
                        className={`nav-item ${aba === "geral" ? 'active' : ''}`}
                        onClick={() => setAba("geral")}
                    >
                        <span>📊</span> Geral
                    </button>
                    <button 
                        className={`nav-item ${aba === "imoveis" ? 'active' : ''}`}
                        onClick={() => setAba("imoveis")}
                    >
                        <span>🏠</span> Imóveis
                    </button>
                    <button 
                        className={`nav-item ${aba === "pagamentos" ? 'active' : ''}`}
                        onClick={() => setAba("pagamentos")}
                    >
                        <span>💳</span> Pagamentos
                    </button>
                    <button 
                        className={`nav-item ${aba === "documentos" ? 'active' : ''}`}
                        onClick={() => setAba("documentos")}
                    >
                        <span>📄</span> Documentos
                    </button>
                    {isAdmin && (
                        <button 
                            className={`nav-item ${aba === "contas" ? 'active' : ''}`}
                            onClick={() => setAba("contas")}
                        >
                            <span>👥</span> Contas
                        </button>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <button className="logout-button" onClick={handleLogout}>
                        <span>🚪</span> Sair
                    </button>
                </div>
            </aside>
            <main className="dashboard-main">
                {handleContent()}
            </main>
        </div>
    )
}