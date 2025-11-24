import { useState, useEffect, useCallback } from 'react'
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    ArcElement 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { imoveisCollection, contratosCollection, pagamentosCollection } from '../../../firebase'
import { getDocs } from 'firebase/firestore'
import './relatorios.css'

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Relatorios({ userInfo }) {
    const [loading, setLoading] = useState(true)
    const [dataImoveis, setDataImoveis] = useState(null)
    const [dataContratos, setDataContratos] = useState(null)
    const [dataPagamentos, setDataPagamentos] = useState(null)
    
    // Filtros de Data (Padrão: últimos 30 dias ou vazio para tudo)
    const [dataInicio, setDataInicio] = useState('')
    const [dataFim, setDataFim] = useState('')

    // Verificar permissão: Apenas Admin e Corretor [cite: 47]
    const hasPermission = userInfo?.tipoConta === 'adm' || userInfo?.tipoConta === 'corretor'

    const processarDados = useCallback(async () => {
        if (!hasPermission) return;
        setLoading(true);

        try {
            // 1. Buscar dados brutos
            const [imoveisSnap, contratosSnap, pagamentosSnap] = await Promise.all([
                getDocs(imoveisCollection),
                getDocs(contratosCollection),
                getDocs(pagamentosCollection)
            ]);

            const imoveis = imoveisSnap.docs.map(d => d.data());
            const contratos = contratosSnap.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate() }));
            const pagamentos = pagamentosSnap.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate() }));

            // --- FILTRAGEM POR DATA (Se selecionada) ---
            // Aplicamos o filtro nos itens que possuem data de criação ou referência
            const filterByDate = (item, dateField) => {
                if (!dataInicio && !dataFim) return true;
                const itemDate = item[dateField] ? new Date(item[dateField]) : null;
                if (!itemDate) return true; // Se não tem data, mantém (ou pode excluir, dependendo da regra)
                
                const start = dataInicio ? new Date(dataInicio) : new Date('1970-01-01');
                const end = dataFim ? new Date(dataFim) : new Date('2100-01-01');
                // Ajuste do fim do dia para pegar o dia inteiro
                end.setHours(23, 59, 59); 

                return itemDate >= start && itemDate <= end;
            };

            // [RFS17] Imóveis por Status
            // Imóveis geralmente filtramos pela data de cadastro (createdAt) ou mantemos o snapshot atual
            const imoveisFiltrados = imoveis.filter(i => filterByDate(i, 'createdAt'));
            const statusImoveis = { disponivel: 0, alugado: 0, vendido: 0, em_negociacao: 0 };
            imoveisFiltrados.forEach(i => {
                const s = i.status?.toLowerCase() || 'disponivel';
                if (statusImoveis[s] !== undefined) statusImoveis[s]++;
            });

            // [RFS19] Contratos por Situação
            const contratosFiltrados = contratos.filter(c => filterByDate(c, 'dataInicio'));
            const statusContratos = { ativo: 0, finalizado: 0, suspenso: 0 };
            contratosFiltrados.forEach(c => {
                const s = c.statusContrato?.toLowerCase() || 'ativo';
                if (statusContratos[s] !== undefined) statusContratos[s]++;
            });

            // [RFS20] Pagamentos por Status
            const pagamentosFiltrados = pagamentos.filter(p => filterByDate(p, 'dataPagamento')); // Filtrar pela data do pagamento real
            const statusPagamentos = { pago: 0, pendente: 0, atrasado: 0 };
            pagamentosFiltrados.forEach(p => {
                const s = p.status?.toLowerCase() || 'pendente';
                if (statusPagamentos[s] !== undefined) statusPagamentos[s]++;
            });

            // Configurar Dados dos Gráficos
            setDataImoveis({
                labels: ['Disponível', 'Alugado', 'Vendido', 'Em Negociação'],
                datasets: [{
                    label: 'Quantidade de Imóveis',
                    data: [statusImoveis.disponivel, statusImoveis.alugado, statusImoveis.vendido, statusImoveis.em_negociacao],
                    backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0'],
                }]
            });

            setDataContratos({
                labels: ['Ativo', 'Finalizado', 'Suspenso'],
                datasets: [{
                    label: 'Contratos',
                    data: [statusContratos.ativo, statusContratos.finalizado, statusContratos.suspenso],
                    backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
                }]
            });

            setDataPagamentos({
                labels: ['Pago', 'Pendente', 'Atrasado'],
                datasets: [{
                    label: 'Pagamentos',
                    data: [statusPagamentos.pago, statusPagamentos.pendente, statusPagamentos.atrasado],
                    backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
                }]
            });

        } catch (err) {
            console.error("Erro ao gerar relatórios:", err);
        } finally {
            setLoading(false);
        }
    }, [dataInicio, dataFim, hasPermission]);

    useEffect(() => {
        processarDados();
    }, [processarDados]);

    if (!hasPermission) {
        return <div className="relatorios-container"><h3>Acesso Negado. Apenas Administradores e Corretores.</h3></div>
    }

    if (loading) {
        return <div className="relatorios-container"><div className="loading">Gerando indicadores...</div></div>
    }

    return (
        <div className="relatorios-container">
            <div className="relatorios-header">
                <h1>Relatórios e Indicadores</h1>
                <div className="date-filters">
                    <div className="filter-group">
                        <label>De:</label>
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <label>Até:</label>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                    <button className="btn-secondary" onClick={() => {setDataInicio(''); setDataFim('')}}>Limpar</button>
                </div>
            </div>

            <div className="charts-grid">
                {/* RFS17 - Imóveis por Status */}
                <div className="chart-card">
                    <h3>Imóveis por Status</h3>
                    {dataImoveis && <Bar data={dataImoveis} options={{ responsive: true, plugins: { legend: { display: false } } }} />}
                </div>

                {/* RFS19 - Contratos por Situação */}
                <div className="chart-card">
                    <h3>Contratos por Situação</h3>
                    {dataContratos && <Pie data={dataContratos} />}
                </div>

                {/* RFS20 - Pagamentos por Status */}
                <div className="chart-card">
                    <h3>Pagamentos por Status</h3>
                    {dataPagamentos && <Bar data={dataPagamentos} options={{ responsive: true, plugins: { legend: { display: false } } }} />}
                </div>
                
                {/* RFC05 - Distribuição Financeira (Extra baseado na Imagem 1 do DRE) */}
                {/* Aqui você poderia adicionar um gráfico de valores totais R$ se quiser */}
            </div>
        </div>
    )
}