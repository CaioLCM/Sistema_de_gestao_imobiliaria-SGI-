import { useEffect, useState } from 'react'
import './main.css'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase'
import { useNavigate } from 'react-router-dom'

export default function Main() {
    const [mode, setActionText] = useState('login')
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [alert, setAlert] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => {
            if (user) navigate('/dashboard', {replace: true})
        })
    })

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
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, senha)
            console.log('Logado: ', userCredential.user)
        } catch (err) {
            console.log('Erro no login', err)
            setAlert('Credenciais inválidas')
        }
    }

    return (
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
    )
}