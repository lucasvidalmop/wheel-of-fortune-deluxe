/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Royal Spin Wheel"

interface WheelInviteCustomProps {
  name?: string
  subject?: string
  body?: string
  roletaLink?: string
  bannerImageUrl?: string
}

const WheelInviteCustomEmail = ({ name, body, roletaLink, bannerImageUrl }: WheelInviteCustomProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{name ? `${name}, você tem um giro disponível!` : 'Você tem um giro disponível!'}</Preview>
    <Body style={main}>
      <Container style={container}>
        {bannerImageUrl && (
          <Section style={bannerSection}>
            <Img
              src={bannerImageUrl}
              alt="Banner"
              width="100%"
              style={bannerImg}
            />
          </Section>
        )}
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
  component: WheelInviteCustomEmail,
  subject: (data: Record<string, any>) => data.subject || '🎰 Você tem um giro disponível!',
  displayName: 'Convite personalizado (com imagem)',
  previewData: {
    name: 'João',
    body: 'Você foi convidado para girar a roleta e concorrer a prêmios!',
    roletaLink: 'https://example.com/roleta/demo',
    bannerImageUrl: 'https://placehold.co/600x200/1a0a2e/FFD700?text=🎰+ROLETA',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '500px', margin: '0 auto' }
const bannerSection = { marginBottom: '0', padding: '0' }
const bannerImg = { display: 'block', width: '100%', maxWidth: '500px', borderRadius: '8px 8px 0 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#1a0a2e', margin: '24px 25px 16px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 25px 24px' }
const buttonSection = { textAlign: 'center' as const, marginBottom: '24px', padding: '0 25px' }
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
const footer = { fontSize: '12px', color: '#999999', margin: '30px 25px 25px', textAlign: 'center' as const }
