import { useState } from "react"
import "./register.css"
import { auth, db } from "../../firebase"
import { signOut } from "firebase/auth"
import { useNavigate, useLocation } from 'react-router-dom'
import { doc, setDoc, serverTimestamp} from 'firebase/firestore'

export default function Register() {
    const navigate = useNavigate()
    const location = useLocation()
    const {email, from} = location.state || {}
    async function handleLogout() {
        try {
            await signOut(auth)
            navigate('/', { replace: true })
        } catch (err) {
            console.log("Erro no logout! ", err)
        }
    }
    
    const [tipoConta, setTipoConta] = useState("cliente")
    const [cpf, setCpf] = useState('')
    const [nome, setNome] = useState('')
    const [telefone, setTelefone] = useState('')

    async function handleSubmit(e) {
        try{
            const user = auth.currentUser
            if(!user){
                navigate('/', {replace: true})
                return
            }
            const uid = user.uid
            const payload = {
                uid,
                email,
                cpf,
                nome,
                telefone,
                tipoConta,
                createdAt: serverTimestamp()
            }
            await setDoc(doc(db, "user_info", uid), payload, {merge: true})
            navigate('/dashboard', {replace: true})
        } catch(err){
            console.log("Erro ao salvar usuário:", err)
        }
    }

    return (
        <div className="register">
            <h1 className="register">Finalizar o registro</h1>
            <p className="register">CPF/CNPJ</p>
            <input className="register" onChange={e => setCpf(e.target.value)}></input>
            <p className="register">Nome completo</p>
            <input className="register" onChange={e => setNome(e.target.value)}></input>
            <p className="register">Telefone</p>
            <input className="register" onChange={e => setTelefone(e.target.value)}></input>
            <p className="register">Email</p>
            <input className="register" value={email} readOnly></input>
            <p className="register">Tipo de conta</p>
            <select
                className="register"
                value={tipoConta}
                onChange={e => setTipoConta(e.target.value)}
            >
                <option value="adm">Administrador</option>
                <option value="corretor">Corretor</option>
                <option value="cliente">Cliente</option>

            </select>
            <button className="register" onClick={handleSubmit}>Finalizar</button>
            <span onClick={handleLogout}>sair</span>
        </div>
    )
}