import { auth, userInfoCollection } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { query, where, getDocs } from 'firebase/firestore'
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
            
            // Buscar informações do usuário
            try {
                const q = query(userInfoCollection, where('email', '==', user.email))
                const snapshot = await getDocs(q)
                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data()
                    setUserInfo(userData)
                } else {
                    // Se não tem perfil, fazer logout
                    await signOut(auth)
                    navigate('/', { replace: true })
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

        switch (aba) {
            case "geral":
                return <Geral userInfo={userInfo} />
            case "imoveis":
                return <Imoveis userInfo={userInfo} />
            case "pagamentos":
                return <Pagamentos userInfo={userInfo} />
            case "documentos":
                return <Documentos userInfo={userInfo} />
            case "contas":
                return <Usuarios userInfo={userInfo} />
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