/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Button, Section, Img, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Lucas BSB"
const HERO_IMAGE = "https://zrijrsntmmzyykuqjbno.supabase.co/storage/v1/object/public/app-assets/email%2Fwheel-invite-hero.png"
const ROLETA_LINK = "https://tipspayroleta.com/roletabsb"
const WHATSAPP_PHONE = "5561996110278"

interface WheelInviteLucasProps {
  name?: string
  subject?: string
  body?: string
  roletaLink?: string
}

const WheelInviteLucasEmail = ({ name, body, roletaLink }: WheelInviteLucasProps) => {
  const link = roletaLink || ROLETA_LINK

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{name ? `${name}, seu giro está disponível!` : 'Seu giro está disponível!'}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Hero Image */}
          <Section style={heroSection}>
            <Img
              src={HERO_IMAGE}
              alt="Royal Spin Wheel"
              width="560"
              style={heroImg}
            />
          </Section>

          {/* Feature bullets */}
          <Section style={bulletSection}>
            <Text style={bulletText}>
              <span style={{ fontWeight: 700, letterSpacing: '-0.04em' }}>Pagamentos instantâneos </span>
              <span style={{ letterSpacing: '-0.03em' }}>para usuários aprovados.</span>
            </Text>
            <Text style={bulletText}>
              <span style={{ fontWeight: 700, letterSpacing: '-0.04em' }}>Prêmios reais </span>
              <span style={{ letterSpacing: '-0.03em' }}>com chance real de ganho.</span>
            </Text>
            <Text style={bulletText}>
              <span style={{ fontWeight: 700, letterSpacing: '-0.04em' }}>Participe </span>
              <span style={{ letterSpacing: '-0.03em' }}>agora.</span>
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Main heading */}
          <Text style={mainHeading}>
            Seu giro está disponível
          </Text>

          {/* Body text */}
          <Text style={bodyText}>
            {body || 'Seu giro já está disponível! Entre agora na roleta e veja o que você pode ganhar antes que expire.'}
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={ctaButton} href={link}>
              Girar agora →
            </Button>
          </Section>

          {/* Dark footer */}
          <Section style={darkFooter}>
            <Text style={footerHeading}>Precisa de ajuda?</Text>
            <Text style={footerText}>
              Fale com o suporte{' '}
              <strong>(61) <a href={`https://wa.me/${WHATSAPP_PHONE}`} style={footerLink}>99611-0278</a></strong>,
              {'\n'}mande uma mensagem <strong>no Whatsapp.</strong>
              {'\n'}ou entre no nosso <strong>Grupo Oficial</strong>.
            </Text>
            <Text style={footerCopy}>Equipe Lucas BSB - 2026</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WheelInviteLucasEmail,
  subject: (data: Record<string, any>) => data.subject || '🎰 Seu giro está disponível!',
  displayName: 'Convite Roleta - Lucas BSB',
  
  previewData: {
    name: 'João',
    body: 'Seu giro já está disponível! Entre agora na roleta e veja o que você pode ganhar antes que expire.',
    roletaLink: ROLETA_LINK,
  },
} satisfies TemplateEntry

// Styles matching the uploaded template design
const main: React.CSSProperties = {
  backgroundColor: '#f0f1f5',
  fontFamily: 'Arial, Helvetica, sans-serif',
}
const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
}
const heroSection: React.CSSProperties = {
  padding: '10px 20px 0',
}
const heroImg: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  maxWidth: '560px',
}
const bulletSection: React.CSSProperties = {
  padding: '16px 20px 0',
  textAlign: 'center',
}
const bulletText: React.CSSProperties = {
  color: '#0e1b10',
  fontSize: '18px',
  lineHeight: '1.2',
  margin: '0 0 16px',
  textAlign: 'center',
}
const divider: React.CSSProperties = {
  borderColor: '#bfc3c8',
  borderWidth: '1px 0 0 0',
  margin: '16px 20px',
}
const mainHeading: React.CSSProperties = {
  color: '#0e1b10',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '-0.04em',
  lineHeight: '1',
  textAlign: 'center',
  margin: '16px 20px',
}
const bodyText: React.CSSProperties = {
  color: '#0e1b10',
  fontSize: '14px',
  letterSpacing: '-0.01em',
  lineHeight: '1.4',
  textAlign: 'center',
  margin: '0 40px 24px',
}
const buttonSection: React.CSSProperties = {
  textAlign: 'center',
  padding: '0 20px 24px',
}
const ctaButton: React.CSSProperties = {
  backgroundColor: '#00c4cc',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
  borderRadius: '100px',
  padding: '18px 48px',
  textDecoration: 'none',
  display: 'inline-block',
  letterSpacing: '-0.02em',
}
const darkFooter: React.CSSProperties = {
  backgroundColor: '#070300',
  padding: '30px 30px 20px',
}
const footerHeading: React.CSSProperties = {
  color: '#f6f5f1',
  fontSize: '24px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: '1.2',
  margin: '0 0 16px',
}
const footerText: React.CSSProperties = {
  color: '#f6f5f1',
  fontSize: '17px',
  letterSpacing: '-0.01em',
  lineHeight: '1.4',
  margin: '0 0 16px',
  whiteSpace: 'pre-line',
}
const footerLink: React.CSSProperties = {
  color: '#f6f5f1',
  textDecoration: 'none',
}
const footerCopy: React.CSSProperties = {
  color: '#bfc3c8',
  fontSize: '13px',
  letterSpacing: '-0.01em',
  lineHeight: '1.15',
  margin: '16px 0 0',
}
