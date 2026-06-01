import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KUBO VIBE'

interface Props {
  domain?: string
  status?: string
  message?: string
  registrar?: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando início',
  validating: 'Em validação',
  transferring: 'Transferência em andamento',
  completed: 'Transferência concluída ✅',
  failed: 'Transferência falhou ❌',
  cancelled: 'Transferência cancelada',
}

const DomainTransferStatusEmail = ({ domain, status, message, registrar }: Props) => {
  const label = STATUS_LABEL[status ?? ''] ?? status ?? 'Atualização'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`${domain ?? 'Seu domínio'}: ${label}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{label}</Heading>
          <Text style={text}>
            Houve uma atualização na transferência de <strong>{domain ?? 'seu domínio'}</strong>
            {registrar ? <> (registrar de origem: {registrar})</> : null}.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Status atual</Text>
            <Text style={cardValue}>{label}</Text>
            {message ? (<>
              <Text style={cardLabel}>Detalhe</Text>
              <Text style={cardValue}>{message}</Text>
            </>) : null}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Você pode acompanhar pelo painel KUBO Domínios.</Text>
          <Text style={footer}>— Time {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DomainTransferStatusEmail,
  subject: (d: Record<string, any>) => `[KUBO] ${d?.domain ?? 'Domínio'}: ${STATUS_LABEL[d?.status] ?? 'atualização'}`,
  displayName: 'Domain transfer status',
  previewData: { domain: 'meudominio.com', status: 'completed', message: 'IONOS confirmou.', registrar: 'GoDaddy' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 16px' }
const card = { padding: '16px', borderRadius: '8px', backgroundColor: '#f6f6f7', border: '1px solid #e5e5e8', margin: '8px 0 16px' }
const cardLabel = { fontSize: '11px', color: '#777', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 2px' }
const cardValue = { fontSize: '14px', color: '#0a0a0a', margin: '0 0 10px' }
const hr = { borderColor: '#eee', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#888', margin: '4px 0' }
