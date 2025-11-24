import { useState, useEffect, useCallback } from 'react'
// ADICIONADO: imports do Storage
import { documentosCollection, db, imoveisCollection, userInfoCollection, storage } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage' // Imports para upload
import './documentos.css'

export default function Documentos({ userInfo }) {
    const [documentos, setDocumentos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDocumento, setEditingDocumento] = useState(null)
    
    // Filtros
    const [filterInputs, setFilterInputs] = useState({ nome: '', tipo: '' })
    const [filteredDocumentos, setFilteredDocumentos] = useState([])

    const [formData, setFormData] = useState({
        imovelId: '',
        tipo: '',
        nome: '',
        descricao: '',
        url: '',
        clienteVinculado: ''
    })
    
    // Estado para o arquivo selecionado
    const [selectedFile, setSelectedFile] = useState(null)
    const [uploading, setUploading] = useState(false) // Estado de carregamento do upload

    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

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
            setImoveis(imoveisList)
            return imoveisList
        } catch (err) {
            console.error('Erro ao carregar imóveis:', err)
            return []
        }
    }, [])

    const loadDocumentos = useCallback(async (imoveisList) => {
        try {
            setLoading(true)
            let q;
            if (isAdmin || isCorretor) {
                q = documentosCollection;
            } else {
                if (!userInfo?.uid) return;
                q = query(documentosCollection, where('clienteVinculado', '==', userInfo.uid));
            }

            const snapshot = await getDocs(q)
            let documentosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            let allClientes = []
            if (isAdmin || isCorretor) {
                try {
                    const clientesSnapshot = await getDocs(userInfoCollection)
                    allClientes = clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                } catch (e) { console.log("Sem permissão para listar clientes") }
            }

            const documentosCompleto = documentosList.map(documento => {
                const imovel = imoveisList.find(i => i.id === documento.imovelId)
                let clienteVinculadoInfo = null
                if (documento.clienteVinculado) {
                    if (isAdmin || isCorretor) {
                        clienteVinculadoInfo = allClientes.find(c => c.id === documento.clienteVinculado)
                    } else if (documento.clienteVinculado === userInfo.uid) {
                        clienteVinculadoInfo = userInfo;
                    }
                }
                return { ...documento, imovel, clienteVinculadoInfo }
            })

            setDocumentos(documentosCompleto)
            setFilteredDocumentos(documentosCompleto)
        } catch (err) {
            console.error('Erro ao carregar documentos:', err)
        } finally {
            setLoading(false)
        }
    }, [isAdmin, isCorretor, userInfo])

    useEffect(() => {
        let result = documentos;
        if (filterInputs.tipo) result = result.filter(d => d.tipo === filterInputs.tipo)
        if (filterInputs.nome) result = result.filter(d => d.nome.toLowerCase().includes(filterInputs.nome.toLowerCase()))
        setFilteredDocumentos(result);
    }, [filterInputs, documentos])

    useEffect(() => { loadImoveis(); loadClientes() }, [loadImoveis, loadClientes])
    useEffect(() => { if (imoveis.length >= 0) loadDocumentos(imoveis) }, [imoveis, loadDocumentos])

    function handleOpenModal(documento = null) {
        if (documento && !isAdmin) { setAlert('Apenas administradores podem editar documentos'); return }
        
        setSelectedFile(null) // Limpa arquivo selecionado
        setAlert('')

        if (documento) {
            setEditingDocumento(documento)
            setFormData({
                imovelId: documento.imovelId || '',
                tipo: documento.tipo || '',
                nome: documento.nome || '',
                descricao: documento.descricao || '',
                url: documento.url || '', // URL existente
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
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setAlert('')
        setUploading(true) // Inicia loading de upload

        try {
            let finalUrl = formData.url;

            // --- LÓGICA DE UPLOAD DO ARQUIVO ---
            if (selectedFile) {
                // 1. Criar referência no Storage (pasta 'docs')
                // Nome único para não sobrescrever: timestamp + nome original
                const fileRef = ref(storage, `docs/${Date.now()}_${selectedFile.name}`);
                
                // 2. Fazer o upload
                const snapshot = await uploadBytes(fileRef, selectedFile);
                
                // 3. Obter a URL de download
                finalUrl = await getDownloadURL(snapshot.ref);
            }

            const documentoData = {
                imovelId: formData.imovelId || null,
                tipo: formData.tipo,
                nome: formData.nome,
                descricao: formData.descricao || null,
                url: finalUrl || null, // Salva a URL do Firebase Storage
                clienteVinculado: formData.clienteVinculado || null,
                updatedAt: serverTimestamp()
            }

            if (editingDocumento) {
                if (!isAdmin) { setAlert('Apenas administradores podem editar documentos'); setUploading(false); return }
                await updateDoc(doc(db, 'documentos', editingDocumento.id), documentoData)
                setAlert('Documento atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) { setAlert('Apenas administradores e corretores podem cadastrar documentos'); setUploading(false); return }
                documentoData.createdAt = serverTimestamp()
                await addDoc(documentosCollection, documentoData)
                setAlert('Documento criado com sucesso!')
            }

            setShowModal(false)
            loadDocumentos(imoveis)
        } catch (err) {
            console.error('Erro ao salvar documento:', err)
            setAlert('Erro ao salvar documento: ' + err.message)
        } finally {
            setUploading(false) // Para loading
        }
    }

    async function handleDelete(id) {
        if (!isAdmin) { setAlert('Apenas administradores podem excluir documentos'); return }
        if (!window.confirm('Tem certeza que deseja excluir este documento?')) return
        try {
            await deleteDoc(doc(db, 'documentos', id))
            setAlert('Documento excluído com sucesso!')
            loadDocumentos(imoveis)
        } catch (err) {
            console.error('Erro ao excluir documento:', err)
            setAlert('Erro ao excluir documento')
        }
    }

    function handleClearFilters() { setFilterInputs({ nome: '', tipo: '' }) }

    if (loading) return <div className="documentos-container"><div className="loading">Carregando documentos...</div></div>

    return (
        <div className="documentos-container">
            <div className="documentos-header">
                <h1>Gerenciamento de Documentos</h1>
                {(isAdmin || isCorretor) && <button className="btn-primary" onClick={() => handleOpenModal()}>+ Adicionar Documento</button>}
            </div>
            {alert && <div className={`alert ${alert.includes('sucesso') ? 'alert-success' : 'alert-error'}`}>{alert}</div>}

            <div className="filters-container" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
                 <div className="filter-group">
                    <label>Nome do Documento</label>
                    <input type="text" placeholder="Buscar por nome..." value={filterInputs.nome} onChange={e => setFilterInputs({...filterInputs, nome: e.target.value})} />
                </div>
                <div className="filter-group">
                    <label>Tipo</label>
                    <select value={filterInputs.tipo} onChange={e => setFilterInputs({...filterInputs, tipo: e.target.value})}>
                        <option value="">Todos</option><option value="contrato">Contrato</option><option value="escritura">Escritura</option><option value="cpf">CPF</option><option value="rg">RG</option><option value="comprovante">Comprovante</option><option value="outro">Outro</option>
                    </select>
                </div>
                <button className="btn-secondary" onClick={handleClearFilters} style={{ height: '40px' }}>Limpar Filtros</button>
            </div>

            <div className="documentos-grid">
                {filteredDocumentos.map(documento => (
                    <div key={documento.id} className="documento-card">
                        <div className="documento-header">
                            <h3>{documento.nome}</h3>
                            <span className="documento-tipo">{documento.tipo}</span>
                        </div>
                        {documento.imovel?.endereco && <p className="documento-imovel">Imóvel: {documento.imovel.endereco}</p>}
                        <p className="documento-cliente">Cliente: {documento.clienteVinculadoInfo?.nome || (documento.clienteVinculado === userInfo?.uid ? 'Você' : '-')}</p>
                        {documento.descricao && <p className="documento-descricao">{documento.descricao}</p>}
                        {documento.url && <a href={documento.url} target="_blank" rel="noopener noreferrer" className="documento-link">Ver Documento</a>}
                        {(isAdmin || isCorretor) && (
                            <div className="documento-actions">
                                {isAdmin && <><button className="btn-edit" onClick={() => handleOpenModal(documento)}>Editar</button><button className="btn-danger btn-sm" onClick={() => handleDelete(documento.id)}>Excluir</button></>}
                                {isCorretor && !isAdmin && <span className="text-muted">Apenas consulta</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {filteredDocumentos.length === 0 && <div className="empty-state"><p>Nenhum documento encontrado.</p></div>}

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
                                <select value={formData.imovelId} onChange={(e) => setFormData({ ...formData, imovelId: e.target.value })}>
                                    <option value="">Selecione um imóvel (opcional)</option>
                                    {imoveis.map(imovel => <option key={imovel.id} value={imovel.id}>{imovel.endereco}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tipo de Documento *</label>
                                <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} required>
                                    <option value="">Selecione o tipo</option><option value="contrato">Contrato</option><option value="escritura">Escritura</option><option value="cpf">CPF</option><option value="rg">RG</option><option value="comprovante">Comprovante</option><option value="outro">Outro</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nome do Documento *</label>
                                <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Cliente Vinculado</label>
                                <select value={formData.clienteVinculado} onChange={(e) => setFormData({ ...formData, clienteVinculado: e.target.value })}>
                                    <option value="">Selecione um cliente (opcional)</option>
                                    {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.name || cliente.email} {cliente.email ? `(${cliente.email})` : ''}</option>)}
                                </select>
                                <small>Selecione um cliente para que apenas ele tenha acesso a este documento</small>
                            </div>
                            
                            {/* --- CAMPO DE ARQUIVO E URL --- */}
                            <div className="form-group">
                                <label>Arquivo (Upload) *</label>
                                <input 
                                    type="file" 
                                    onChange={(e) => setSelectedFile(e.target.files[0])}
                                    required={!formData.url} // Se já tem URL (edição), não é obrigatório
                                />
                                <small>Selecione um arquivo PDF, Imagem, etc.</small>
                            </div>
                            <div className="form-group">
                                <label>URL do Documento (Automático)</label>
                                <input type="url" value={formData.url} readOnly placeholder="Será gerado após upload" style={{backgroundColor: '#f0f0f0'}} />
                            </div>

                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows="4" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={uploading}>
                                    {uploading ? 'Enviando...' : (editingDocumento ? 'Atualizar' : 'Criar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}