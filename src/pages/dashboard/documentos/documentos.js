import { useState, useEffect } from 'react'
import { documentosCollection, db, imoveisCollection } from '../../../firebase'
import { getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import './documentos.css'

export default function Documentos({ userInfo }) {
    const [documentos, setDocumentos] = useState([])
    const [imoveis, setImoveis] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDocumento, setEditingDocumento] = useState(null)
    const [formData, setFormData] = useState({
        imovelId: '',
        tipo: '',
        nome: '',
        descricao: '',
        url: ''
    })
    const [alert, setAlert] = useState('')

    const isAdmin = userInfo?.tipoConta === 'adm'
    const isCorretor = userInfo?.tipoConta === 'corretor'

    useEffect(() => {
        loadImoveis()
        loadDocumentos()
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

    async function loadDocumentos() {
        try {
            setLoading(true)
            let documentosQuery = documentosCollection
            if (!isAdmin && !isCorretor) {
                documentosQuery = query(documentosCollection, where('clienteId', '==', userInfo?.uid))
            }

            const snapshot = await getDocs(documentosQuery)
            const documentosList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            // Carregar imóveis para relacionar
            let imoveisQuery = imoveisCollection
            if (!isAdmin && !isCorretor) {
                imoveisQuery = query(imoveisCollection, where('clienteId', '==', userInfo?.uid))
            }
            const imoveisSnapshot = await getDocs(imoveisQuery)
            const allImoveis = imoveisSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            
            // Buscar dados dos imóveis
            const documentosCompleto = documentosList.map(documento => {
                const imovel = allImoveis.find(i => i.id === documento.imovelId)
                return {
                    ...documento,
                    imovel: imovel
                }
            })

            setDocumentos(documentosCompleto)
        } catch (err) {
            console.error('Erro ao carregar documentos:', err)
            setAlert('Erro ao carregar documentos')
        } finally {
            setLoading(false)
        }
    }


    function handleOpenModal(documento = null) {
        if (documento) {
            setEditingDocumento(documento)
            setFormData({
                imovelId: documento.imovelId || '',
                tipo: documento.tipo || '',
                nome: documento.nome || '',
                descricao: documento.descricao || '',
                url: documento.url || ''
            })
        } else {
            setEditingDocumento(null)
            setFormData({
                imovelId: '',
                tipo: '',
                nome: '',
                descricao: '',
                url: ''
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
                ...formData,
                updatedAt: serverTimestamp()
            }

            if (editingDocumento) {
                await updateDoc(doc(db, 'documentos', editingDocumento.id), documentoData)
                setAlert('Documento atualizado com sucesso!')
            } else {
                if (!isAdmin && !isCorretor) {
                    documentoData.clienteId = userInfo?.uid
                }
                documentoData.createdAt = serverTimestamp()
                await addDoc(documentosCollection, documentoData)
                setAlert('Documento criado com sucesso!')
            }

            setShowModal(false)
            loadDocumentos()
        } catch (err) {
            console.error('Erro ao salvar documento:', err)
            setAlert('Erro ao salvar documento: ' + err.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Tem certeza que deseja excluir este documento?')) {
            return
        }

        try {
            await deleteDoc(doc(db, 'documentos', id))
            setAlert('Documento excluído com sucesso!')
            loadDocumentos()
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
                {isCorretor && (
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
                        <p className="documento-imovel">
                            {documento.imovel?.endereco || 'Imóvel não encontrado'}
                        </p>
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
                        {isCorretor && (
                            <div className="documento-actions">
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
