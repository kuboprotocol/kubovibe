/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {siteName} — confirme seu email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>⚡ KUBO VIBE</Text>
        <Hr style={divider} />
        <Heading style={h1}>Confirme seu email</Heading>
        <Text style={text}>
          Bem-vindo ao{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          ! Estamos felizes em ter você.
        </Text>
        <Text style={text}>
          Confirme seu endereço de email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verificar Email
        </Button>
        <Text style={footer}>
          Se você não criou uma conta, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '24px 28px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#C9941A',
  fontFamily: "'Orbitron', 'Inter', Arial, sans-serif",
  margin: '0 0 16px',
  letterSpacing: '2px',
}
const divider = { borderColor: '#E5E5E5', margin: '0 0 24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1A1A1A',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#555555',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#C9941A', textDecoration: 'underline' }
const button = {
  backgroundColor: '#C9941A',
  color: '#0D0D0D',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '14px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
