// WGSL Sandbox — every shader compile is gated by the wgsl-sanitizer edge function.
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, CheckCircle2, Cpu } from 'lucide-react';
import { sanitizeWGSL, requestSafeGPUDevice, WGSLBlockedError, type SanitizeResult } from '@/game/wgsl-safe';
import { toast } from 'sonner';

const SAFE_SAMPLE = `@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.79, 0.58, 0.10, 1.0);
}`;

const DOS_SAMPLE = `@compute @workgroup_size(1)
fn cs_main() {
  while (true) {
    // attempt to hang the GPU pipeline
  }
}`;

export default function WGSLSandbox() {
  const [src, setSrc] = useState(SAFE_SAMPLE);
  const [result, setResult] = useState<SanitizeResult | null>(null);
  const [compileLog, setCompileLog] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const compile = async () => {
    setLoading(true);
    setResult(null);
    setCompileLog('');
    try {
      // STEP 1 — guardian. Never call createShaderModule without this passing.
      const stage = /@compute/i.test(src) ? 'compute' : /@fragment/i.test(src) ? 'fragment' : 'vertex';
      const sanitized = await sanitizeWGSL(src, stage);
      setResult(sanitized);

      // STEP 2 — only if approved, hand off to WebGPU.
      const device = await requestSafeGPUDevice();
      if (!device) {
        setCompileLog('[guardian] APROVADO. WebGPU indisponível no preview — em browsers compatíveis seria compilado agora.');
        toast.success('Shader aprovado pelo guardião');
        return;
      }
      const module = device.createShaderModule({ label: 'kubo-sandbox', code: sanitized.sanitized });
      const info = await module.getCompilationInfo();
      const msgs = info.messages.map(m => `${m.type}: ${m.message}`).join('\n') || '(sem mensagens)';
      setCompileLog(`[guardian] APROVADO\n[webgpu] compileShaderModule OK\n${msgs}`);
      toast.success('Shader compilado com sucesso');
    } catch (e) {
      if (e instanceof WGSLBlockedError) {
        setResult({ blocked: true, sanitized: '', violations: e.violations });
        setCompileLog(`[guardian] BLOQUEADO\n${e.violations.map(v => `${v.severity.toUpperCase()} ${v.rule}: ${v.message}`).join('\n')}`);
        toast.error('Shader bloqueado pelo guardião');
      } else {
        setCompileLog(`[erro] ${(e as Error).message}`);
        toast.error((e as Error).message);
      }
    } finally { setLoading(false); }
  };

  const blocked = result?.blocked;
  const approved = result && !result.blocked;

  return (
    <Card className="glass-premium p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-display tracking-wider text-sm">WGSL SANDBOX</h3>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSrc(SAFE_SAMPLE)}>Safe</Button>
          <Button size="sm" variant="ghost" onClick={() => setSrc(DOS_SAMPLE)}>DoS</Button>
        </div>
      </div>

      <Textarea
        value={src}
        onChange={e => setSrc(e.target.value)}
        spellCheck={false}
        className="font-mono text-xs min-h-32 bg-background/40"
      />

      <div className="flex items-center gap-2">
        <Button onClick={compile} disabled={loading || !src.trim()} size="sm" className="gap-2">
          <Cpu className="w-4 h-4" />
          {loading ? 'Verificando…' : 'Sanitizar + Compilar'}
        </Button>
        {approved && (
          <Badge className="neon-ring-gold gap-1"><CheckCircle2 className="w-3 h-3" /> Aprovado</Badge>
        )}
        {blocked && (
          <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> Bloqueado</Badge>
        )}
      </div>

      {compileLog && (
        <pre className="text-[11px] font-mono whitespace-pre-wrap p-3 rounded-lg bg-background/60 border border-border/40 max-h-40 overflow-auto">
{compileLog}
        </pre>
      )}
    </Card>
  );
}
