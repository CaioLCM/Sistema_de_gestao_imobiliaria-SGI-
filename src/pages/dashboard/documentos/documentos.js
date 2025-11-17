import { useState, useEffect, useCallback } from 'react'
import { documentosCollection, db, imoveisCollection, userInfoCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './documentos.css'
import { useAuth } from '../../../context/AuthContext'

export default function Documentos({  }) {
    const { userProfile } = useAuth()
    const userInfo = userProfile
    const [documentos, setDocumentos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDocumento, setEditingDocumento] = useState(null)
    const [formData, setFormData] = useState({
        imovelId: '',
        tipo: '',
        nome: '',
        descricao: '',
        url: '',
        clienteVinculado: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

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
            // Todos os usuários podem ver a lista de imóveis; manteremos criação/edição restritas.
            let imoveisQuery = imoveisCollection
            const snapshot = await getDocs(imoveisQuery)
            const imoveisList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setImoveis(imoveisList)
            return imoveisList
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
            return []
        }
    }, [isAdmin, isCorretor, userInfo?.uid])

    const loadDocumentos = useCallback(async (imoveisList) => {
        try {
            setLoading(true)
            let documentosQuery = documentosCollection

            const snapshot = await getDocs(documentosQuery)
            let documentosList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Filtrar por cliente: clientes só veem documentos vinculados a eles
            if (!isAdmin && !isCorretor) {
                const clienteId = userInfo?.uid || userInfo?.id
                // Filtrar documentos onde o cliente é o clienteVinculado
                documentosList = documentosList.filter(d => {
                    return d.clienteVinculado === clienteId || 
                           d.clienteVinculado === userInfo?.id ||
                           d.clienteId === clienteId ||
                           d.clienteId === userInfo?.id
                })
            }
            
            // Buscar informações dos clientes
            const clientesSnapshot = await getDocs(userInfoCollection)
            const allClientes = clientesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Buscar dados dos imóveis e clientes vinculados
            const documentosCompleto = documentosList.map(documento => {
                const imovel = imoveisList.find(i => i.id === documento.imovelId)
                let clienteVinculadoInfo = null
                if (documento.clienteVinculado) {
                    clienteVinculadoInfo = allClientes.find(c => 
                        c.id === documento.clienteVinculado || 
                        c.uid === documento.clienteVinculado
                    )
                }
                return {
                    ...documento,
                    imovel: imovel,
                    clienteVinculadoInfo: clienteVinculadoInfo
                }
            })

            setDocumentos(documentosCompleto)
        } catch (err) {
            console.error('Erro ao carregar documentos:', err)
            setAlert('Erro ao carregar documentos')
        } finally {
            setLoading(false)
        }
    }, [isAdmin, isCorretor, userInfo])

    useEffect(() => {
        loadImoveis()
        loadClientes()
    }, [loadImoveis, loadClientes])

    useEffect(() => {
        if (imoveis.length >= 0) {
            loadDocumentos(imoveis)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imoveis])

    function handleOpenModal(documento = null) {
        // Se está tentando editar e não é admin, bloquear
        if (documento && !isAdmin) {
            setAlert('Apenas administradores podem editar documentos')
            return
        }
        if (documento) {
            setEditingDocumento(documento)
            setFormData({
                imovelId: documento.imovelId || '',
                tipo: documento.tipo || '',
                nome: documento.nome || '',
                descricao: documento.descricao || '',
                url: documento.url || '',
                clienteVinculado: documento.clienteVinculado || documento.clienteId || ''
            })
        } else {
            setEditingDocumento(null)
            setFormData({
                imovelId: '',
                tipo: '',
                nome: '',
                descricao: '',
                url: '',
                clienteVinculado: ''
            })
        }
        setShowModal(true)
        setAlert('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')

        try {
            const documentoData = {
                imovelId: formData.imovelId || null,
                tipo: formData.tipo,
                nome: formData.nome,
                descricao: formData.descricao || null,
                url: formData.url || null,
                clienteVinculado: formData.clienteVinculado || null,
                updatedAt: serverTimestamp()
            }

            if (editingDocumento) {
                // Apenas Admin pode editar
                if (!isAdmin) {
                    setAlert('Apenas administradores podem editar documentos')
                    return
                }
                await updateDoc(doc(db, 'documentos', editingDocumento.id), documentoData)
                setAlert('Documento atualizado com sucesso!')
            } else {
                // Admin e Corretor podem cadastrar
                if (!isAdmin && !isCorretor) {
                    setAlert('Apenas administradores e corretores podem cadastrar documentos')
                    return
                }
                documentoData.createdAt = serverTimestamp()
                await addDoc(documentosCollection, documentoData)
                setAlert('Documento criado com sucesso!')
            }

            setShowModal(false)
            loadDocumentos(imoveis)
        } catch (err) {
            console.error('Erro ao salvar documento:', err)
            setAlert('Erro ao salvar documento: ' + err.message)
        }
    }

    async function handleDelete(id) {
        // Apenas Admin pode excluir
        if (!isAdmin) {
            setAlert('Apenas administradores podem excluir documentos')
            return
        }

        if (!window.confirm('Tem certeza que deseja excluir este documento?')) {
            return
        }

        try {
            await deleteDoc(doc(db, 'documentos', id))
            setAlert('Documento excluído com sucesso!')
            loadDocumentos(imoveis)
        } catch (err) {
            console.error('Erro ao excluir documento:', err)
            setAlert('Erro ao excluir documento')
        }
    }

    if (loading) {
        return (
            <div className="documentos-container">
                <div className="loading">Carregando documentos...</div>
            </div>
        )
    }

    return (
        <div className="documentos-container">
            <div className="documentos-header">
                <h1>Gerenciamento de Documentos</h1>
                {(isAdmin || isCorretor) && (
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Adicionar Documento
                    </button>
                )}
            </div>

            {alert && (
                <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>
                    {alert}
                </div>
            )}

            <div className="documentos-grid">
                {documentos.map(documento => (
                    <div key={documento.id} className="documento-card">
                        <div className="documento-header">
                            <h3>{documento.nome}</h3>
                            <span className="documento-tipo">{documento.tipo}</span>
                        </div>
                        {documento.imovel?.endereco && (
                            <p className="documento-imovel">
                                Imóvel: {documento.imovel.endereco}
                            </p>
                        )}
                        {documento.clienteVinculadoInfo && (
                            <p className="documento-cliente">
                                Cliente: {documento.clienteVinculadoInfo.nome || documento.clienteVinculadoInfo.name || documento.clienteVinculadoInfo.email}
                            </p>
                        )}
                        {documento.descricao && (
                            <p className="documento-descricao">{documento.descricao}</p>
                        )}
                        {documento.url && (
                            <a 
                                href={documento.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="documento-link"
                            >
                                Ver Documento
                            </a>
                        )}
                        {(isAdmin || isCorretor) && (
                            <div className="documento-actions">
                                {isAdmin && (
                                    <>
                                        <button 
                                            className="btn-edit"
                                            onClick={() => handleOpenModal(documento)}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            className="btn-danger btn-sm"
                                            onClick={() => handleDelete(documento.id)}
                                        >
                                            Excluir
                                        </button>
                                    </>
                                )}
                                {isCorretor && !isAdmin && (
                                    <span className="text-muted">Apenas consulta</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {documentos.length === 0 && (
                <div className="empty-state">
                    <p>Nenhum documento encontrado.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingDocumento ? 'Editar Documento' : 'Adicionar Documento'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Imóvel</label>
                                <select
                                    value={formData.imovelId}
                                    onChange={(e) => setFormData({ ...formData, imovelId: e.target.value })}
                                >
                                    <option value="">Selecione um imóvel (opcional)</option>
                                    {imoveis.map(imovel => (
                                        <option key={imovel.id} value={imovel.id}>
                                            {imovel.endereco}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tipo de Documento *</label>
                                <select
                                    value={formData.tipo}
                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione o tipo</option>
                                    <option value="contrato">Contrato</option>
                                    <option value="escritura">Escritura</option>
                                    <option value="cpf">CPF</option>
                                    <option value="rg">RG</option>
                                    <option value="comprovante">Comprovante</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nome do Documento *</label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Cliente Vinculado</label>
                                <select
                                    value={formData.clienteVinculado}
                                    onChange={(e) => setFormData({ ...formData, clienteVinculado: e.target.value })}
                                >
                                    <option value="">Selecione um cliente (opcional)</option>
                                    {clientes.map(cliente => (
                                        <option key={cliente.id} value={cliente.id}>
                                            {cliente.nome || cliente.name || cliente.email} {cliente.email ? `(${cliente.email})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <small>Selecione um cliente para que apenas ele tenha acesso a este documento</small>
                            </div>
                            <div className="form-group">
                                <label>URL do Documento</label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://..."
                                />
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
                                    {editingDocumento ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
