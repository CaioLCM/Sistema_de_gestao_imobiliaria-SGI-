import { useEffect, useState } from 'react'
import './main.css'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, userInfoCollection } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { query, where, getDocs } from 'firebase/firestore'

export default function Main() {
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [alert, setAlert] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userInfo = await findUserByEmail(user.email)
                if (userInfo) {
                    navigate('/dashboard', { replace: true })
                } else {
                    // Se usuário não tem perfil, fazer logout
                    await signOut(auth)
                    setAlert('Conta não autorizada. Entre em contato com o administrador.')
                }
            }
        })

        return unsub
    }, [navigate])

    async function findUserByEmail(emailToFind) {
        try {
            const q = query(userInfoCollection, where('email', '==', emailToFind))
            const snapshot = await getDocs(q)
            if (snapshot.empty) return null
            return snapshot.docs[0].data()
        } catch (err) {
            console.error('Erro ao buscar usuário:', err)
            return null
        }
    }

    async function handleLogin(e) {
        e?.preventDefault()
        setAlert('')
        setLoading(true)
        
        if (!email || !senha) {
            setAlert('Por favor, preencha todos os campos')
            setLoading(false)
            return
        }

        try {
            await signInWithEmailAndPassword(auth, email, senha)
            // O useEffect vai redirecionar automaticamente
        } catch (err) {
            console.log('Erro no login', err)
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setAlert('Email ou senha incorretos')
            } else if (err.code === 'auth/invalid-email') {
                setAlert('Email inválido')
            } else {
                setAlert('Erro ao fazer login. Tente novamente.')
            }
            setLoading(false)
        }
    }

    return (
        <div className='login-container'>
            <div className='login-card'>
                <div className='login-header'>
                    <h1>Sistema de Gerenciamento</h1>
                    <p>Faça login para continuar</p>
                </div>
                <form onSubmit={handleLogin} className='login-form'>
                    <div className='form-group'>
                        <label htmlFor='email'>Email</label>
                        <input 
                            id='email'
                            type='email' 
                            value={email}
                            onChange={e => setEmail(e.target.value)} 
                            placeholder='seu@email.com'
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className='form-group'>
                        <label htmlFor='senha'>Senha</label>
                        <input 
                            id='senha'
                            type='password' 
                            value={senha}
                            onChange={e => setSenha(e.target.value)} 
                            placeholder='••••••••'
                            disabled={loading}
                            required
                        />
                    </div>
                    {alert && <p className='alert-message'>{alert}</p>}
                    <button 
                        type='submit' 
                        className='login-button' 
                        disabled={loading}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <p className='login-footer'>
                    Apenas contas autorizadas pelo administrador podem acessar o sistema.
                </p>
            </div>
        </div>
    )
}