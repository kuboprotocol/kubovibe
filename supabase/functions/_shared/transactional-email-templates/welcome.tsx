/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KUBO VIBE'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>⚡ KUBO VIBE</Text>
        <Hr style={divider} />
        <Heading style={h1}>
          {name ? `Bem-vindo, ${name}!` : 'Bem-vindo ao KUBO VIBE!'}
        </Heading>
        <Text style={text}>
          Sua conta foi criada com sucesso. Agora você pode criar sites incríveis,
          ganhar créditos indicando amigos e muito mais.
        </Text>
        <Button style={button} href="https://kubovibe.lovable.app/dashboard">
          Acessar Dashboard
        </Button>
        <Text style={footer}>Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Bem-vindo ao ${SITE_NAME}! 🚀`,
  displayName: 'Boas-vindas',
  previewData: { name: 'João' },
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
const button = {
  backgroundColor: '#C9941A', color: '#0D0D0D', fontSize: '15px', fontWeight: 'bold' as const,
  borderRadius: '14px', padding: '14px 28px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
