import { useState, useEffect, useCallback } from 'react'
import { imoveisCollection, db } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './imoveis.css'

export default function Imoveis({ userInfo }) {
    const [imoveis, setImoveis] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingImovel, setEditingImovel] = useState(null)
    const [formData, setFormData] = useState({
        endereco: '',
        cidade: '',
        tipo: 'venda',
        valor: '',
        quartos: '',
        banheiros: '',
        area: '',
        descricao: '',
        status: 'disponivel'
    })
    const [filtros, setFiltros] = useState({
        localidade: '',
        tipo: '',
        valorMin: '',
        valorMax: ''
    })
    const [filterInputs, setFilterInputs] = useState({
        localidade: '',
        tipo: '',
        valorMin: '',
        valorMax: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

    const loadImoveis = useCallback(async () => {
        try {
            setLoading(true)
            let imoveisQuery = imoveisCollection

            // Visualização: todos os usuários (inclusive clientes) podem ver a listagem completa.
            // Apenas a criação/edição/exclusão estão restritas a admins/corretores.

            const snapshot = await getDocs(imoveisQuery)
            let imoveisList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Aplicar filtros de busca
            if (filtros.localidade) {
                imoveisList = imoveisList.filter(i => 
                    i.cidade?.toLowerCase().includes(filtros.localidade.toLowerCase())
                )
            }
            if (filtros.tipo) {
                imoveisList = imoveisList.filter(i => i.tipo === filtros.tipo)
            }
            if (filtros.valorMin) {
                imoveisList = imoveisList.filter(i => 
                    parseFloat(i.valor) >= parseFloat(filtros.valorMin)
                )
            }
            if (filtros.valorMax) {
                imoveisList = imoveisList.filter(i => 
                    parseFloat(i.valor) <= parseFloat(filtros.valorMax)
                )
            }

            setImoveis(imoveisList)
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
            setAlert('Erro ao carregar imóveis')
        } finally {
            setLoading(false)
        }
    }, [userInfo, filtros, isAdmin, isCorretor])

    useEffect(() => {
        loadImoveis()
    }, [loadImoveis])

    function handleOpenModal(imovel = null) {
        if (imovel) {
            setEditingImovel(imovel)
            setFormData({
                endereco: imovel.endereco || '',
                cidade: imovel.cidade || '',
                tipo: imovel.tipo || 'venda',
                valor: imovel.valor || '',
                quartos: imovel.quartos || '',
                banheiros: imovel.banheiros || '',
                area: imovel.area || '',
                descricao: imovel.descricao || '',
                status: imovel.status || 'disponivel'
            })
        } else {
            setEditingImovel(null)
            setFormData({
                endereco: '',
                cidade: '',
                tipo: 'venda',
                valor: '',
                quartos: '',
                banheiros: '',
                area: '',
                descricao: '',
                status: 'disponivel'
            })
        }
        setShowModal(true)
        setAlert('')
    }

    function handleApply() {
        setFiltros({ ...filterInputs })
    }

    function handleClear() {
        const empty = { localidade: '', tipo: '', valorMin: '', valorMax: '' }
        setFilterInputs(empty)
        setFiltros(empty)
    }

    // Debounce auto-apply: aplica filtros 400ms após o usuário parar de digitar
    useEffect(() => {
        const id = setTimeout(() => {
            setFiltros({ ...filterInputs })
        }, 400)
        return () => clearTimeout(id)
    }, [filterInputs])

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')

        try {
            const imovelData = {
                ...formData,
                valor: parseFloat(formData.valor),
                quartos: parseInt(formData.quartos) || 0,
                banheiros: parseInt(formData.banheiros) || 0,
                area: parseFloat(formData.area) || 0,
                updatedAt: serverTimestamp()
            }

            if (editingImovel) {
                // Atualizar
                await updateDoc(doc(db, 'imoveis', editingImovel.id), imovelData)
                setAlert('Imóvel atualizado com sucesso!')
            } else {
                // Criar
                if (!isAdmin && !isCorretor) {
                    imovelData.clienteId = userInfo?.uid
                }
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
        if (!window.confirm('Tem certeza que deseja excluir este imóvel?')) {
            return
        }

        try {
            await deleteDoc(doc(db, 'imoveis', id))
            setAlert('Imóvel excluído com sucesso!')
            loadImoveis()
        } catch (err) {
            console.error('Erro ao excluir imóvel:', err)
            setAlert('Erro ao excluir imóvel')
        }
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    if (loading) {
        return (
            <div className="imoveis-container">
                <div className="loading">Carregando imóveis...</div>
            </div>
        )
    }

    return (
        <div className="imoveis-container">
            <div className="imoveis-header">
                <h1>Gerenciamento de Imóveis</h1>
                {(isAdmin || isCorretor) && (
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Adicionar Imóvel
                    </button>
                )}
            </div>

            {alert && (
                <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>
                    {alert}
                </div>
            )}

            <div className="filters-container">
                <div className="filter-group">
                    <label>Localidade</label>
                    <input
                        type="text"
                        placeholder="Ex: Itajubá"
                        value={filterInputs.localidade}
                        onChange={(e) => setFilterInputs({ ...filterInputs, localidade: e.target.value })}
                    />
                </div>
                <div className="filter-group">
                    <label>Tipo</label>
                    <select
                        value={filterInputs.tipo}
                        onChange={(e) => setFilterInputs({ ...filterInputs, tipo: e.target.value })}
                    >
                        <option value="">Todos</option>
                        <option value="venda">Venda</option>
                        <option value="aluguel">Aluguel</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Valor Mínimo</label>
                    <input
                        type="number"
                        placeholder="R$ 0"
                        value={filterInputs.valorMin}
                        onChange={(e) => setFilterInputs({ ...filterInputs, valorMin: e.target.value })}
                    />
                </div>
                <div className="filter-group">
                    <label>Valor Máximo</label>
                    <input
                        type="number"
                        placeholder="R$ 0"
                        value={filterInputs.valorMax}
                        onChange={(e) => setFilterInputs({ ...filterInputs, valorMax: e.target.value })}
                    />
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
                                {imovel.status === 'disponivel' ? 'Disponível' : 'Indisponível'}
                            </span>
                        </div>
                        <p className="imovel-cidade">{imovel.cidade}</p>
                        <div className="imovel-details">
                            <span>💰 {formatCurrency(imovel.valor)}</span>
                            <span>🛏️ {imovel.quartos} quartos</span>
                            <span>🚿 {imovel.banheiros} banheiros</span>
                            <span>📐 {imovel.area}m²</span>
                        </div>
                        <p className="imovel-tipo">{imovel.tipo === 'venda' ? 'À Venda' : 'Para Alugar'}</p>
                        {(isAdmin || isCorretor) && (
                            <div className="imovel-actions">
                                <button className="btn-edit" onClick={() => handleOpenModal(imovel)}>
                                    Editar
                                </button>
                                <button className="btn-danger btn-sm" onClick={() => handleDelete(imovel.id)}>
                                    Excluir
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {imoveis.length === 0 && (
                <div className="empty-state">
                    <p>Nenhum imóvel encontrado.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingImovel ? 'Editar Imóvel' : 'Adicionar Imóvel'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Endereço *</label>
                                    <input
                                        type="text"
                                        value={formData.endereco}
                                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cidade *</label>
                                    <input
                                        type="text"
                                        value={formData.cidade}
                                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tipo *</label>
                                    <select
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                        required
                                    >
                                        <option value="venda">Venda</option>
                                        <option value="aluguel">Aluguel</option>
                                    </select>
                                </div>
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
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Quartos</label>
                                    <input
                                        type="number"
                                        value={formData.quartos}
                                        onChange={(e) => setFormData({ ...formData, quartos: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Banheiros</label>
                                    <input
                                        type="number"
                                        value={formData.banheiros}
                                        onChange={(e) => setFormData({ ...formData, banheiros: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Área (m²)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.area}
                                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="disponivel">Disponível</option>
                                    <option value="indisponivel">Indisponível</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    rows="4"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingImovel ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
