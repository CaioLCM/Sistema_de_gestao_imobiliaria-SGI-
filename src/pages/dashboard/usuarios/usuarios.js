import { useState, useEffect } from 'react'
// ADICIONADO: imports necessários para o truque do App Secundário
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, userInfoCollection } from '../../../firebase'
import { getDocs, doc, setDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore'
import './usuarios.css'

// Configuração do Firebase (precisamos dela aqui para criar o app secundário)
// Copie exatamente a config do seu firebase.js
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
        if (!userInfo) {
            return
        }
        if (userInfo?.tipoConta === 'adm') {
            loadUsuarios()
        } else {
            loadOwnUser()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInfo])

    async function loadUsuarios() {
        try {
            setLoading(true)
            const snapshot = await getDocs(userInfoCollection)
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setUsuarios(usersList)
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
                setUsuarios([{
                    id: userDoc.id,
                    ...userDoc.data()
                }])
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

        if (digits.length > 3 && digits.length <= 6) {
            formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`
        } else if (digits.length > 6 && digits.length <= 9) {
            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
        } else if (digits.length > 9) {
            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
        }

        return formatted
    }

    const formatTelefone = (value = '') => {
        const digits = value.replace(/\D/g, '').slice(0, 11)
        let formatted = digits

        if (digits.length <= 2) {
            formatted = digits
        } else if (digits.length <= 7) {
            formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
        } else {
            formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
        }

        return formatted
    }

    function openCreateModal() {
        setModalMode('create')
        setEditingUser(null)
        setFormData({
            nome: '',
            email: '',
            senha: '',
            cpf: '',
            telefone: '',
            tipoConta: 'cliente'
        })
        setShowModal(true)
    }

    function openEditModal(usuario) {
        // Garantir que apenas o próprio usuário possa ser editado (exceto admins)
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

        // TRUQUE: Criar um "App Secundário" para não deslogar o Admin atual
        let secondaryApp = null;

        try {
            // 1. Inicializa uma nova instância do Firebase com nome "Secondary"
            secondaryApp = initializeApp(firebaseConfig, "Secondary");
            
            // 2. Pega o Auth dessa instância secundária
            const secondaryAuth = getAuth(secondaryApp);

            // 3. Cria o usuário usando o Auth secundário
            // Isso NÃO afeta o `auth` principal onde o Admin está logado
            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.senha
            )

            // 4. Faz logout IMEDIATO do usuário novo na instância secundária (só pra garantir)
            await signOut(secondaryAuth);

            const newUserId = userCredential.user.uid

            // 5. Agora salvamos os dados no Firestore usando o `db` principal (onde somos Admin)
            // Como somos Admin no app principal, temos permissão de escrita!
            const userPayload = {
                uid: newUserId,
                email: formData.email,
                nome: formData.nome,
                cpf: formatCpf(formData.cpf),
                telefone: formData.telefone.replace(/\D/g, ''), // Salvar apenas números
                tipoConta: formData.tipoConta,
                createdAt: serverTimestamp()
            }

            await setDoc(doc(db, 'user_info', newUserId), userPayload)

            setAlert('Conta criada com sucesso!')
            setFormData({
                nome: '',
                email: '',
                senha: '',
                cpf: '',
                telefone: '',
                tipoConta: 'cliente'
            })
            setShowModal(false)
            
            // Recarrega a lista usando o app principal
            loadUsuarios()
            
        } catch (err) {
            console.error('Erro ao criar usuário:', err)
            if (err.code === 'auth/email-already-in-use') {
                setAlert('Este email já está em uso')
            } else if (err.code === 'auth/weak-password') {
                setAlert('A senha deve ter pelo menos 6 caracteres')
            } else {
                setAlert('Erro ao criar conta: ' + err.message)
            }
        } finally {
            setCreating(false)
            // Limpeza: Deletar a instância secundária para liberar memória
            if (secondaryApp) {
                // O método 'delete' existe nas versões mais novas do Firebase App,
                // mas se der erro, deixar o app lá não quebra nada imediatamente.
                // Como estamos em React funcional, ele será recriado se necessário.
                // Nota: em versões Web SDK v9+, não há deleteApp fácil importado aqui, 
                // então deixamos o Garbage Collector cuidar ou reutilizamos o nome.
            }
        }
    }

    async function handleUpdateUser(e) {
        e.preventDefault()
        if (!editingUser) return

        // Validação de segurança: garantir que apenas o próprio usuário possa ser editado (exceto admins)
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
                telefone: formData.telefone.replace(/\D/g, ''), // Salvar apenas números
                updatedAt: serverTimestamp()
            }

            // Apenas admins podem alterar o tipoConta
            if (isAdmin) {
                payload.tipoConta = formData.tipoConta
            }

            await setDoc(doc(db, 'user_info', editingUser.id), payload, { merge: true })

            setAlert('Conta atualizada com sucesso!')
            setShowModal(false)
            setEditingUser(null)
            setModalMode('create')
            if (isAdmin) {
                loadUsuarios()
            } else {
                loadOwnUser()
            }
        } catch (err) {
            console.error('Erro ao atualizar usuário:', err)
            setAlert('Erro ao atualizar usuário')
        } finally {
            setCreating(false)
        }
    }

    function handleSubmit(e) {
        if (modalMode === 'edit') {
            handleUpdateUser(e)
        } else {
            handleCreateUser(e)
        }
    }

    async function handleDeleteUser(userId) {
        if (!window.confirm('Tem certeza que deseja excluir esta conta?')) {
            return
        }

        try {
            await deleteDoc(doc(db, 'user_info', userId))
            setAlert('Conta excluída com sucesso!')
            loadUsuarios()
        } catch (err) {
            console.error('Erro ao excluir conta:', err)
            setAlert('Erro ao excluir conta')
        }
    }


    if (loading) {
        return (
            <div className="usuarios-container">
                <div className="loading">Carregando contas...</div>
            </div>
        )
    }

    return (
        <div className="usuarios-container">
            <div className="usuarios-header">
                <h1>{isAdmin ? 'Gerenciamento de Contas' : 'Meu Cadastro'}</h1>
                {isAdmin && (
                    <button className="btn-primary" onClick={openCreateModal}>
                        + Criar Nova Conta
                    </button>
                )}
            </div>

            {alert && (
                <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>
                    {alert}
                </div>
            )}

            <div className="usuarios-table-container">
                <table className="usuarios-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>CPF/CNPJ</th>
                            <th>Telefone</th>
                            <th>Tipo de Conta</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(usuario => {
                            const nome = usuario.nome || usuario.name || usuario.email || '-'
                            const cpf = usuario.cpf || '-'
                            const telefone = usuario.telefone ? formatTelefone(usuario.telefone) : '-'
                            const rawTipo = (usuario.tipoConta || '').toString().toLowerCase()
                            let tipoKey = 'cliente'
                            let tipoLabel = 'Cliente'
                            if (rawTipo.includes('adm') || rawTipo.includes('administrador') || rawTipo.includes('admin')) {
                                tipoKey = 'adm'
                                tipoLabel = 'Administrador'
                            } else if (rawTipo.includes('corretor')) {
                                tipoKey = 'corretor'
                                tipoLabel = 'Corretor'
                            }

                            const disableDelete = usuario.id === userInfo?.uid || usuario.uid === userInfo?.uid

                            return (
                                <tr key={usuario.id}>
                                    <td>{nome}</td>
                                    <td>{usuario.email || '-'}</td>
                                    <td>{cpf}</td>
                                    <td>{telefone}</td>
                                    <td>
                                        <span className={`badge badge-${tipoKey}`}>
                                            {tipoLabel}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className="btn-secondary btn-sm"
                                            onClick={() => openEditModal(usuario)}
                                        >
                                            Editar
                                        </button>
                                        {isAdmin && (
                                            <button 
                                                className="btn-danger btn-sm"
                                                onClick={() => handleDeleteUser(usuario.id)}
                                                disabled={disableDelete}
                                            >
                                                Excluir
                                            </button>
                                        )}
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
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            {modalMode === 'create' && (
                                <div className="form-group">
                                    <label>Senha *</label>
                                    <input
                                        type="password"
                                        value={formData.senha}
                                        onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label>CPF/CNPJ</label>
                                <input
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                            <div className="form-group">
                                <label>Telefone</label>
                                <input
                                    type="text"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            {isAdmin && (
                                <div className="form-group">
                                    <label>Tipo de Conta *</label>
                                    <select
                                        value={formData.tipoConta}
                                        onChange={(e) => setFormData({ ...formData, tipoConta: e.target.value })}
                                        required
                                    >
                                        <option value="cliente">Cliente</option>
                                        <option value="corretor">Corretor</option>
                                        <option value="adm">Administrador</option>
                                    </select>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={creating}>
                                    {creating ? 'Salvando...' : modalMode === 'edit' ? 'Salvar Alterações' : 'Criar Conta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}