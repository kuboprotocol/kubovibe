/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KUBO VIBE'

interface ReferralNotificationProps {
  referredName?: string
  creditsEarned?: number
}

const ReferralNotificationEmail = ({ referredName, creditsEarned = 100 }: ReferralNotificationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você ganhou {creditsEarned} créditos por indicação!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>⚡ KUBO VIBE</Text>
        <Hr style={divider} />
        <Heading style={h1}>🎉 Nova indicação confirmada!</Heading>
        <Text style={text}>
          {referredName
            ? `${referredName} acabou de criar uma conta usando seu link de indicação.`
            : 'Alguém acabou de criar uma conta usando seu link de indicação.'}
        </Text>
        <Text style={highlight}>
          +{creditsEarned} créditos foram adicionados à sua conta!
        </Text>
        <Text style={text}>
          Continue compartilhando seu link para ganhar mais créditos.
        </Text>
        <Button style={button} href="https://kubovibe.dev/profile">
          Ver Minhas Indicações
        </Button>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReferralNotificationEmail,
  subject: (data: Record<string, any>) =>
    `🎉 Você ganhou ${data.creditsEarned || 100} créditos por indicação!`,
  displayName: 'Notificação de referral',
  previewData: { referredName: 'Maria', creditsEarned: 100 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '24px 28px' }
const brand = {
  fontSize: '18px', fontWeight: 'bold' as const, color: '#C9941A',
  fontFamily: "'Orbitron', 'Inter', Arial, sans-serif", margin: '0 0 16px', letterSpacing: '2px',
}
const divider = { borderColor: '#E5E5E5', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#555555', lineHeight: '1.6', margin: '0 0 24px' }
const highlight = {
  fontSize: '20px', fontWeight: 'bold' as const, color: '#C9941A',
  margin: '0 0 24px', padding: '16px', backgroundColor: '#FFF9E6', borderRadius: '12px',
  textAlign: 'center' as const,
}
const button = {
  backgroundColor: '#C9941A', color: '#0D0D0D', fontSize: '15px', fontWeight: 'bold' as const,
  borderRadius: '14px', padding: '14px 28px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
