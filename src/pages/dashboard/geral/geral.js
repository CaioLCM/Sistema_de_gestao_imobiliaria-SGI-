import { useState, useEffect, useCallback } from 'react'
import { imoveisCollection, pagamentosCollection, documentosCollection, userInfoCollection } from '../../../firebase'
import { getDocs, query, where } from 'firebase/firestore'
import './geral.css'

export default function Geral({ userInfo }) {
    const [stats, setStats] = useState({
        totalImoveis: 0,
        totalPagamentos: 0,
        totalDocumentos: 0,
        totalUsuarios: 0,
        pagamentosPendentes: 0,
        imoveisVenda: 0,
        imoveisAluguel: 0
    })
    const [loading, setLoading] = useState(true)

    const loadStats = useCallback(async () => {
        try {
            setLoading(true)
            
            // Carregar estatísticas baseado no tipo de usuário
            const isAdmin = userInfo?.tipoConta === 'adm'
            const isCorretor = userInfo?.tipoConta === 'corretor'

            // Total de imóveis
            let imoveisQuery = imoveisCollection
            if (!isAdmin && !isCorretor) {
                // Cliente vê apenas seus imóveis
                imoveisQuery = query(imoveisCollection, where('clienteId', '==', userInfo?.uid))
            }
            const imoveisSnapshot = await getDocs(imoveisQuery)
            const imoveis = imoveisSnapshot.docs.map(doc => doc.data())
            
            // Total de pagamentos
            let pagamentosQuery = pagamentosCollection
            if (!isAdmin && !isCorretor) {
                pagamentosQuery = query(pagamentosCollection, where('clienteId', '==', userInfo?.uid))
            }
            const pagamentosSnapshot = await getDocs(pagamentosQuery)
            const pagamentos = pagamentosSnapshot.docs.map(doc => doc.data())

            // Total de documentos
            let documentosQuery = documentosCollection
            if (!isAdmin && !isCorretor) {
                documentosQuery = query(documentosCollection, where('clienteId', '==', userInfo?.uid))
            }
            const documentosSnapshot = await getDocs(documentosQuery)

            // Total de usuários (apenas admin)
            let totalUsuarios = 0
            if (isAdmin) {
                const usuariosSnapshot = await getDocs(userInfoCollection)
                totalUsuarios = usuariosSnapshot.size
            }

            // Calcular estatísticas
            const imoveisVenda = imoveis.filter(i => i.tipo === 'venda').length
            const imoveisAluguel = imoveis.filter(i => i.tipo === 'aluguel').length
            const pagamentosPendentes = pagamentos.filter(p => p.status === 'pendente').length

            setStats({
                totalImoveis: imoveis.length,
                totalPagamentos: pagamentos.length,
                totalDocumentos: documentosSnapshot.size,
                totalUsuarios,
                pagamentosPendentes,
                imoveisVenda,
                imoveisAluguel
            })
        } catch (err) {
            console.error('Erro ao carregar estatísticas:', err)
        } finally {
            setLoading(false)
        }
    }, [userInfo])

    useEffect(() => {
        loadStats()
    }, [loadStats])

    if (loading) {
        return (
            <div className="geral-container">
                <div className="loading">Carregando estatísticas...</div>
            </div>
        )
    }

    return (
        <div className="geral-container">
            <div className="geral-header">
                <h1>Dashboard Geral</h1>
                <p className="welcome-message">
                    Bem-vindo, {userInfo?.nome || 'Usuário'}!
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-primary">
                    <div className="stat-icon">🏠</div>
                    <div className="stat-content">
                        <h3>Total de Imóveis</h3>
                        <p className="stat-value">{stats.totalImoveis}</p>
                        <div className="stat-details">
                            <span>{stats.imoveisVenda} à venda</span>
                            <span>{stats.imoveisAluguel} para alugar</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-success">
                    <div className="stat-icon">💳</div>
                    <div className="stat-content">
                        <h3>Total de Pagamentos</h3>
                        <p className="stat-value">{stats.totalPagamentos}</p>
                        <div className="stat-details">
                            <span>{stats.pagamentosPendentes} pendentes</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-info">
                    <div className="stat-icon">📄</div>
                    <div className="stat-content">
                        <h3>Total de Documentos</h3>
                        <p className="stat-value">{stats.totalDocumentos}</p>
                    </div>
                </div>

                {userInfo?.tipoConta === 'adm' && (
                    <div className="stat-card stat-warning">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <h3>Total de Usuários</h3>
                            <p className="stat-value">{stats.totalUsuarios}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="recent-activity">
                <h2>Atividades Recentes</h2>
                <div className="activity-placeholder">
                    <p>Nenhuma atividade recente para exibir.</p>
                </div>
            </div>
        </div>
    )
}
