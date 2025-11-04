import "./navbar.css"
import { auth } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'

export default function Navbar(){
    const navigate = useNavigate()
        async function handleLogout() {
            try {
                await signOut(auth)
                navigate('/', {replace: true})
            } catch(err){
                console.log("Erro no logout! ", err)
            }
        }
    return(
        <div className="navbar">
            <p className="navbar">Dashboard</p>
            <p className="navbar">Imóveis</p>
            <p className="navbar">Pagamentos</p>
            <p className="navbar">Documentos</p>
            <p className="logout" onClick={handleLogout}>sair</p>
        </div>
    )
}