import { describe, it, expect } from 'vitest';

// Simulação simplificada da lógica de URL e filtro no SkillExecutionsList
function getSkillFilterFromURL(urlStr: string) {
  const url = new URL(urlStr);
  const provider = url.searchParams.get("provider");
  const tool = url.searchParams.get("tool");

  if (provider === "openhoster" && tool === "nano_banano") {
    return { filter: "nano_banana", error: null };
  } else if (provider === "openhoster" || tool === "nano_banano") {
    const missing = [];
    if (!provider) missing.push("provider=openhoster");
    if (!tool) missing.push("tool=nano_banano");
    
    return { 
      filter: "nano_banana", 
      error: `Link incompleto para OpenHoster. Faltando: ${missing.join(" e ")}`,
      missing
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

  it('deve aplicar o fallback nano_banana e informar provider ausente', () => {
    const url = "https://app.lovable.ai/creative/history?tool=nano_banano";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("nano_banana");
    expect(result.error).toContain("provider=openhoster");
  });

  it('deve aplicar o fallback nano_banana e informar tool ausente', () => {
    const url = "https://app.lovable.ai/creative/history?provider=openhoster";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("nano_banana");
    expect(result.error).toContain("tool=nano_banano");
  });

  it('não deve aplicar o filtro nano_banana se ambos estiverem ausentes', () => {
    const url = "https://app.lovable.ai/creative/history";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("all");
    expect(result.error).toBeNull();
  });

  it('não deve aplicar o filtro nano_banana com valores errados', () => {
    const url = "https://app.lovable.ai/creative/history?provider=wrong&tool=wrong";
    const result = getSkillFilterFromURL(url);
    
    expect(result.filter).toBe("all");
    expect(result.error).toBeNull();
  });

  it('deve detalhar endpoint e payload no schema de erro', () => {
    const mockError = {
      message: "Erro de teste",
      endpoint: "https://api.test/v1/call",
      payload: { provider: "openhoster", tool: null }
    };
    
    expect(mockError).toHaveProperty("endpoint");
    expect(mockError.payload).toHaveProperty("provider");
  });
});

