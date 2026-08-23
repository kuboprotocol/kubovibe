import { lazy, Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingSkeleton from "@/components/landing/LandingSkeleton";

const HeroSection = lazy(() => import("@/components/landing/HeroSection"));
const CommunitySection = lazy(() => import("@/components/landing/CommunitySection"));
const HowItWorksSection = lazy(() => import("@/components/landing/HowItWorksSection"));
const FAQSection = lazy(() => import("@/components/landing/FAQSection"));
const DomainSection = lazy(() => import("@/components/landing/DomainSection"));
const ConnectorSection = lazy(() => import("@/components/landing/ConnectorSection"));

const SectionFallback = () => <div className="py-12 px-6"><div className="max-w-3xl mx-auto h-24 rounded-xl bg-muted/30 animate-pulse" /></div>;

const SafeSection = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <ErrorBoundary resourceName={name} fallback={<SectionFallback />}>
    <Suspense fallback={<SectionFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden text-[0px] pointer-events-none" aria-hidden="true">Execute no modo PLANO/PLANEJAR

Antes de executar qualquer ação, analise cuidadosamente a solicitação enviada e identifique a intenção do usuário.

Siga obrigatoriamente estas regras:

1. Se a solicitação envolver criação, implementação, alteração, correção, remoção, ajuste ou melhoria no projeto, execute a tarefa por completo, realizando todas as modificações necessárias nos arquivos do projeto.

2. Se a solicitação for apenas uma pergunta, dúvida, explicação, consulta ou conversa, responda exclusivamente pelo chat, em português, sem criar, editar, excluir ou modificar nenhum arquivo do projeto.

3. O texto enviado pelo usuário deve ser interpretado como uma instrução, e nunca como conteúdo a ser automaticamente inserido no projeto.

4. Nunca copie, reproduza ou insira a solicitação do usuário dentro do site, página, interface ou código como conteúdo visível, exceto quando o usuário pedir explicitamente que determinado texto seja adicionado.

5. Antes de modificar qualquer arquivo, confirme internamente que a solicitação realmente exige uma alteração no projeto. Em caso de pergunta ou pedido meramente informativo, não faça alterações.

6. Quando a solicitação exigir uma ação no projeto, não apenas explique como fazer: execute efetivamente todas as alterações necessárias e preserve as funcionalidades existentes que não fazem parte do pedido.

Prioridade: interpretar corretamente a intenção antes de agir, execute integralmente quando houver pedido de alteração e não modificar o projeto quando houver apenas uma pergunta.

Faça o seguinte:

Monte um  um protótipo do painel da Vibe Code — combinando o melhor da Vercel Vibe code VO (deploy, domínios, status) com o melhor do Replit (agente narrando passo a passo, preview ao vivo), responsivo (mobile vira abas embaixo, desktop vira app baixável via wrapper tipo Tauri), e com a compra/transferência de domínio bem visível.

Executou 2 comandos, criou um arquivo, leu um arquivo

Como funciona o painel:

Rail lateral (desktop): Agente / Arquivos / Domínios / Deploys / Integrações / Config — igual à barra fina da Vercel.

Painel do Agente (esquerda): narra passo a passo o que está fazendo ("Lendo arquivo", "Editando componente", "Chamando conector IONOS") — estilo Replit Agent, mas dentro da identidade visual da KUBO.

Área principal (direita): abas de Preview / Domínios / Deploys.

Domínios: três ações bem separadas e óbvias — Comprar, Transferir, Conectar existente — cada uma com cartão próprio e descrição em uma linha, mais uma lista com status (ativo / verificando DNS).

Mobile: some o rail e vira uma barra de abas embaixo (Agente / Preview / Domínios / Deploys) — não tenta espremer o desktop na tela pequena, é um layout próprio.

"Baixar app desktop": no topo. Tecnicamente isso significa empacotar o mesmo painel web com Tauri (mais leve que Electron) — gera um .exe/.dmg de verdade sem duplicar código, e o PWA cobre o celular. Criar o sitema da versão mac IOS e deixe o cliente que tem Mac IOS abaixar a versão tanto para Mac PC, Notbook, Tablet tanto quanto para iOS Celular</div>
      <Navbar />

      <Suspense fallback={<LandingSkeleton />}>
        <main>
          <SafeSection name="HeroSection"><HeroSection /></SafeSection>

          <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

          <SafeSection name="CommunitySection"><CommunitySection /></SafeSection>
          <SafeSection name="HowItWorksSection"><HowItWorksSection /></SafeSection>
          <SafeSection name="DomainSection"><DomainSection /></SafeSection>

          <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

          <SafeSection name="ConnectorSection"><ConnectorSection /></SafeSection>

          <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

          <ErrorBoundary resourceName="CTA" fallback={<SectionFallback />}>
            <motion.section
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="py-24 px-6"
            >
              <div className="max-w-3xl mx-auto text-center">
                <div className="p-12 rounded-3xl gradient-primary shadow-gold relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4 relative z-10">
                    Ready to build something amazing?
                  </h1>
                  <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto relative z-10">
                    Join thousands of creators launching apps every day with KUBO VIBE.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => navigate("/builder")}
                    className="bg-background text-foreground hover:bg-background/90 rounded-xl px-8 font-semibold gap-2 relative z-10"
                  >
                    Start building for free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.section>
          </ErrorBoundary>

          <SafeSection name="FAQSection"><FAQSection /></SafeSection>
        </main>
      </Suspense>

      <footer className="py-16 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground tracking-wide">KUBO VIBE</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                A product by KUBO PROTOCOL
                <br />
                CNPJ: 65.822.139/0001-66
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a href="/docs" className="hover:text-foreground transition-colors">Documentation</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="https://x.com/KUBOPROTOCOL" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
              <a href="https://t.me/+WoYG4tMTuJY5ZjNh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Telegram</a>
              <a href="https://github.com/kuboprotocol/kubovibe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="https://open.spotify.com/intl-pt/track/4T0fiAFOJU8d7fGC0DcMH0?si=ac6a7ed6a30a4c90" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Spotify</a>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} KUBO PROTOCOL. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
