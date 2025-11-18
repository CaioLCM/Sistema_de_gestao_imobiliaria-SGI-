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
    
    // NOVOS ESTADOS PARA FILTRO
    const [filterInputs, setFilterInputs] = useState({
        tipo: '',
        status: '',
        cliente: ''
    })
    const [filteredPagamentos, setFilteredPagamentos] = useState([])

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

    const formatCurrency = (value) => {
        if (!value) return ''
        const numbers = value.replace(/\D/g, '')
        if (!numbers) return ''
        const amount = parseFloat(numbers) / 100
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    }

    const parseCurrency = (value) => {
        if (!value) return 0
        const numbers = value.replace(/\D/g, '')
        return parseFloat(numbers) / 100
    }

    const loadClientes = useCallback(async () => {
        if (!isAdmin && !isCorretor) return;
        try {
            const snapshot = await getDocs(userInfoCollection)
            const clientesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(user => {
                    const tipo = (user.tipoConta || '').toString().toLowerCase()
                    return tipo.includes('cliente') || (!tipo.includes('adm') && !tipo.includes('corretor'))
                })
            setClientes(clientesList)
        } catch (err) { console.error('Erro ao carregar clientes:', err) }
    }, [isAdmin, isCorretor])

    const loadImoveis = useCallback(async () => {
        try {
            let imoveisQuery = imoveisCollection
            const snapshot = await getDocs(imoveisQuery)
            const imoveisList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(imovel => {
                    const status = (imovel.status || '').toString().toLowerCase()
                    return status === 'alugado' || status === 'em_negociacao' || status === 'disponivel'
                })
            setImoveis(imoveisList)
        } catch (err) { console.error('Erro ao carregar imóveis:', err) }
    }, [])

    const loadPagamentos = useCallback(async () => {
        try {
            setLoading(true)
            let q;
            if (isAdmin || isCorretor) q = pagamentosCollection;
            else {
                if (!userInfo?.uid) return;
                q = query(pagamentosCollection, where('clienteInquilinoComprador', '==', userInfo.uid));
            }

            const snapshot = await getDocs(q)
            let pagamentosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            let allImoveis = []; let allClientes = []

            try {
                const imoveisSnapshot = await getDocs(imoveisCollection)
                allImoveis = imoveisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                if (isAdmin || isCorretor) {
                    const clientesSnapshot = await getDocs(userInfoCollection)
                    allClientes = clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                }
            } catch(e) { console.log("Acesso restrito a dados auxiliares")}

            const pagamentosCompleto = pagamentosList.map(pagamento => {
                if (pagamento.contratoVinculado) {
                    const imovel = allImoveis.find(i => i.id === pagamento.contratoVinculado)
                    if (imovel) pagamento.contrato = imovel
                }
                if (pagamento.clienteInquilinoComprador) {
                    const cliente = allClientes.find(c => c.id === pagamento.clienteInquilinoComprador)
                    if (cliente) pagamento.clienteInquilino = cliente
                }
                if (pagamento.clienteProprietario) {
                    const cliente = allClientes.find(c => c.id === pagamento.clienteProprietario)
                    if (cliente) pagamento.clienteProprietarioInfo = cliente
                }
                return pagamento
            })
            setPagamentos(pagamentosCompleto)
            setFilteredPagamentos(pagamentosCompleto)
        } catch (err) { console.error('Erro ao carregar pagamentos:', err) } finally { setLoading(false) }
    }, [isAdmin, isCorretor, userInfo])

    useEffect(() => {
        let result = pagamentos;
        if (filterInputs.tipo) result = result.filter(p => p.tipoPagamento === filterInputs.tipo)
        if (filterInputs.status) result = result.filter(p => p.status === filterInputs.status)
        if (filterInputs.cliente) {
            const search = filterInputs.cliente.toLowerCase();
            result = result.filter(p => {
                const nomeInquilino = p.clienteInquilino?.nome?.toLowerCase() || '';
                const nomeProprietario = p.clienteProprietarioInfo?.nome?.toLowerCase() || '';
                return nomeInquilino.includes(search) || nomeProprietario.includes(search);
            })
        }
        setFilteredPagamentos(result);
    }, [filterInputs, pagamentos])

    useEffect(() => {
        loadImoveis(); loadClientes(); loadPagamentos()
    }, [loadImoveis, loadClientes, loadPagamentos])

    function handleOpenModal(pagamento = null) {
        if (pagamento && !isAdmin) { setAlert('Apenas administradores podem editar pagamentos'); return }
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
                tipoPagamento: 'aluguel', contratoVinculado: '', clienteInquilinoComprador: '', clienteProprietario: '',
                dataVencimento: '', dataPagamento: '', valor: '', formaPagamento: 'boleto', status: 'pendente', observacoes: ''
            })
        }
        setShowModal(true); setAlert('')
    }

    async function handleSubmit(e) {
        e.preventDefault(); setAlert('')
        const valorNum = parseCurrency(formData.valor)
        if (valorNum < 1 || valorNum > 1000000) { setAlert('O valor deve estar entre R$ 1,00 e R$ 1.000.000,00'); return }
        if (formData.dataVencimento && formData.dataPagamento) {
            if (new Date(formData.dataPagamento) < new Date(formData.dataVencimento)) { setAlert('A data de pagamento não pode ser anterior à data de vencimento'); return }
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
                if (!isAdmin) { setAlert('Apenas administradores podem editar pagamentos'); return }
                await updateDoc(doc(db, 'pagamentos', editingPagamento.id), pagamentoData)
                setAlert('Pagamento atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) { setAlert('Apenas administradores e corretores podem cadastrar pagamentos'); return }
                pagamentoData.createdAt = serverTimestamp()
                await addDoc(pagamentosCollection, pagamentoData)
                setAlert('Pagamento criado com sucesso!')
            }
            setShowModal(false); loadPagamentos()
        } catch (err) { console.error('Erro ao salvar pagamento:', err); setAlert('Erro ao salvar pagamento: ' + err.message) }
    }

    // --- LÓGICA DE EXCLUSÃO COM VALIDAÇÃO [RFC04] ---
    async function handleDelete(id) {
        if (!isAdmin) {
            setAlert('Apenas administradores podem excluir pagamentos')
            return
        }

        const pagamentoParaDeletar = pagamentos.find(p => p.id === id)
        
        // Validação: Bloquear se já foi pago
        if (pagamentoParaDeletar && (pagamentoParaDeletar.status === 'pago' || pagamentoParaDeletar.status === 'Pago')) {
            setAlert('Não é possível excluir um pagamento que já foi confirmado como "Pago".')
            return
        }

        if (!window.confirm('Tem certeza que deseja excluir este pagamento?')) return

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
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }
    function formatDate(dateString) {
        if (!dateString) return '-'
        const date = new Date(dateString)
        return date.toLocaleDateString('pt-BR')
    }
    function handleClearFilters() { setFilterInputs({ tipo: '', status: '', cliente: '' }) }

    if (loading) return <div className="pagamentos-container"><div className="loading">Carregando pagamentos...</div></div>

    return (
        <div className="pagamentos-container">
            <div className="pagamentos-header">
                <h1>Gerenciamento de Pagamentos</h1>
                {(isAdmin || isCorretor) && <button className="btn-primary" onClick={() => handleOpenModal()}>+ Adicionar Pagamento</button>}
            </div>
            {alert && <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>{alert}</div>}
            
            <div className="filters-container" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
                <div className="filter-group">
                    <label>Tipo</label>
                    <select value={filterInputs.tipo} onChange={e => setFilterInputs({...filterInputs, tipo: e.target.value})}>
                        <option value="">Todos</option><option value="aluguel">Aluguel</option><option value="comissao">Comissão</option><option value="repasse">Repasse</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Status</label>
                    <select value={filterInputs.status} onChange={e => setFilterInputs({...filterInputs, status: e.target.value})}>
                        <option value="">Todos</option><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Cliente (Nome)</label>
                    <input type="text" placeholder="Buscar por nome..." value={filterInputs.cliente} onChange={e => setFilterInputs({...filterInputs, cliente: e.target.value})} />
                </div>
                <button className="btn-secondary" onClick={handleClearFilters} style={{ height: '40px' }}>Limpar Filtros</button>
            </div>

            <div className="pagamentos-table-container">
                <table className="pagamentos-table">
                    <thead>
                        <tr><th>Tipo</th><th>Contrato</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Pagamento</th><th>Forma</th><th>Status</th><th>Obs</th>{(isAdmin || isCorretor) && <th>Ações</th>}</tr>
                    </thead>
                    <tbody>
                        {filteredPagamentos.map(pagamento => (
                            <tr key={pagamento.id}>
                                <td>{pagamento.tipoPagamento === 'aluguel' ? 'Aluguel' : pagamento.tipoPagamento === 'comissao' ? 'Comissão' : 'Repasse'}</td>
                                <td>{pagamento.contrato?.endereco || pagamento.contratoVinculado || '-'}</td>
                                <td>{pagamento.clienteInquilino?.nome || (pagamento.clienteInquilinoComprador === userInfo?.uid ? 'Você' : '-')}</td>
                                <td>{formatCurrencyDisplay(pagamento.valor)}</td>
                                <td>{formatDate(pagamento.dataVencimento)}</td>
                                <td>{formatDate(pagamento.dataPagamento)}</td>
                                <td>{pagamento.formaPagamento === 'boleto' ? 'Boleto' : pagamento.formaPagamento === 'pix' ? 'Pix' : pagamento.formaPagamento === 'transferencia' ? 'Transf.' : 'Cartão'}</td>
                                <td><span className={`status-badge status-${pagamento.status}`}>{pagamento.status === 'pago' ? 'Pago' : pagamento.status === 'pendente' ? 'Pendente' : 'Atrasado'}</span></td>
                                <td>{pagamento.observacoes || pagamento.descricao || '-'}</td>
                                {(isAdmin || isCorretor) && (
                                    <td>
                                        {isAdmin && <><button className="btn-edit btn-sm" onClick={() => handleOpenModal(pagamento)}>Editar</button><button className="btn-danger btn-sm" onClick={() => handleDelete(pagamento.id)}>Excluir</button></>}
                                        {isCorretor && !isAdmin && <span className="text-muted">Apenas consulta</span>}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filteredPagamentos.length === 0 && <div className="empty-state"><p>Nenhum pagamento encontrado.</p></div>}

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
                                    <select value={formData.tipoPagamento} onChange={(e) => setFormData({ ...formData, tipoPagamento: e.target.value })} required>
                                        <option value="aluguel">Aluguel</option><option value="comissao">Comissão</option><option value="repasse">Repasse</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Contrato Vinculado</label>
                                    <select value={formData.contratoVinculado} onChange={(e) => setFormData({ ...formData, contratoVinculado: e.target.value })}>
                                        <option value="">Selecione um contrato</option>
                                        {imoveis.map(imovel => <option key={imovel.id} value={imovel.id}>{imovel.endereco} - {imovel.finalidade === 'venda' ? 'Venda' : 'Locação'}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cliente Inquilino/Comprador</label>
                                    <select value={formData.clienteInquilinoComprador} onChange={(e) => setFormData({ ...formData, clienteInquilinoComprador: e.target.value })}>
                                        <option value="">Selecione um cliente</option>
                                        {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.name || cliente.email}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Cliente Proprietário</label>
                                    <select value={formData.clienteProprietario} onChange={(e) => setFormData({ ...formData, clienteProprietario: e.target.value })}>
                                        <option value="">Selecione um cliente</option>
                                        {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.name || cliente.email}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Data de Vencimento *</label>
                                    <input type="date" value={formData.dataVencimento} onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Data de Pagamento</label>
                                    <input type="date" value={formData.dataPagamento} onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })} max={new Date().toISOString().split('T')[0]} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor *</label>
                                    <input type="text" value={formData.valor} onChange={(e) => { const formatted = formatCurrency(e.target.value); setFormData({ ...formData, valor: formatted }) }} required />
                                </div>
                                <div className="form-group">
                                    <label>Forma de Pagamento *</label>
                                    <select value={formData.formaPagamento} onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })} required>
                                        <option value="boleto">Boleto</option><option value="pix">Pix</option><option value="transferencia">Transferência</option><option value="cartao">Cartão</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Status *</label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required>
                                        <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Observações</label>
                                <textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows="3" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">{editingPagamento ? 'Atualizar' : 'Criar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}