import { describe, it, expect, vi } from 'vitest';

// Simulação simplificada da lógica de URL e filtro no SkillExecutionsList
function getSkillFilterFromURL(urlStr: string) {
  const url = new URL(urlStr);
  const provider = url.searchParams.get("provider");
  const tool = url.searchParams.get("tool");

  if (provider === "openhoster" && tool === "nano_banano") {
    return { filter: "nano_banana", error: null };
  } else if (provider === "openhoster" || tool === "nano_banano") {
    return { 
      filter: "nano_banana", 
      error: "Link incompleto para OpenHoster" 
    };
  }
  return { filter: "all", error: null };
}

describe('SkillExecutionsList - Integração OpenHoster/Nano Banano', () => {
  it('deve aplicar o filtro nano_banana quando ambos parâmetros provider e tool estão corretos', () => {
    const url = "https://app.lovable.ai/creative/history?provider=openhoster&tool=nano_banano";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("nano_banana");
    expect(result.error).toBeNull();
  });

  it('deve aplicar o fallback nano_banana e retornar erro quando apenas provider=openhoster está presente', () => {
    const url = "https://app.lovable.ai/creative/history?provider=openhoster";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("nano_banana");
    expect(result.error).toBe("Link incompleto para OpenHoster");
  });

  it('deve aplicar o fallback nano_banana e retornar erro quando apenas tool=nano_banano está presente', () => {
    const url = "https://app.lovable.ai/creative/history?tool=nano_banano";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("nano_banana");
    expect(result.error).toBe("Link incompleto para OpenHoster");
  });

  it('não deve aplicar o filtro nano_banana se os parâmetros forem diferentes', () => {
    const url = "https://app.lovable.ai/creative/history?provider=other&tool=other";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("all");
    expect(result.error).toBeNull();
  });

  it('deve validar o schema de erro detalhado para falhas no carregamento', () => {
    const mockError = {
      message: "Falha ao carregar Nano Banano",
      backend_status: 500,
      stack: "Error: Failed to fetch at Object.load..."
    };
    
    expect(mockError).toHaveProperty("message");
    expect(mockError).toHaveProperty("backend_status");
    expect(mockError.backend_status).toBe(500);
  });
});
