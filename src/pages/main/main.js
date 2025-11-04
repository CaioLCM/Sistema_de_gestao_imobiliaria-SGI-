import { useEffect, useState } from 'react'
import './main.css'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { auth, userInfoCollection } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import Navbar from '../navbar/navbar'

export default function Main() {
    const [mode, setActionText] = useState('login')
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [alert, setAlert] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const created = await findUserByEmail(user.email)
                const email = user.email
                if (created === false) navigate('/registrar', { replace: true, state: { email, from: "login" } })
                else navigate('/dashboard', { replace: true })
            }
        })

        // cleanup: remove o listener ao desmontar / reexecutar
        return unsub
    }, [navigate])

    async function findUserByEmail(emailToFind) {
        const q = query(userInfoCollection, where('email', '==', emailToFind))
        const snapshot = await getDocs(q)
        if (snapshot.empty) return false
        return true
    }

    function handleTradeAction() {
        setActionText(prev => prev === 'login' ? 'cadastro' : 'login')
        setAlert('')
    }

    async function handleRegister(e) {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth, email, senha
            )
            console.log('Usuário registrado: ', userCredential.user)
        } catch (err) {
            console.log("Erro ao registrar", err)
            setAlert('Credenciais inválidas')

        }
    }

    async function handleLogin(e) {
        e?.preventDefault()
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, senha)
            console.log('Logado: ', userCredential.user)
            const user = userCredential.user
            const created = await findUserByEmail(user.email)
            if (await findUserByEmail(userCredential.user.email) == false) {
                const email = user.email
                if (created === false) navigate('/registrar', { replace: true, state: { email, from: "login" } })
            }
            else navigate('/dashboard', { replace: true })
        } catch (err) {
            console.log('Erro no login', err)
            setAlert('Credenciais inválidas')
        }
    }

    return (
        <>
            <div className='login'>
                <h1 className='login'>{mode == 'login' ? 'Fazer login' : 'Fazer cadastro'}</h1>
                <p className='login'>email</p>
                <input type='email' onChange={e => setEmail(e.target.value)} className='login'></input>
                <p className='login'>senha</p>
                <input className='login' type='password' onChange={e => setSenha(e.target.value)}></input>
                <p id='alert' className='login'>{alert}</p>
                <button className='login' onClick={mode == 'login' ? handleLogin : handleRegister}>{mode == 'login' ? 'Entrar' : 'Criar'}</button>
                <span className='login' onClick={handleTradeAction}>{mode == 'login' ? 'criar conta' : 'fazer login'}</span>
            </div>
        </>
    )
}