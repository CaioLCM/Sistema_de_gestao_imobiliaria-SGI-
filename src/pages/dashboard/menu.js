import { auth } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useEffect } from 'react'
import Navbar from '../navbar/navbar'

export default function Dashboard() {

    const navigate = useNavigate()

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => {
            if (!user) navigate('/', {replace: true})
        })
    })

    async function handleLogout() {
        try {
            await signOut(auth)
            navigate('/', {replace: true})
        } catch(err){
            console.log("Erro no logout! ", err)
        }
    }

    return (
        <>
        <Navbar></Navbar>
        <div>
            <button onClick={handleLogout}>logout</button>
        </div>
        </>
    )
}