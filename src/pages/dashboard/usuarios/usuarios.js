import { useState, useEffect } from 'react'
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, userInfoCollection, contratosCollection } from '../../../firebase'
import { getDocs, doc, setDoc, serverTimestamp, deleteDoc, getDoc, query, where } from 'firebase/firestore'
import './usuarios.css'

const firebaseConfig = {
    apiKey: "AIzaSyCLflfAuTvsh4UTp9fTxDohvFNm9z6mFLE",
    authDomain: "sgii-db3f2.firebaseapp.com",
    projectId: "sgii-db3f2",
    storageBucket: "sgii-db3f2.firebasestorage.app",
    messagingSenderId: "314644198883",
    appId: "1:314644198883:web:b66c0007f2fcf87605dcd6",
    measurementId: "G-EN2SPY8VYS"
};

export default function Usuarios({ userInfo }) {
    const [usuarios, setUsuarios] = useState([])
    const [filteredUsuarios, setFilteredUsuarios] = useState([]) // Estado para lista filtrada
    const [searchTerm, setSearchTerm] = useState('') // Estado do termo de busca
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [modalMode, setModalMode] = useState('create')
    const [editingUser, setEditingUser] = useState(null)
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        senha: '',
        cpf: '',
        telefone: '',
        tipoConta: 'cliente'
    })
    const [alert, setAlert] = useState('')
    const [creating, setCreating] = useState(false)

    const isAdmin = userInfo?.tipoConta === 'adm'

    useEffect(() => {
        if (!userInfo) return
        if (userInfo?.tipoConta === 'adm') {
            loadUsuarios()
        } else {
            loadOwnUser()
        }
    }, [userInfo])

    // Filtro de pesquisa [RFS04]
    useEffect(() => {
        if (!searchTerm) {
            setFilteredUsuarios(usuarios)
        } else {
            const term = searchTerm.toLowerCase()
            const filtered = usuarios.filter(user => 
                (user.nome && user.nome.toLowerCase().includes(term)) ||
                (user.email && user.email.toLowerCase().includes(term)) ||
                (user.cpf && user.cpf.includes(term))
            )
            setFilteredUsuarios(filtered)
        }
    }, [searchTerm, usuarios])

    async function loadUsuarios() {
        try {
            setLoading(true)
            const snapshot = await getDocs(userInfoCollection)
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setUsuarios(usersList)
            setFilteredUsuarios(usersList)
        } catch (err) {
            console.error('Erro ao carregar contas:', err)
            setAlert('Erro ao carregar contas: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadOwnUser() {
        try {
            setLoading(true)
            if (!userInfo?.uid) {
                setLoading(false)
                return
            }
            const userDoc = await getDoc(doc(db, 'user_info', userInfo.uid))
            if (userDoc.exists()) {
                const userData = [{ id: userDoc.id, ...userDoc.data() }]
                setUsuarios(userData)
                setFilteredUsuarios(userData)
            }
        } catch (err) {
            console.error('Erro ao carregar seu cadastro:', err)
            setAlert('Erro ao carregar seu cadastro')
        } finally {
            setLoading(false)
        }
    }

    const formatCpf = (value = '') => {
        const digits = value.replace(/\D/g, '').slice(0, 11)
        let formatted = digits
        if (digits.length > 3 && digits.length <= 6) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`
        else if (digits.length > 6 && digits.length <= 9) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
        else if (digits.length > 9) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
        return formatted
    }

    const formatTelefone = (value = '') => {
        const digits = value.replace(/\D/g, '').slice(0, 11)
        let formatted = digits
        if (digits.length <= 2) formatted = digits
        else if (digits.length <= 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
        else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
        return formatted
    }

    function openCreateModal() {
        setModalMode('create')
        setEditingUser(null)
        setFormData({ nome: '', email: '', senha: '', cpf: '', telefone: '', tipoConta: 'cliente' })
        setShowModal(true)
    }

    function openEditModal(usuario) {
        if (!isAdmin && usuario.uid !== userInfo?.uid && usuario.id !== userInfo?.uid) {
            setAlert('Você só pode editar seu próprio cadastro')
            return
        }
        setModalMode('edit')
        setEditingUser(usuario)
        setFormData({
            nome: usuario.nome || '',
            email: usuario.email || '',
            senha: '',
            cpf: formatCpf(usuario.cpf || ''),
            telefone: formatTelefone(usuario.telefone || ''),
            tipoConta: usuario.tipoConta || 'cliente'
        })
        setShowModal(true)
    }

    async function handleCreateUser(e) {
        e.preventDefault()
        setAlert('')
        setCreating(true)
        let secondaryApp = null;
        try {
            secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.senha)
            await signOut(secondaryAuth);
            const newUserId = userCredential.user.uid
            const userPayload = {
                uid: newUserId,
                email: formData.email,
                nome: formData.nome,
                cpf: formatCpf(formData.cpf),
                telefone: formData.telefone.replace(/\D/g, ''), 
                tipoConta: formData.tipoConta,
                createdAt: serverTimestamp()
            }
            await setDoc(doc(db, 'user_info', newUserId), userPayload)
            setAlert('Conta criada com sucesso!')
            setFormData({ nome: '', email: '', senha: '', cpf: '', telefone: '', tipoConta: 'cliente' })
            setShowModal(false)
            loadUsuarios()
        } catch (err) {
            console.error('Erro ao criar usuário:', err)
            if (err.code === 'auth/email-already-in-use') setAlert('Este email já está em uso')
            else if (err.code === 'auth/weak-password') setAlert('A senha deve ter pelo menos 6 caracteres')
            else setAlert('Erro ao criar conta: ' + err.message)
        } finally {
            setCreating(false)
        }
    }

    async function handleUpdateUser(e) {
        e.preventDefault()
        if (!editingUser) return
        if (!isAdmin && editingUser.uid !== userInfo?.uid && editingUser.id !== userInfo?.uid) {
            setAlert('Você só pode editar seu próprio cadastro')
            setShowModal(false)
            return
        }
        setAlert('')
        setCreating(true)
        try {
            const payload = {
                nome: formData.nome,
                email: formData.email,
                cpf: formatCpf(formData.cpf),
                telefone: formData.telefone.replace(/\D/g, ''), 
                updatedAt: serverTimestamp()
            }
            if (isAdmin) payload.tipoConta = formData.tipoConta
            await setDoc(doc(db, 'user_info', editingUser.id), payload, { merge: true })
            setAlert('Conta atualizada com sucesso!')
            setShowModal(false)
            setEditingUser(null)
            setModalMode('create')
            if (isAdmin) loadUsuarios()
            else loadOwnUser()
        } catch (err) {
            console.error('Erro ao atualizar usuário:', err)
            setAlert('Erro ao atualizar usuário')
        } finally {
            setCreating(false)
        }
    }

    function handleSubmit(e) {
        if (modalMode === 'edit') handleUpdateUser(e)
        else handleCreateUser(e)
    }

    async function handleDeleteUser(userId) {
        if (!window.confirm('Tem certeza que deseja excluir esta conta?')) return

        try {
            const q1 = query(contratosCollection, where('clienteInquilinoComprador', '==', userId), where('statusContrato', '==', 'ativo'))
            const q2 = query(contratosCollection, where('clienteProprietario', '==', userId), where('statusContrato', '==', 'ativo'))
            
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])

            if (!snap1.empty || !snap2.empty) {
                setAlert('Não é possível excluir: O usuário possui contratos ativos vinculados.')
                return
            }

            await deleteDoc(doc(db, 'user_info', userId))
            setAlert('Conta excluída com sucesso!')
            loadUsuarios()
        } catch (err) {
            console.error('Erro ao excluir conta:', err)
            setAlert('Erro ao excluir conta')
        }
    }

    if (loading) return <div className="usuarios-container"><div className="loading">Carregando contas...</div></div>

    return (
        <div className="usuarios-container">
            <div className="usuarios-header">
                <h1>{isAdmin ? 'Gerenciamento de Contas' : 'Meu Cadastro'}</h1>
                {isAdmin && (
                    <button className="btn-primary" onClick={openCreateModal}>+ Criar Nova Conta</button>
                )}
            </div>

            {alert && <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>{alert}</div>}
            
            {/* --- CAMPO DE PESQUISA ADICIONADO [RFS04] --- */}
            {isAdmin && (
                <div className="filters-container" style={{ marginBottom: '20px' }}>
                    <div className="filter-group" style={{ width: '100%', maxWidth: '400px' }}>
                        <label>Buscar Usuário</label>
                        <input 
                            type="text" 
                            placeholder="Buscar por Nome, Email ou CPF..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>
            )}

            <div className="usuarios-table-container">
                <table className="usuarios-table">
                    <thead>
                        <tr>
                            <th>Nome</th><th>Email</th><th>CPF/CNPJ</th><th>Telefone</th><th>Tipo de Conta</th><th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Usando filteredUsuarios aqui */}
                        {filteredUsuarios.map(usuario => {
                            const nome = usuario.nome || usuario.name || usuario.email || '-'
                            const cpf = usuario.cpf || '-'
                            const telefone = usuario.telefone ? formatTelefone(usuario.telefone) : '-'
                            const rawTipo = (usuario.tipoConta || '').toString().toLowerCase()
                            let tipoKey = 'cliente'; let tipoLabel = 'Cliente'
                            if (rawTipo.includes('adm') || rawTipo.includes('admin')) { tipoKey = 'adm'; tipoLabel = 'Administrador' }
                            else if (rawTipo.includes('corretor')) { tipoKey = 'corretor'; tipoLabel = 'Corretor' }
                            const disableDelete = usuario.id === userInfo?.uid || usuario.uid === userInfo?.uid
                            return (
                                <tr key={usuario.id}>
                                    <td>{nome}</td><td>{usuario.email || '-'}</td><td>{cpf}</td><td>{telefone}</td>
                                    <td><span className={`badge badge-${tipoKey}`}>{tipoLabel}</span></td>
                                    <td>
                                        <button className="btn-secondary btn-sm" onClick={() => openEditModal(usuario)}>Editar</button>
                                        {isAdmin && <button className="btn-danger btn-sm" onClick={() => handleDeleteUser(usuario.id)} disabled={disableDelete}>Excluir</button>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modalMode === 'edit' ? 'Editar Conta' : 'Criar Nova Conta'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Nome Completo *</label>
                                <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                            </div>
                            {modalMode === 'create' && (
                                <div className="form-group">
                                    <label>Senha *</label>
                                    <input type="password" value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} required minLength={6} />
                                </div>
                            )}
                            <div className="form-group">
                                <label>CPF/CNPJ</label>
                                <input type="text" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" />
                            </div>
                            <div className="form-group">
                                <label>Telefone</label>
                                <input type="text" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} placeholder="(00) 00000-0000" />
                            </div>
                            {isAdmin && (
                                <div className="form-group">
                                    <label>Tipo de Conta *</label>
                                    <select value={formData.tipoConta} onChange={(e) => setFormData({ ...formData, tipoConta: e.target.value })} required>
                                        <option value="cliente">Cliente</option>
                                        <option value="corretor">Corretor</option>
                                        <option value="adm">Administrador</option>
                                    </select>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Salvando...' : modalMode === 'edit' ? 'Salvar Alterações' : 'Criar Conta'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}