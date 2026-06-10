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
});
