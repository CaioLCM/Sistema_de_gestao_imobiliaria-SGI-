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
import { imoveisCollection, contratosCollection, pagamentosCollection, userInfoCollection } from '../../../firebase'
import { getDocs } from 'firebase/firestore'
import './relatorios.css'

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Relatorios({ userInfo }) {
    const [loading, setLoading] = useState(true)
    const [dataImoveis, setDataImoveis] = useState(null)
    const [dataContratos, setDataContratos] = useState(null)
    const [dataPagamentos, setDataPagamentos] = useState(null)
    const [dataClientes, setDataClientes] = useState(null) // [RFS18] Novo estado
    
    // Filtros de Data
    const [dataInicio, setDataInicio] = useState('')
    const [dataFim, setDataFim] = useState('')

    // Apenas Admin e Corretor podem ver relatórios [RFC05]
    const hasPermission = userInfo?.tipoConta === 'adm' || userInfo?.tipoConta === 'corretor'

    const processarDados = useCallback(async () => {
        if (!hasPermission) return;
        setLoading(true);

        try {
            // Buscar dados de todas as coleções necessárias
            const [imoveisSnap, contratosSnap, pagamentosSnap] = await Promise.all([
                getDocs(imoveisCollection),
                getDocs(contratosCollection),
                getDocs(pagamentosCollection)
            ]);

            // Converter dados
            const imoveis = imoveisSnap.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate() }));
            const contratos = contratosSnap.docs.map(d => ({ ...d.data(), dataInicio: d.data().dataInicio }));
            const pagamentos = pagamentosSnap.docs.map(d => ({ ...d.data(), dataPagamento: d.data().dataPagamento }));

            // Função auxiliar de filtro de data
            const filterByDate = (itemDateString) => {
                if (!dataInicio && !dataFim) return true;
                if (!itemDateString) return false; 
                
                const itemDate = new Date(itemDateString);
                itemDate.setHours(0,0,0,0);
                
                const start = dataInicio ? new Date(dataInicio) : new Date('1900-01-01');
                const end = dataFim ? new Date(dataFim) : new Date('2100-01-01');
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);

                return itemDate >= start && itemDate <= end;
            };

            // 1. Imóveis por Status [RFS17]
            const imoveisFiltrados = imoveis.filter(i => !dataInicio ? true : (i.createdAt && filterByDate(i.createdAt)));
            const statusImoveis = { disponivel: 0, alugado: 0, vendido: 0, em_negociacao: 0 };
            imoveisFiltrados.forEach(i => {
                const s = i.status?.toLowerCase() || 'disponivel';
                if (statusImoveis[s] !== undefined) statusImoveis[s]++;
            });

            // 2. Contratos por Situação [RFS19]
            const contratosFiltrados = contratos.filter(c => filterByDate(c.dataInicio));
            const statusContratos = { ativo: 0, finalizado: 0, suspenso: 0 };
            contratosFiltrados.forEach(c => {
                const s = c.statusContrato?.toLowerCase() || 'ativo';
                if (statusContratos[s] !== undefined) statusContratos[s]++;
            });

            // 3. Pagamentos por Status [RFS20]
            const pagamentosFiltrados = pagamentos.filter(p => {
                const dataRef = p.dataPagamento || p.dataVencimento;
                return filterByDate(dataRef);
            });
            const statusPagamentos = { pago: 0, pendente: 0, atrasado: 0 };
            pagamentosFiltrados.forEach(p => {
                const s = p.status?.toLowerCase() || 'pendente';
                if (statusPagamentos[s] !== undefined) statusPagamentos[s]++;
            });

            // 4. Clientes por Tipo [RFS18]
            // Usamos Sets para contar usuários únicos, pois um usuário pode ter vários imóveis
            const proprietariosSet = new Set();
            const inquilinosSet = new Set();
            const compradoresSet = new Set();

            // Conta proprietários baseados nos imóveis filtrados
            imoveisFiltrados.forEach(i => {
                if (i.clienteProprietario) proprietariosSet.add(i.clienteProprietario);
            });

            // Conta papéis baseados nos contratos filtrados
            contratosFiltrados.forEach(c => {
                if (c.clienteProprietario) proprietariosSet.add(c.clienteProprietario);
                
                if (c.clienteInquilinoComprador) {
                    if (c.tipoContrato === 'locacao') {
                        inquilinosSet.add(c.clienteInquilinoComprador);
                    } else if (c.tipoContrato === 'venda') {
                        compradoresSet.add(c.clienteInquilinoComprador);
                    }
                }
            });

            // --- Configuração dos Dados dos Gráficos ---

            setDataImoveis({
                labels: ['Disponível', 'Alugado', 'Vendido', 'Em Negociação'],
                datasets: [{
                    label: 'Qtd Imóveis',
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

            setDataClientes({
                labels: ['Proprietário', 'Inquilino', 'Comprador'],
                datasets: [{
                    label: 'Clientes Únicos',
                    data: [proprietariosSet.size, inquilinosSet.size, compradoresSet.size],
                    backgroundColor: ['#9e9e9e', '#4db6ac', '#ff8a65'], // Cores baseadas na Imagem 2 do DRE
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
        return <div className="relatorios-container"><h3>Acesso Negado.</h3></div>
    }

    if (loading) {
        return <div className="relatorios-container"><div className="loading">Gerando gráficos...</div></div>
    }

    return (
        <div className="relatorios-container">
            <div className="relatorios-header">
                <h1>Relatórios Gerenciais</h1>
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
                <div className="chart-card">
                    <h3>[RFS17] Imóveis por Status</h3>
                    {dataImoveis && <Bar data={dataImoveis} options={{ plugins: { legend: { display: false } } }} />}
                </div>
                <div className="chart-card">
                    <h3>[RFS19] Contratos por Situação</h3>
                    <div className="pie-container">
                        {dataContratos && <Pie data={dataContratos} />}
                    </div>
                </div>
                <div className="chart-card">
                    <h3>[RFS20] Pagamentos por Status</h3>
                    {dataPagamentos && <Bar data={dataPagamentos} options={{ plugins: { legend: { display: false } } }} />}
                </div>
                <div className="chart-card">
                    <h3>[RFS18] Clientes por Tipo</h3>
                    {dataClientes && <Bar data={dataClientes} options={{ plugins: { legend: { display: false } } }} />}
                </div>
            </div>
        </div>
    )
}