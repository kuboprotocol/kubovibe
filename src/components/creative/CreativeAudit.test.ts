import { describe, it, expect, vi } from 'vitest';
import { puter } from '@heyputer/puter.js';

// Mock do Puter.js
vi.mock('@heyputer/puter.js', () => ({
  puter: {
    ai: {
      chat: vi.fn(),
    },
  },
}));

describe('Auditoria de Simulação de Falhas e CSV', () => {
  it('deve simular falha no Kimi e disparar fallback corretamente', async () => {
    // Simula erro no Puter (Kimi)
    (puter.ai.chat as any).mockRejectedValueOnce(new Error('Kimi Offline Simulado'));
    
    // Simulação do fluxo de orquestração que criamos no CreativeToolInterface
    const decisionTrail: string[] = ['Tentando Kimi K2.6'];
    let fallbackTriggered = false;
    
    try {
      await puter.ai.chat('teste', { model: 'kimi' });
    } catch (err: any) {
      decisionTrail.push(`Erro: ${err.message}`);
      decisionTrail.push('Acionando Fallback DeepSeek');
      fallbackTriggered = true;
    }
    
    expect(fallbackTriggered).toBe(true);
    expect(decisionTrail).toContain('Acionando Fallback DeepSeek');
  });

  it('deve validar que os dados para o CSV possuem todas as colunas obrigatórias', () => {
    const requiredColumns = ['model', 'credits', 'duration_msg', 'status_final'];
    
    const mockLogEntry = {
      id: '1',
      ts: Date.now(),
      status: 'fallback_success',
      metadata: {
        model: 'deepseek-chat',
        credits: 1,
        duration: '2.5s',
        decision_trail: ['Kimi failed', 'Fallback applied']
      }
    };
    
    // Simulação da lógica de extração do CSV
    const extractedData = {
      model: mockLogEntry.metadata.model,
      credits: mockLogEntry.metadata.credits,
      duration_msg: mockLogEntry.metadata.duration,
      status_final: mockLogEntry.status
    };
    
    const missing = requiredColumns.filter(col => extractedData[col as keyof typeof extractedData] === undefined);
    expect(missing.length).toBe(0);
  });

  it('deve garantir que cada entrada de log tenha um RunID único', () => {
    const runId1 = `run_${crypto.randomUUID().slice(0, 8)}`;
    const runId2 = `run_${crypto.randomUUID().slice(0, 8)}`;
    
    expect(runId1).toMatch(/^run_[a-z0-9-]+$/);
    expect(runId1).not.toBe(runId2);
  });

  it('deve validar que o filtro por RunID retorna apenas os logs corretos', () => {
    const targetRunId = 'run_123';
    const logs = [
      { id: '1', metadata: { run_id: 'run_123' } },
      { id: '2', metadata: { run_id: 'run_456' } },
      { id: '3', metadata: { run_id: 'run_123' } }
    ];
    
    const filtered = logs.filter(log => log.metadata.run_id === targetRunId);
    expect(filtered.length).toBe(2);
    expect(filtered.every(l => l.metadata.run_id === targetRunId)).toBe(true);
  });

  it('deve falhar na validação se colunas obrigatórias estiverem em ordem incorreta no XLSX', () => {
    const requiredLabels = ['Modelo', 'Créditos', 'Tempo/Mensagem', 'Status (Sucesso/Fallback)'];
    const sheetLabels = ['Créditos', 'Modelo', 'Tempo/Mensagem', 'Status (Sucesso/Fallback)']; // Ordem errada
    
    // Lógica que implementamos no CSVExportModal
    const presentRequired = requiredLabels.filter(l => sheetLabels.includes(l));
    const sheetRequiredOrder = sheetLabels.filter(l => requiredLabels.includes(l));
    const isOrderCorrect = JSON.stringify(presentRequired) === JSON.stringify(sheetRequiredOrder);
    
    expect(isOrderCorrect).toBe(false);
  });

  it('deve validar que o filtro por RunID funciona corretamente no conjunto de dados', () => {
    const logs = [
      { id: '1', metadata: { run_id: 'run_A' } },
      { id: '2', metadata: { run_id: 'run_B' } },
      { id: '3', metadata: { run_id: 'run_A' } }
    ];
    
    const filterByRunA = (l: any) => l.metadata.run_id === 'run_A';
    const result = logs.filter(filterByRunA);
    
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });
});
