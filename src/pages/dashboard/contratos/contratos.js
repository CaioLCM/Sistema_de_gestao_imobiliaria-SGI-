import { useState, useEffect, useCallback } from 'react'
import { contratosCollection, db, imoveisCollection, userInfoCollection, pagamentosCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './contratos.css'

export default function Contratos({ userInfo }) {
    const [contratos, setContratos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingContrato, setEditingContrato] = useState(null)
    const [formData, setFormData] = useState({
        tipoContrato: 'locacao',
        imovelVinculado: '',
        clienteInquilinoComprador: '',
        clienteProprietario: '',
        dataInicio: '',
        dataTermino: '',
        valorMensalOuTotal: '',
        formaPagamento: 'boleto',
        statusContrato: 'ativo',
        observacoes: '',
        documentosAnexos: []
    })
    const [filtros, setFiltros] = useState({
        tipoContrato: '',
        imovelVinculado: '',
        clienteInquilinoComprador: '',
        clienteProprietario: ''
    })
    const [filterInputs, setFilterInputs] = useState({
        tipoContrato: '',
        imovelVinculado: '',
        clienteInquilinoComprador: '',
        clienteProprietario: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

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

    const parseCurrency = (value) => {
        if (!value) return 0
        const numbers = value.replace(/\D/g, '')
        return parseFloat(numbers) / 100
    }

    // --- CORREÇÃO 1: Clientes não podem ver a lista de todos os usuários ---
    const loadClientes = useCallback(async () => {
        if (!isAdmin && !isCorretor) return;

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
    }, [isAdmin, isCorretor])

    const loadImoveis = useCallback(async () => {
        try {
            const snapshot = await getDocs(imoveisCollection)
            const imoveisList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setImoveis(imoveisList)
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
        }
    }, [])

    // --- CORREÇÃO 2: Clientes buscam apenas SEUS contratos ---
    const loadContratos = useCallback(async () => {
        try {
            setLoading(true)
            let contratosList = []

            if (isAdmin || isCorretor) {
                // ADM/Corretor buscam tudo
                const snapshot = await getDocs(contratosCollection)
                contratosList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
            } else {
                // Cliente busca apenas os seus. 
                // Como o Firebase não suporta "OR" (OU) em queries simples no mesmo campo facilmente,
                // faremos duas queries e juntaremos os resultados.
                if (!userInfo?.uid) return;

                const q1 = query(contratosCollection, where('clienteInquilinoComprador', '==', userInfo.uid))
                const q2 = query(contratosCollection, where('clienteProprietario', '==', userInfo.uid))

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
                
                // Juntar e remover duplicatas (embora logicamente não deva haver duplicata se o usuário não for inquilino e proprietário do mesmo contrato)
                const docsMap = new Map();
                snap1.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
                snap2.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));
                
                contratosList = Array.from(docsMap.values());
            }

            // Carregar dados auxiliares apenas se tiver permissão
            let allImoveis = []
            let allClientes = []

            try {
                const imoveisSnapshot = await getDocs(imoveisCollection)
                allImoveis = imoveisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                
                if (isAdmin || isCorretor) {
                    const clientesSnapshot = await getDocs(userInfoCollection)
                    allClientes = clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                }
            } catch (e) { console.log("Sem permissão para dados auxiliares") }

            // Aplicar filtros (Front-end filtering)
            if (filtros.tipoContrato) {
                contratosList = contratosList.filter(c => c.tipoContrato === filtros.tipoContrato)
            }
            if (filtros.imovelVinculado) {
                contratosList = contratosList.filter(c => c.imovelVinculado === filtros.imovelVinculado)
            }
            if (filtros.clienteInquilinoComprador) {
                contratosList = contratosList.filter(c => c.clienteInquilinoComprador === filtros.clienteInquilinoComprador)
            }
            if (filtros.clienteProprietario) {
                contratosList = contratosList.filter(c => c.clienteProprietario === filtros.clienteProprietario)
            }

            const contratosCompleto = contratosList.map(contrato => {
                if (contrato.imovelVinculado) {
                    const imovel = allImoveis.find(i => i.id === contrato.imovelVinculado)
                    if (imovel) contrato.imovel = imovel
                }
                if (contrato.clienteInquilinoComprador) {
                    const cliente = allClientes.find(c => c.id === contrato.clienteInquilinoComprador)
                    // Se não achou na lista (porque é cliente e não pode ver lista), tenta ver se é ele mesmo
                    if (cliente) {
                        contrato.clienteInquilino = cliente
                    } else if (contrato.clienteInquilinoComprador === userInfo?.uid) {
                         contrato.clienteInquilino = userInfo
                    }
                }
                if (contrato.clienteProprietario) {
                    const cliente = allClientes.find(c => c.id === contrato.clienteProprietario)
                    if (cliente) {
                        contrato.clienteProprietarioInfo = cliente
                    } else if (contrato.clienteProprietario === userInfo?.uid) {
                        contrato.clienteProprietarioInfo = userInfo
                    }
                }
                return contrato
            })

            setContratos(contratosCompleto)
        } catch (err) {
            console.error('Erro ao carregar contratos:', err)
            // setAlert removido para evitar spam visual se for erro de permissão silencioso
        } finally {
            setLoading(false)
        }
    }, [filtros, isAdmin, isCorretor, userInfo])

    useEffect(() => {
        loadImoveis()
        loadClientes()
        loadContratos()
    }, [loadImoveis, loadClientes, loadContratos])

    function handleOpenModal(contrato = null) {
        if (contrato && !isAdmin) {
            setAlert('Apenas administradores podem editar contratos')
            return
        }
        if (contrato) {
            setEditingContrato(contrato)
            setFormData({
                tipoContrato: contrato.tipoContrato || 'locacao',
                imovelVinculado: contrato.imovelVinculado || '',
                clienteInquilinoComprador: contrato.clienteInquilinoComprador || '',
                clienteProprietario: contrato.clienteProprietario || '',
                dataInicio: contrato.dataInicio || '',
                dataTermino: contrato.dataTermino || '',
                valorMensalOuTotal: contrato.valorMensalOuTotal ? formatCurrency(String(contrato.valorMensalOuTotal * 100)) : '',
                formaPagamento: contrato.formaPagamento || 'boleto',
                statusContrato: contrato.statusContrato || 'ativo',
                observacoes: contrato.observacoes || '',
                documentosAnexos: contrato.documentosAnexos || []
            })
        } else {
            setEditingContrato(null)
            setFormData({
                tipoContrato: 'locacao',
                imovelVinculado: '',
                clienteInquilinoComprador: '',
                clienteProprietario: '',
                dataInicio: '',
                dataTermino: '',
                valorMensalOuTotal: '',
                formaPagamento: 'boleto',
                statusContrato: 'ativo',
                observacoes: '',
                documentosAnexos: []
            })
        }
        setShowModal(true)
        setAlert('')
    }

    function handleApply() {
        setFiltros({ ...filterInputs })
    }

    function handleClear() {
        const empty = { tipoContrato: '', imovelVinculado: '', clienteInquilinoComprador: '', clienteProprietario: '' }
        setFilterInputs(empty)
        setFiltros(empty)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')

        if (formData.dataInicio && formData.dataTermino) {
            const dataInicio = new Date(formData.dataInicio)
            const dataTermino = new Date(formData.dataTermino)
            if (dataTermino <= dataInicio) {
                setAlert('A data de término deve ser posterior à data de início')
                return
            }
        }

        const valorNum = parseCurrency(formData.valorMensalOuTotal)
        if (valorNum <= 0) {
            setAlert('O valor deve ser maior que zero')
            return
        }

        try {
            const contratoData = {
                tipoContrato: formData.tipoContrato,
                imovelVinculado: formData.imovelVinculado || null,
                clienteInquilinoComprador: formData.clienteInquilinoComprador || null,
                clienteProprietario: formData.clienteProprietario || null,
                dataInicio: formData.dataInicio || null,
                dataTermino: formData.dataTermino || null,
                valorMensalOuTotal: valorNum,
                formaPagamento: formData.formaPagamento,
                statusContrato: formData.statusContrato,
                observacoes: formData.observacoes || null,
                documentosAnexos: formData.documentosAnexos || [],
                updatedAt: serverTimestamp()
            }

            if (editingContrato) {
                if (!isAdmin) {
                    setAlert('Apenas administradores podem editar contratos')
                    return
                }
                await updateDoc(doc(db, 'contratos', editingContrato.id), contratoData)
                setAlert('Contrato atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) {
                    setAlert('Apenas administradores e corretores podem cadastrar contratos')
                    return
                }
                contratoData.createdAt = serverTimestamp()
                await addDoc(contratosCollection, contratoData)
                setAlert('Contrato criado com sucesso!')
            }

            setShowModal(false)
            loadContratos()
        } catch (err) {
            console.error('Erro ao salvar contrato:', err)
            setAlert('Erro ao salvar contrato: ' + err.message)
        }
    }

    async function handleDelete(id) {
        if (!isAdmin) {
            setAlert('Apenas administradores podem excluir contratos')
            return
        }

        const contrato = contratos.find(c => c.id === id)
        if (!contrato) {
            setAlert('Contrato não encontrado')
            return
        }

        if (contrato.statusContrato === 'ativo') {
            setAlert(`O contrato selecionado possui status: ativo`)
            return
        }

        try {
            const pagamentosSnapshot = await getDocs(pagamentosCollection)
            const pagamentosList = pagamentosSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            
            const pagamentosVinculados = pagamentosList.filter(p => 
                p.contratoVinculado === id || p.contratoId === id
            )

            if (pagamentosVinculados.length > 0) {
                setAlert(`O contrato selecionado possui pagamentos vinculados e não pode ser excluído.`)
                return
            }

            if (!window.confirm('Tem certeza que deseja excluir este contrato?')) {
                return
            }

            await deleteDoc(doc(db, 'contratos', id))
            setAlert('Contrato excluído com sucesso!')
            loadContratos()
        } catch (err) {
            console.error('Erro ao excluir contrato:', err)
            setAlert('Erro ao excluir contrato')
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
            <div className="contratos-container">
                <div className="loading">Carregando contratos...</div>
            </div>
        )
    }

    return (
        <div className="contratos-container">
            <div className="contratos-header">
                <h1>Gerenciamento de Contratos</h1>
                {(isAdmin || isCorretor) && (
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Adicionar Contrato
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
                    <label>Tipo de Contrato</label>
                    <select
                        value={filterInputs.tipoContrato}
                        onChange={(e) => setFilterInputs({ ...filterInputs, tipoContrato: e.target.value })}
                    >
                        <option value="">Todos</option>
                        <option value="locacao">Locação</option>
                        <option value="venda">Venda</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Imóvel Vinculado</label>
                    <select
                        value={filterInputs.imovelVinculado}
                        onChange={(e) => setFilterInputs({ ...filterInputs, imovelVinculado: e.target.value })}
                    >
                        <option value="">Todos</option>
                        {imoveis.map(imovel => (
                            <option key={imovel.id} value={imovel.id}>
                                {imovel.endereco}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label>Cliente Inquilino/Comprador</label>
                    <select
                        value={filterInputs.clienteInquilinoComprador}
                        onChange={(e) => setFilterInputs({ ...filterInputs, clienteInquilinoComprador: e.target.value })}
                    >
                        <option value="">Todos</option>
                        {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>
                                {cliente.nome || cliente.name || cliente.email}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label>Cliente Proprietário</label>
                    <select
                        value={filterInputs.clienteProprietario}
                        onChange={(e) => setFilterInputs({ ...filterInputs, clienteProprietario: e.target.value })}
                    >
                        <option value="">Todos</option>
                        {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>
                                {cliente.nome || cliente.name || cliente.email}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="filter-actions">
                    <button type="button" className="btn-clear" onClick={handleClear}>Limpar</button>
                    <button type="button" className="btn-apply" onClick={handleApply}>Aplicar</button>
                </div>
            </div>

            <div className="contratos-table-container">
                <table className="contratos-table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Imóvel</th>
                            <th>Cliente Inquilino/Comprador</th>
                            <th>Cliente Proprietário</th>
                            <th>Data Início</th>
                            <th>Data Término</th>
                            <th>Valor</th>
                            <th>Forma de Pagamento</th>
                            <th>Status</th>
                            {(isAdmin || isCorretor) && <th>Ações</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {contratos.map(contrato => (
                            <tr key={contrato.id}>
                                <td>
                                    {contrato.tipoContrato === 'locacao' ? 'Locação' : 'Venda'}
                                </td>
                                <td>{contrato.imovel?.endereco || '-'}</td>
                                <td>
                                    {contrato.clienteInquilino?.nome || (contrato.clienteInquilinoComprador === userInfo?.uid ? 'Você' : '-')}
                                </td>
                                <td>
                                    {contrato.clienteProprietarioInfo?.nome || (contrato.clienteProprietario === userInfo?.uid ? 'Você' : '-')}
                                </td>
                                <td>{formatDate(contrato.dataInicio)}</td>
                                <td>{formatDate(contrato.dataTermino)}</td>
                                <td>{formatCurrencyDisplay(contrato.valorMensalOuTotal)}</td>
                                <td>
                                    {contrato.formaPagamento === 'boleto' ? 'Boleto' :
                                     contrato.formaPagamento === 'pix' ? 'Pix' :
                                     contrato.formaPagamento === 'transferencia' ? 'Transferência' :
                                     contrato.formaPagamento === 'cartao' ? 'Cartão' : '-'}
                                </td>
                                <td>
                                    <span className={`status-badge status-${contrato.statusContrato}`}>
                                        {contrato.statusContrato === 'ativo' ? 'Ativo' :
                                         contrato.statusContrato === 'finalizado' ? 'Finalizado' :
                                         contrato.statusContrato === 'suspenso' ? 'Suspenso' : '-'}
                                    </span>
                                </td>
                                {(isAdmin || isCorretor) && (
                                    <td>
                                        {isAdmin && (
                                            <>
                                                <button 
                                                    className="btn-edit btn-sm"
                                                    onClick={() => handleOpenModal(contrato)}
                                                >
                                                    Editar
                                                </button>
                                                <button 
                                                    className="btn-danger btn-sm"
                                                    onClick={() => handleDelete(contrato.id)}
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

            {contratos.length === 0 && (
                <div className="empty-state">
                    <p>Nenhum contrato encontrado.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContrato ? 'Editar Contrato' : 'Adicionar Contrato'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tipo de Contrato *</label>
                                    <select
                                        value={formData.tipoContrato}
                                        onChange={(e) => setFormData({ ...formData, tipoContrato: e.target.value })}
                                        required
                                    >
                                        <option value="locacao">Locação</option>
                                        <option value="venda">Venda</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Imóvel Vinculado *</label>
                                    <select
                                        value={formData.imovelVinculado}
                                        onChange={(e) => setFormData({ ...formData, imovelVinculado: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione um imóvel</option>
                                        {imoveis.map(imovel => (
                                            <option key={imovel.id} value={imovel.id}>
                                                {imovel.endereco}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cliente Inquilino/Comprador *</label>
                                    <select
                                        value={formData.clienteInquilinoComprador}
                                        onChange={(e) => setFormData({ ...formData, clienteInquilinoComprador: e.target.value })}
                                        required
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
                                    <label>Cliente Proprietário *</label>
                                    <select
                                        value={formData.clienteProprietario}
                                        onChange={(e) => setFormData({ ...formData, clienteProprietario: e.target.value })}
                                        required
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
                                    <label>Data de Início *</label>
                                    <input
                                        type="date"
                                        value={formData.dataInicio}
                                        onChange={(e) => {
                                            setFormData({ ...formData, dataInicio: e.target.value })
                                            if (formData.dataTermino && new Date(formData.dataTermino) <= new Date(e.target.value)) {
                                                setFormData(prev => ({ ...prev, dataTermino: '' }))
                                            }
                                        }}
                                        max={formData.dataTermino || undefined}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data de Término {formData.tipoContrato === 'locacao' ? '*' : ''}</label>
                                    <input
                                        type="date"
                                        value={formData.dataTermino}
                                        onChange={(e) => setFormData({ ...formData, dataTermino: e.target.value })}
                                        min={formData.dataInicio || undefined}
                                        required={formData.tipoContrato === 'locacao'}
                                    />
                                    <small>A data de término deve ser posterior à data de início</small>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor Mensal ou Total *</label>
                                    <input
                                        type="text"
                                        value={formData.valorMensalOuTotal}
                                        onChange={(e) => {
                                            const formatted = formatCurrency(e.target.value)
                                            setFormData({ ...formData, valorMensalOuTotal: formatted })
                                        }}
                                        placeholder="R$ 0,00"
                                        required
                                    />
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
                                    <label>Status do Contrato *</label>
                                    <select
                                        value={formData.statusContrato}
                                        onChange={(e) => setFormData({ ...formData, statusContrato: e.target.value })}
                                        required
                                    >
                                        <option value="ativo">Ativo</option>
                                        <option value="finalizado">Finalizado</option>
                                        <option value="suspenso">Suspenso</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Observações</label>
                                <textarea
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                    rows="4"
                                    placeholder="Cláusulas adicionais..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Documentos Anexos</label>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files)
                                        setFormData({ ...formData, documentosAnexos: files.map(f => f.name) })
                                    }}
                                />
                                <small>Upload de arquivos digitalizados (funcionalidade de upload será implementada)</small>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingContrato ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}