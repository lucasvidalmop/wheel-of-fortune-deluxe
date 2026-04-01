/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Royal Spin Wheel"

interface WheelInviteProps {
  name?: string
  subject?: string
  body?: string
  roletaLink?: string
}

const WheelInviteEmail = ({ name, body, roletaLink }: WheelInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{name ? `${name}, você tem um giro disponível!` : 'Você tem um giro disponível!'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={emoji}>🎰</Text>
        </Section>
        <Heading style={h1}>
          {name ? `Olá, ${name}!` : 'Olá!'}
        </Heading>
        <Text style={text}>
          {body || 'Você foi convidado para girar a roleta e concorrer a prêmios incríveis. Acesse o link abaixo e boa sorte!'}
        </Text>
        {roletaLink && (
          <Section style={buttonSection}>
            <Button style={button} href={roletaLink}>
              🎡 GIRAR AGORA
            </Button>
          </Section>
        )}
        <Text style={footer}>— Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WheelInviteEmail,
  subject: (data: Record<string, any>) => data.subject || '🎰 Você tem um giro disponível!',
  displayName: 'Convite para girar a roleta',
  previewData: { name: 'João', body: 'Você foi convidado para girar a roleta e concorrer a prêmios!', roletaLink: 'https://example.com/roleta/demo' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px', maxWidth: '500px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '10px' }
const emoji = { fontSize: '48px', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#1a0a2e', margin: '0 0 16px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 24px' }
const buttonSection = { textAlign: 'center' as const, marginBottom: '24px' }
const button = {
  backgroundColor: '#e6ac00',
  color: '#0a0a0f',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '12px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', textAlign: 'center' as const }
