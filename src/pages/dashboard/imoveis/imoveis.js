import { useState, useEffect, useCallback } from 'react'
import { imoveisCollection, db, userInfoCollection, contratosCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import './imoveis.css'

export default function Imoveis({ userInfo }) {
    const [imoveis, setImoveis] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingImovel, setEditingImovel] = useState(null)
    const [formData, setFormData] = useState({
        endereco: '',
        tipoImovel: 'casa',
        finalidade: 'venda',
        valor: '',
        status: 'disponivel',
        areaTotal: '',
        quartos: '',
        banheiros: '',
        vagasGaragem: '',
        clienteProprietario: '',
        descricao: ''
    })
    const [filterInputs, setFilterInputs] = useState({
        localidade: '',
        tipo: '',
        valorMin: '',
        valorMax: ''
    })
    const [filtros, setFiltros] = useState({
        localidade: '',
        tipo: '',
        valorMin: '',
        valorMax: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

    // Formata enquanto digita (Input)
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

    // ADICIONADO: Formata para exibição (Display nos Cards)
    function formatCurrencyDisplay(value) {
        if (!value) return 'R$ 0,00'
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const parseCurrency = (value) => {
        if (!value) return 0
        const numbers = value.replace(/\D/g, '')
        return parseFloat(numbers) / 100
    }

    const formatInteger = (value) => {
        if (!value) return ''
        const digits = value.replace(/\D/g, '')
        if (!digits) return ''
        return digits
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
            setLoading(true)
            let imoveisQuery = imoveisCollection
            const snapshot = await getDocs(imoveisQuery)
            let imoveisList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            if (filtros.localidade) imoveisList = imoveisList.filter(i => i.endereco?.toLowerCase().includes(filtros.localidade.toLowerCase()))
            if (filtros.tipo) imoveisList = imoveisList.filter(i => i.finalidade === filtros.tipo || i.tipo === filtros.tipo)
            if (filtros.valorMin) imoveisList = imoveisList.filter(i => parseFloat(i.valor) >= parseFloat(filtros.valorMin))
            if (filtros.valorMax) imoveisList = imoveisList.filter(i => parseFloat(i.valor) <= parseFloat(filtros.valorMax))

            setImoveis(imoveisList)
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
            setAlert('Erro ao carregar imóveis')
        } finally {
            setLoading(false)
        }
    }, [filtros])

    useEffect(() => {
        loadImoveis()
        loadClientes()
    }, [loadImoveis, loadClientes])

    function handleOpenModal(imovel = null) {
        if (imovel) {
            setEditingImovel(imovel)
            setFormData({
                endereco: imovel.endereco || '',
                tipoImovel: imovel.tipoImovel || 'casa',
                finalidade: imovel.finalidade || 'venda',
                valor: imovel.valor ? formatCurrency(String(imovel.valor * 100)) : '',
                status: imovel.status || 'disponivel',
                areaTotal: imovel.areaTotal || imovel.area || '',
                quartos: imovel.quartos || '',
                banheiros: imovel.banheiros || '',
                vagasGaragem: imovel.vagasGaragem || '',
                clienteProprietario: imovel.clienteProprietario || imovel.clienteId || '',
                descricao: imovel.descricao || ''
            })
        } else {
            setEditingImovel(null)
            setFormData({
                endereco: '',
                tipoImovel: 'casa',
                finalidade: 'venda',
                valor: '',
                status: 'disponivel',
                areaTotal: '',
                quartos: '',
                banheiros: '',
                vagasGaragem: '',
                clienteProprietario: '',
                descricao: ''
            })
        }
        setShowModal(true)
        setAlert('')
    }

    function handleApply() { setFiltros({ ...filterInputs }) }
    function handleClear() {
        const empty = { localidade: '', tipo: '', valorMin: '', valorMax: '' }
        setFilterInputs(empty); setFiltros(empty)
    }
    useEffect(() => {
        const id = setTimeout(() => setFiltros({ ...filterInputs }), 400)
        return () => clearTimeout(id)
    }, [filterInputs])

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')
        const valorNum = parseCurrency(formData.valor)
        if (valorNum < 1000 || valorNum > 10000000) { setAlert('O valor deve estar entre R$ 1.000,00 e R$ 10.000.000,00'); return }
        
        const imovelData = {
            endereco: formData.endereco,
            tipoImovel: formData.tipoImovel,
            finalidade: formData.finalidade,
            valor: valorNum,
            status: formData.status,
            areaTotal: parseInt(formData.areaTotal) || 0,
            quartos: parseInt(formData.quartos) || 0,
            banheiros: parseInt(formData.banheiros) || 0,
            vagasGaragem: parseInt(formData.vagasGaragem) || 0,
            clienteProprietario: formData.clienteProprietario || null,
            descricao: formData.descricao,
            updatedAt: serverTimestamp()
        }

        try {
            if (editingImovel) {
                await updateDoc(doc(db, 'imoveis', editingImovel.id), imovelData)
                setAlert('Imóvel atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) imovelData.clienteProprietario = userInfo?.uid
                imovelData.createdAt = serverTimestamp()
                await addDoc(imoveisCollection, imovelData)
                setAlert('Imóvel criado com sucesso!')
            }
            setShowModal(false)
            loadImoveis()
        } catch (err) {
            console.error('Erro ao salvar imóvel:', err)
            setAlert('Erro ao salvar imóvel: ' + err.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Tem certeza que deseja excluir este imóvel?')) return

        try {
            const q = query(contratosCollection, where('imovelVinculado', '==', id), where('statusContrato', '==', 'ativo'))
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
                setAlert('Não é possível excluir: O imóvel possui contratos ativos vinculados.')
                return
            }

            await deleteDoc(doc(db, 'imoveis', id))
            setAlert('Imóvel excluído com sucesso!')
            loadImoveis()
        } catch (err) {
            console.error('Erro ao excluir imóvel:', err)
            setAlert('Erro ao excluir imóvel')
        }
    }

    if (loading) return <div className="imoveis-container"><div className="loading">Carregando imóveis...</div></div>

    return (
        <div className="imoveis-container">
            <div className="imoveis-header">
                <h1>Gerenciamento de Imóveis</h1>
                {(isAdmin || isCorretor) && <button className="btn-primary" onClick={() => handleOpenModal()}>+ Adicionar Imóvel</button>}
            </div>
            {alert && <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>{alert}</div>}
            
            <div className="filters-container">
                <div className="filter-group">
                    <label>Localidade</label>
                    <input type="text" placeholder="Ex: Itajubá" value={filterInputs.localidade} onChange={(e) => setFilterInputs({ ...filterInputs, localidade: e.target.value })} />
                </div>
                <div className="filter-group">
                    <label>Finalidade</label>
                    <select value={filterInputs.tipo} onChange={(e) => setFilterInputs({ ...filterInputs, tipo: e.target.value })}>
                        <option value="">Todos</option><option value="venda">Venda</option><option value="locacao">Locação</option><option value="temporada">Temporada</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Valor Mínimo</label>
                    <input type="number" placeholder="0" value={filterInputs.valorMin} onChange={(e) => setFilterInputs({ ...filterInputs, valorMin: formatInteger(e.target.value) })} min="0" />
                </div>
                <div className="filter-group">
                    <label>Valor Máximo</label>
                    <input type="number" placeholder="0" value={filterInputs.valorMax} onChange={(e) => setFilterInputs({ ...filterInputs, valorMax: formatInteger(e.target.value) })} min="0" />
                </div>
                <div className="filter-actions">
                    <button type="button" className="btn-clear" onClick={handleClear}>Limpar</button>
                    <button type="button" className="btn-apply" onClick={handleApply}>Aplicar</button>
                </div>
            </div>

            <div className="imoveis-grid">
                {imoveis.map(imovel => (
                    <div key={imovel.id} className="imovel-card">
                        <div className="imovel-header">
                            <h3>{imovel.endereco}</h3>
                            <span className={`status-badge status-${imovel.status}`}>
                                {imovel.status === 'disponivel' ? 'Disponível' : imovel.status === 'alugado' ? 'Alugado' : imovel.status === 'vendido' ? 'Vendido' : 'Em negociação'}
                            </span>
                        </div>
                        <div className="imovel-details">
                            <span>💰 {formatCurrencyDisplay(imovel.valor)}</span>
                            <span>🛏️ {imovel.quartos || 0} quartos</span>
                            <span>🚿 {imovel.banheiros || 0} banheiros</span>
                            <span>📐 {imovel.areaTotal || 0}m²</span>
                            {imovel.vagasGaragem && <span>🚗 {imovel.vagasGaragem} vagas</span>}
                        </div>
                        <p className="imovel-tipo">{imovel.finalidade === 'venda' ? 'À Venda' : 'Para Locação'}</p>
                        {(isAdmin || isCorretor) && (
                            <div className="imovel-actions">
                                <button className="btn-edit" onClick={() => handleOpenModal(imovel)}>Editar</button>
                                <button className="btn-danger btn-sm" onClick={() => handleDelete(imovel.id)}>Excluir</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {imoveis.length === 0 && <div className="empty-state"><p>Nenhum imóvel encontrado.</p></div>}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingImovel ? 'Editar Imóvel' : 'Adicionar Imóvel'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Endereço *</label>
                                <input type="text" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade, estado" required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tipo de Imóvel *</label>
                                    <select value={formData.tipoImovel} onChange={(e) => setFormData({ ...formData, tipoImovel: e.target.value })} required>
                                        <option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="comercial">Comercial</option><option value="terreno">Terreno</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Finalidade *</label>
                                    <select value={formData.finalidade} onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })} required>
                                        <option value="venda">Venda</option><option value="locacao">Locação</option><option value="temporada">Temporada</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor *</label>
                                    <input type="text" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: formatCurrency(e.target.value) })} required />
                                    <small>Entre R$ 1.000,00 e R$ 10.000.000,00</small>
                                </div>
                                <div className="form-group">
                                    <label>Status *</label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required>
                                        <option value="disponivel">Disponível</option><option value="alugado">Alugado</option><option value="vendido">Vendido</option><option value="em_negociacao">Em negociação</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Área Total (m²) *</label>
                                    <input type="number" value={formData.areaTotal} onChange={(e) => setFormData({ ...formData, areaTotal: formatInteger(e.target.value) })} min="0" max="999" required />
                                </div>
                                <div className="form-group">
                                    <label>Quartos *</label>
                                    <input type="number" value={formData.quartos} onChange={(e) => setFormData({ ...formData, quartos: formatInteger(e.target.value) })} min="0" max="99" required />
                                </div>
                                <div className="form-group">
                                    <label>Banheiros *</label>
                                    <input type="number" value={formData.banheiros} onChange={(e) => setFormData({ ...formData, banheiros: formatInteger(e.target.value) })} min="0" max="99" required />
                                </div>
                                <div className="form-group">
                                    <label>Vagas *</label>
                                    <input type="number" value={formData.vagasGaragem} onChange={(e) => setFormData({ ...formData, vagasGaragem: formatInteger(e.target.value) })} min="0" max="99" required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Cliente Proprietário</label>
                                <select value={formData.clienteProprietario} onChange={(e) => setFormData({ ...formData, clienteProprietario: e.target.value })}>
                                    <option value="">Selecione um cliente</option>
                                    {clientes.map(cliente => (
                                        <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Descrição *</label>
                                <textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows="4" required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">{editingImovel ? 'Atualizar' : 'Criar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}