import { useState, useEffect } from 'react'
import { pagamentosCollection, db, imoveisCollection, userInfoCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './pagamentos.css'

export default function Pagamentos({ userInfo }) {
    const [pagamentos, setPagamentos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingPagamento, setEditingPagamento] = useState(null)
    const [formData, setFormData] = useState({
        imovelId: '',
        valor: '',
        dataVencimento: '',
        dataPagamento: '',
        status: 'pendente',
        descricao: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

    useEffect(() => {
        loadImoveis()
        loadPagamentos()
    }, [userInfo])

    async function loadImoveis() {
        try {
            let imoveisQuery = imoveisCollection
            if (!isAdmin && !isCorretor) {
                imoveisQuery = query(imoveisCollection, where('clienteId', '==', userInfo?.uid))
            }
            const snapshot = await getDocs(imoveisQuery)
            const imoveisList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setImoveis(imoveisList)
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
        }
    }

    async function loadPagamentos() {
        try {
            setLoading(true)
            let pagamentosQuery = pagamentosCollection
            if (!isAdmin && !isCorretor) {
                pagamentosQuery = query(pagamentosCollection, where('clienteId', '==', userInfo?.uid))
            }

            const snapshot = await getDocs(pagamentosQuery)
            const pagamentosList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Buscar informações dos imóveis relacionados
            const imoveisSnapshot = await getDocs(imoveisCollection)
            const allImoveis = imoveisSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            const pagamentosComImoveis = pagamentosList.map(pagamento => {
                if (pagamento.imovelId) {
                    const imovel = allImoveis.find(i => i.id === pagamento.imovelId)
                    if (imovel) {
                        pagamento.imovel = imovel
                    }
                }
                return pagamento
            })

            setPagamentos(pagamentosComImoveis)
        } catch (err) {
            console.error('Erro ao carregar pagamentos:', err)
            setAlert('Erro ao carregar pagamentos')
        } finally {
            setLoading(false)
        }
    }

    function handleOpenModal(pagamento = null) {
        if (pagamento) {
            setEditingPagamento(pagamento)
            setFormData({
                imovelId: pagamento.imovelId || '',
                valor: pagamento.valor || '',
                dataVencimento: pagamento.dataVencimento || '',
                dataPagamento: pagamento.dataPagamento || '',
                status: pagamento.status || 'pendente',
                descricao: pagamento.descricao || ''
            })
        } else {
            setEditingPagamento(null)
            setFormData({
                imovelId: '',
                valor: '',
                dataVencimento: '',
                dataPagamento: '',
                status: 'pendente',
                descricao: ''
            })
        }
        setShowModal(true)
        setAlert('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')

        try {
            const pagamentoData = {
                ...formData,
                valor: parseFloat(formData.valor),
                updatedAt: serverTimestamp()
            }

            if (editingPagamento) {
                await updateDoc(doc(db, 'pagamentos', editingPagamento.id), pagamentoData)
                setAlert('Pagamento atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) {
                    pagamentoData.clienteId = userInfo?.uid
                }
                pagamentoData.createdAt = serverTimestamp()
                await addDoc(pagamentosCollection, pagamentoData)
                setAlert('Pagamento criado com sucesso!')
            }

            setShowModal(false)
            loadPagamentos()
        } catch (err) {
            console.error('Erro ao salvar pagamento:', err)
            setAlert('Erro ao salvar pagamento: ' + err.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Tem certeza que deseja excluir este pagamento?')) {
            return
        }

        try {
            await deleteDoc(doc(db, 'pagamentos', id))
            setAlert('Pagamento excluído com sucesso!')
            loadPagamentos()
        } catch (err) {
            console.error('Erro ao excluir pagamento:', err)
            setAlert('Erro ao excluir pagamento')
        }
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    function formatDate(dateString) {
        if (!dateString) return '-'
        const date = new Date(dateString)
        return date.toLocaleDateString('pt-BR')
    }

    if (loading) {
        return (
            <div className="pagamentos-container">
                <div className="loading">Carregando pagamentos...</div>
            </div>
        )
    }

    return (
        <div className="pagamentos-container">
            <div className="pagamentos-header">
                <h1>Gerenciamento de Pagamentos</h1>
                {isCorretor && (
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Adicionar Pagamento
                    </button>
                )}
            </div>

            {alert && (
                <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>
                    {alert}
                </div>
            )}

            <div className="pagamentos-table-container">
                <table className="pagamentos-table">
                    <thead>
                        <tr>
                            <th>Imóvel</th>
                            <th>Valor</th>
                            <th>Vencimento</th>
                            <th>Pagamento</th>
                            <th>Status</th>
                            <th>Descrição</th>
                            {isCorretor && <th>Ações</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pagamentos.map(pagamento => (
                            <tr key={pagamento.id}>
                                <td>{pagamento.imovel?.endereco || '-'}</td>
                                <td>{formatCurrency(pagamento.valor)}</td>
                                <td>{formatDate(pagamento.dataVencimento)}</td>
                                <td>{formatDate(pagamento.dataPagamento)}</td>
                                <td>
                                    <span className={`status-badge status-${pagamento.status}`}>
                                        {pagamento.status === 'pago' ? 'Pago' :
                                         pagamento.status === 'pendente' ? 'Pendente' : 'Atrasado'}
                                    </span>
                                </td>
                                <td>{pagamento.descricao || '-'}</td>
                                {isCorretor && (
                                    <td>
                                        <button 
                                            className="btn-edit btn-sm"
                                            onClick={() => handleOpenModal(pagamento)}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            className="btn-danger btn-sm"
                                            onClick={() => handleDelete(pagamento.id)}
                                        >
                                            Excluir
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pagamentos.length === 0 && (
                <div className="empty-state">
                    <p>Nenhum pagamento encontrado.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingPagamento ? 'Editar Pagamento' : 'Adicionar Pagamento'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Imóvel *</label>
                                <select
                                    value={formData.imovelId}
                                    onChange={(e) => setFormData({ ...formData, imovelId: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione um imóvel</option>
                                    {imoveis.map(imovel => (
                                        <option key={imovel.id} value={imovel.id}>
                                            {imovel.endereco} - {imovel.cidade}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.valor}
                                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Status *</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        required
                                    >
                                        <option value="pendente">Pendente</option>
                                        <option value="pago">Pago</option>
                                        <option value="atrasado">Atrasado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Data de Vencimento</label>
                                    <input
                                        type="date"
                                        value={formData.dataVencimento}
                                        onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data de Pagamento</label>
                                    <input
                                        type="date"
                                        value={formData.dataPagamento}
                                        onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    rows="3"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingPagamento ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
