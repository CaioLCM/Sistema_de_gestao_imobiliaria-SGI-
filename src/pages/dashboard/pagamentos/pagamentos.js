import { useState, useEffect, useCallback } from 'react'
import { pagamentosCollection, db, imoveisCollection, userInfoCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './pagamentos.css'

export default function Pagamentos({ userInfo }) {
    const [pagamentos, setPagamentos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingPagamento, setEditingPagamento] = useState(null)
    const [formData, setFormData] = useState({
        tipoPagamento: 'aluguel',
        contratoVinculado: '',
        clienteInquilinoComprador: '',
        clienteProprietario: '',
        dataVencimento: '',
        dataPagamento: '',
        valor: '',
        formaPagamento: 'boleto',
        status: 'pendente',
        observacoes: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'
    const isCliente = !isAdmin && !isCorretor

    // Função para formatar valor monetário
    const formatCurrency = (value) => {
        if (!value) return ''
        const numbers = value.replace(/\D/g, '')
        if (!numbers) return ''
        const amount = parseFloat(numbers) / 100
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount)
    }

    // Função para converter valor formatado para número
    const parseCurrency = (value) => {
        if (!value) return 0
        const numbers = value.replace(/\D/g, '')
        return parseFloat(numbers) / 100
    }

    // Carregar lista de clientes
    const loadClientes = useCallback(async () => {
        try {
            const snapshot = await getDocs(userInfoCollection)
            const clientesList = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(user => {
                    const tipo = (user.tipoConta || '').toString().toLowerCase()
                    return tipo.includes('cliente') || (!tipo.includes('adm') && !tipo.includes('corretor'))
                })
            setClientes(clientesList)
        } catch (err) {
            console.error('Erro ao carregar clientes:', err)
        }
    }, [])

    const loadImoveis = useCallback(async () => {
        try {
            // Carregar imóveis para usar como contratos vinculados (contratos ativos)
            let imoveisQuery = imoveisCollection
            const snapshot = await getDocs(imoveisQuery)
            const imoveisList = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(imovel => {
                    // Filtrar apenas imóveis com status que indicam contrato ativo
                    const status = (imovel.status || '').toString().toLowerCase()
                    return status === 'alugado' || status === 'em_negociacao' || status === 'disponivel'
                })
            setImoveis(imoveisList)
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
        }
    }, [])

    const loadPagamentos = useCallback(async () => {
        try {
            setLoading(true)
            let pagamentosQuery = pagamentosCollection

            const snapshot = await getDocs(pagamentosQuery)
            let pagamentosList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Filtrar por cliente: clientes só veem pagamentos associados a eles
            if (!isAdmin && !isCorretor) {
                const clienteId = userInfo?.uid || userInfo?.id
                pagamentosList = pagamentosList.filter(p => 
                    p.clienteInquilinoComprador === clienteId || 
                    p.clienteProprietario === clienteId ||
                    p.clienteInquilinoComprador === userInfo?.id ||
                    p.clienteProprietario === userInfo?.id ||
                    p.clienteId === clienteId ||
                    p.clienteId === userInfo?.id
                )
            }

            // Buscar informações dos imóveis/contratos relacionados
            const imoveisSnapshot = await getDocs(imoveisCollection)
            const allImoveis = imoveisSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Buscar informações dos clientes
            const clientesSnapshot = await getDocs(userInfoCollection)
            const allClientes = clientesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            const pagamentosCompleto = pagamentosList.map(pagamento => {
                // Adicionar informações do contrato/imóvel
                if (pagamento.contratoVinculado) {
                    const imovel = allImoveis.find(i => i.id === pagamento.contratoVinculado)
                    if (imovel) {
                        pagamento.contrato = imovel
                    }
                }
                // Adicionar informações do cliente inquilino/comprador
                if (pagamento.clienteInquilinoComprador) {
                    const cliente = allClientes.find(c => c.id === pagamento.clienteInquilinoComprador || c.uid === pagamento.clienteInquilinoComprador)
                    if (cliente) {
                        pagamento.clienteInquilino = cliente
                    }
                }
                // Adicionar informações do cliente proprietário
                if (pagamento.clienteProprietario) {
                    const cliente = allClientes.find(c => c.id === pagamento.clienteProprietario || c.uid === pagamento.clienteProprietario)
                    if (cliente) {
                        pagamento.clienteProprietarioInfo = cliente
                    }
                }
                return pagamento
            })

            setPagamentos(pagamentosCompleto)
        } catch (err) {
            console.error('Erro ao carregar pagamentos:', err)
            setAlert('Erro ao carregar pagamentos')
        } finally {
            setLoading(false)
        }
    }, [isAdmin, isCorretor, userInfo])

    useEffect(() => {
        loadImoveis()
        loadClientes()
        loadPagamentos()
    }, [loadImoveis, loadClientes, loadPagamentos])

    function handleOpenModal(pagamento = null) {
        if (pagamento) {
            setEditingPagamento(pagamento)
            setFormData({
                tipoPagamento: pagamento.tipoPagamento || 'aluguel',
                contratoVinculado: pagamento.contratoVinculado || pagamento.imovelId || '',
                clienteInquilinoComprador: pagamento.clienteInquilinoComprador || '',
                clienteProprietario: pagamento.clienteProprietario || '',
                dataVencimento: pagamento.dataVencimento || '',
                dataPagamento: pagamento.dataPagamento || '',
                valor: pagamento.valor ? formatCurrency(String(pagamento.valor * 100)) : '',
                formaPagamento: pagamento.formaPagamento || 'boleto',
                status: pagamento.status || 'pendente',
                observacoes: pagamento.observacoes || pagamento.descricao || ''
            })
        } else {
            setEditingPagamento(null)
            setFormData({
                tipoPagamento: 'aluguel',
                contratoVinculado: '',
                clienteInquilinoComprador: '',
                clienteProprietario: '',
                dataVencimento: '',
                dataPagamento: '',
                valor: '',
                formaPagamento: 'boleto',
                status: 'pendente',
                observacoes: ''
            })
        }
        setShowModal(true)
        setAlert('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')

        // Validações
        const valorNum = parseCurrency(formData.valor)
        if (valorNum < 1 || valorNum > 1000000) {
            setAlert('O valor deve estar entre R$ 1,00 e R$ 1.000.000,00')
            return
        }

        // Validar datas
        if (formData.dataVencimento && formData.dataPagamento) {
            const dataVenc = new Date(formData.dataVencimento)
            const dataPag = new Date(formData.dataPagamento)
            if (dataPag < dataVenc) {
                setAlert('A data de pagamento não pode ser anterior à data de vencimento')
                return
            }
        }

        // Validar que ambas as datas respeitam o calendário vigente (não são futuras demais)
        const hoje = new Date()
        hoje.setHours(23, 59, 59, 999) // Fim do dia de hoje
        
        if (formData.dataVencimento) {
            const dataVenc = new Date(formData.dataVencimento)
            // Permitir datas futuras para vencimento (normal em contratos)
        }

        if (formData.dataPagamento) {
            const dataPag = new Date(formData.dataPagamento)
            if (dataPag > hoje) {
                setAlert('A data de pagamento não pode ser futura')
                return
            }
        }

        try {
            const pagamentoData = {
                tipoPagamento: formData.tipoPagamento,
                contratoVinculado: formData.contratoVinculado || null,
                clienteInquilinoComprador: formData.clienteInquilinoComprador || null,
                clienteProprietario: formData.clienteProprietario || null,
                dataVencimento: formData.dataVencimento || null,
                dataPagamento: formData.dataPagamento || null,
                valor: valorNum,
                formaPagamento: formData.formaPagamento,
                status: formData.status,
                observacoes: formData.observacoes || null,
                updatedAt: serverTimestamp()
            }

            if (editingPagamento) {
                // Apenas Admin pode editar
                if (!isAdmin) {
                    setAlert('Apenas administradores podem editar pagamentos')
                    return
                }
                await updateDoc(doc(db, 'pagamentos', editingPagamento.id), pagamentoData)
                setAlert('Pagamento atualizado com sucesso!')
            } else {
                // Admin e Corretor podem cadastrar
                if (!isAdmin && !isCorretor) {
                    setAlert('Apenas administradores e corretores podem cadastrar pagamentos')
                    return
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
        // Apenas Admin pode excluir
        if (!isAdmin) {
            setAlert('Apenas administradores podem excluir pagamentos')
            return
        }

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

    function formatCurrencyDisplay(value) {
        if (!value) return 'R$ 0,00'
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
                {(isAdmin || isCorretor) && (
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
                            <th>Tipo</th>
                            <th>Contrato</th>
                            <th>Cliente Inquilino/Comprador</th>
                            <th>Cliente Proprietário</th>
                            <th>Valor</th>
                            <th>Vencimento</th>
                            <th>Pagamento</th>
                            <th>Forma de Pagamento</th>
                            <th>Status</th>
                            <th>Observações</th>
                            {(isAdmin || isCorretor) && <th>Ações</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pagamentos.map(pagamento => (
                            <tr key={pagamento.id}>
                                <td>
                                    {pagamento.tipoPagamento === 'aluguel' ? 'Aluguel' :
                                     pagamento.tipoPagamento === 'comissao' ? 'Comissão' :
                                     pagamento.tipoPagamento === 'repasse' ? 'Repasse' : '-'}
                                </td>
                                <td>{pagamento.contrato?.endereco || pagamento.contratoVinculado || '-'}</td>
                                <td>{pagamento.clienteInquilino?.nome || pagamento.clienteInquilino?.name || pagamento.clienteInquilino?.email || '-'}</td>
                                <td>{pagamento.clienteProprietarioInfo?.nome || pagamento.clienteProprietarioInfo?.name || pagamento.clienteProprietarioInfo?.email || '-'}</td>
                                <td>{formatCurrencyDisplay(pagamento.valor)}</td>
                                <td>{formatDate(pagamento.dataVencimento)}</td>
                                <td>{formatDate(pagamento.dataPagamento)}</td>
                                <td>
                                    {pagamento.formaPagamento === 'boleto' ? 'Boleto' :
                                     pagamento.formaPagamento === 'pix' ? 'Pix' :
                                     pagamento.formaPagamento === 'transferencia' ? 'Transferência' :
                                     pagamento.formaPagamento === 'cartao' ? 'Cartão' : '-'}
                                </td>
                                <td>
                                    <span className={`status-badge status-${pagamento.status}`}>
                                        {pagamento.status === 'pago' ? 'Pago' :
                                         pagamento.status === 'pendente' ? 'Pendente' : 'Atrasado'}
                                    </span>
                                </td>
                                <td>{pagamento.observacoes || pagamento.descricao || '-'}</td>
                                {(isAdmin || isCorretor) && (
                                    <td>
                                        {isAdmin && (
                                            <>
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
                                            </>
                                        )}
                                        {isCorretor && !isAdmin && (
                                            <span className="text-muted">Apenas consulta</span>
                                        )}
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
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tipo de Pagamento *</label>
                                    <select
                                        value={formData.tipoPagamento}
                                        onChange={(e) => setFormData({ ...formData, tipoPagamento: e.target.value })}
                                        required
                                    >
                                        <option value="aluguel">Aluguel</option>
                                        <option value="comissao">Comissão</option>
                                        <option value="repasse">Repasse</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Contrato Vinculado</label>
                                    <select
                                        value={formData.contratoVinculado}
                                        onChange={(e) => setFormData({ ...formData, contratoVinculado: e.target.value })}
                                    >
                                        <option value="">Selecione um contrato</option>
                                        {imoveis.map(imovel => (
                                            <option key={imovel.id} value={imovel.id}>
                                                {imovel.endereco} - {imovel.finalidade === 'venda' ? 'Venda' : imovel.finalidade === 'locacao' ? 'Locação' : 'Temporada'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cliente Inquilino/Comprador</label>
                                    <select
                                        value={formData.clienteInquilinoComprador}
                                        onChange={(e) => setFormData({ ...formData, clienteInquilinoComprador: e.target.value })}
                                    >
                                        <option value="">Selecione um cliente</option>
                                        {clientes.map(cliente => (
                                            <option key={cliente.id} value={cliente.id}>
                                                {cliente.nome || cliente.name || cliente.email} {cliente.email ? `(${cliente.email})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Cliente Proprietário</label>
                                    <select
                                        value={formData.clienteProprietario}
                                        onChange={(e) => setFormData({ ...formData, clienteProprietario: e.target.value })}
                                    >
                                        <option value="">Selecione um cliente</option>
                                        {clientes.map(cliente => (
                                            <option key={cliente.id} value={cliente.id}>
                                                {cliente.nome || cliente.name || cliente.email} {cliente.email ? `(${cliente.email})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Data de Vencimento *</label>
                                    <input
                                        type="date"
                                        value={formData.dataVencimento}
                                        onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data de Pagamento</label>
                                    <input
                                        type="date"
                                        value={formData.dataPagamento}
                                        onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                    <small>A data de pagamento não pode ser anterior à data de vencimento</small>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor *</label>
                                    <input
                                        type="text"
                                        value={formData.valor}
                                        onChange={(e) => {
                                            const formatted = formatCurrency(e.target.value)
                                            setFormData({ ...formData, valor: formatted })
                                        }}
                                        placeholder="R$ 0,00"
                                        required
                                    />
                                    <small>Entre R$ 1,00 e R$ 1.000.000,00</small>
                                </div>
                                <div className="form-group">
                                    <label>Forma de Pagamento *</label>
                                    <select
                                        value={formData.formaPagamento}
                                        onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })}
                                        required
                                    >
                                        <option value="boleto">Boleto</option>
                                        <option value="pix">Pix</option>
                                        <option value="transferencia">Transferência</option>
                                        <option value="cartao">Cartão</option>
                                    </select>
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
                            <div className="form-group">
                                <label>Observações</label>
                                <textarea
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
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
