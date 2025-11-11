import { useState, useEffect } from 'react'
import { auth, db, userInfoCollection } from '../../../firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { getDocs, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import './usuarios.css'

export default function Usuarios({ userInfo }) {
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
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

    useEffect(() => {
        if (userInfo?.tipoConta !== 'adm') {
            return
        }
        loadUsuarios()
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
            setAlert('Erro ao carregar contas')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreateUser(e) {
        e.preventDefault()
        setAlert('')
        setCreating(true)

        // Salvar credenciais do admin atual
        const currentUser = auth.currentUser
        const adminEmail = currentUser.email

        try {
            // Criar usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                formData.email,
                formData.senha
            )

            const newUserId = userCredential.user.uid

            // Criar documento no Firestore
            const userPayload = {
                uid: newUserId,
                email: formData.email,
                nome: formData.nome,
                cpf: formData.cpf,
                telefone: formData.telefone,
                tipoConta: formData.tipoConta,
                createdAt: serverTimestamp()
            }

            await setDoc(doc(db, 'user_info', newUserId), userPayload)

            // Nota: O Firebase Auth faz login automaticamente no usuário criado
            // Em produção, é recomendado usar Firebase Admin SDK no backend
            // para criar usuários sem fazer login automaticamente

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
            loadUsuarios()
            
            // Informar sobre a limitação (opcional - pode ser removido em produção com backend)
            console.warn('Nota: O usuário foi criado, mas o Firebase Auth fez login automaticamente no novo usuário. Em produção, use Firebase Admin SDK no backend.')
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

    if (userInfo?.tipoConta !== 'adm') {
        return (
            <div className="usuarios-container">
                <div className="alert-error">Acesso negado. Apenas administradores podem acessar esta página.</div>
            </div>
        )
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
                <h1>Gerenciamento de Contas</h1>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    + Criar Nova Conta
                </button>
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
                        {usuarios.map(usuario => (
                            <tr key={usuario.id}>
                                <td>{usuario.nome}</td>
                                <td>{usuario.email}</td>
                                <td>{usuario.cpf || '-'}</td>
                                <td>{usuario.telefone || '-'}</td>
                                <td>
                                    <span className={`badge badge-${usuario.tipoConta}`}>
                                        {usuario.tipoConta === 'adm' ? 'Administrador' :
                                         usuario.tipoConta === 'corretor' ? 'Corretor' : 'Cliente'}
                                    </span>
                                </td>
                                <td>
                                    <button 
                                        className="btn-danger btn-sm"
                                        onClick={() => handleDeleteUser(usuario.id)}
                                        disabled={usuario.id === userInfo?.uid}
                                    >
                                        Excluir
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Criar Nova Conta</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateUser} className="modal-form">
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
                            <div className="form-group">
                                <label>CPF/CNPJ</label>
                                <input
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Telefone</label>
                                <input
                                    type="text"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipo de Conta *</label>
                                <select
                                    value={formData.tipoConta}
                                    onChange={(e) => setFormData({ ...formData, tipoConta: e.target.value })}
                                    required
                                >
                                    <option value="cliente">Cliente</option>
                                    <option value="corretor">Corretor</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={creating}>
                                    {creating ? 'Criando...' : 'Criar Conta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

