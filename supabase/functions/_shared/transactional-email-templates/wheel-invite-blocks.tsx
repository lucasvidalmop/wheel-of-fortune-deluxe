/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Button, Section, Img, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Generic block-based wheel invite template.
 * Operators design their own templates by composing blocks (hero/bullets/heading/text/cta/footer)
 * and pass the structure via templateData.blocks.
 */

interface BlockBase { type: string; id?: string }
interface HeroBlock extends BlockBase { type: 'hero'; imageUrl: string; alt?: string }
interface ImageBlock extends BlockBase { type: 'image'; imageUrl: string; alt?: string; width?: number; align?: 'left' | 'center' | 'right'; linkUrl?: string }
interface BulletsBlock extends BlockBase { type: 'bullets'; items: { bold?: string; text?: string }[]; align?: 'left' | 'center' }
interface DividerBlock extends BlockBase { type: 'divider' }
interface HeadingBlock extends BlockBase { type: 'heading'; text: string; align?: 'left' | 'center'; color?: string }
interface TextBlock extends BlockBase { type: 'text'; text: string; align?: 'left' | 'center'; color?: string }
interface CTABlock extends BlockBase { type: 'cta'; label: string; backgroundColor?: string; textColor?: string }
interface HtmlBlock extends BlockBase { type: 'html'; html: string }
interface FooterBlock extends BlockBase { type: 'footer'; heading?: string; text?: string; copyright?: string; backgroundColor?: string; textColor?: string }
type Block = HeroBlock | ImageBlock | BulletsBlock | DividerBlock | HeadingBlock | TextBlock | CTABlock | HtmlBlock | FooterBlock

interface WheelInviteBlocksProps {
  name?: string
  body?: string
  subject?: string
  roletaLink?: string
  blocks?: Block[]
  backgroundColor?: string
}

const DEFAULT_BLOCKS: Block[] = [
  { type: 'heading', text: 'Seu giro está disponível', align: 'center' },
  { type: 'text', text: 'Entre agora na roleta antes que expire.', align: 'center' },
  { type: 'cta', label: 'Girar agora →', backgroundColor: '#00c4cc', textColor: '#ffffff' },
]

const WheelInviteBlocksEmail = ({ name, body, roletaLink, blocks, backgroundColor }: WheelInviteBlocksProps) => {
  const link = roletaLink || '#'
  const list = Array.isArray(blocks) && blocks.length > 0 ? blocks : DEFAULT_BLOCKS

  // Substitute {name} and {body} placeholders in any string content
  const replaceVars = (str?: string) =>
    (str || '')
      .replaceAll('{name}', name || '')
      .replaceAll('{body}', body || '')

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{name ? `${name}, seu giro está disponível!` : 'Seu giro está disponível!'}</Preview>
      <Body style={{ backgroundColor: backgroundColor || '#f0f1f5', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={container}>
          {list.map((block, idx) => {
            switch (block.type) {
              case 'hero':
                return (
                  <Section key={idx} style={{ padding: '10px 20px 0' }}>
                    <Img src={block.imageUrl} alt={block.alt || ''} width="560" style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '560px' }} />
                  </Section>
                )
              case 'image': {
                const w = Math.min(Math.max(block.width || 480, 100), 600)
                const img = <Img src={block.imageUrl} alt={block.alt || ''} width={String(w)} style={{ display: 'inline-block', width: '100%', height: 'auto', maxWidth: `${w}px` }} />
                return (
                  <Section key={idx} style={{ padding: '12px 20px', textAlign: block.align || 'center' }}>
                    {block.linkUrl ? <a href={block.linkUrl} style={{ display: 'inline-block' }}>{img}</a> : img}
                  </Section>
                )
              }
              case 'bullets':
                return (
                  <Section key={idx} style={{ padding: '16px 20px 0', textAlign: block.align || 'center' }}>
                    {block.items?.map((it, i) => (
                      <Text key={i} style={{ color: '#0e1b10', fontSize: '18px', lineHeight: '1.2', margin: '0 0 16px', textAlign: block.align || 'center' }}>
                        {it.bold && <span style={{ fontWeight: 700, letterSpacing: '-0.04em' }}>{replaceVars(it.bold)} </span>}
                        {it.text && <span style={{ letterSpacing: '-0.03em' }}>{replaceVars(it.text)}</span>}
                      </Text>
                    ))}
                  </Section>
                )
              case 'divider':
                return <Hr key={idx} style={{ borderColor: '#bfc3c8', borderWidth: '1px 0 0 0', margin: '16px 20px' }} />
              case 'heading':
                return (
                  <Text key={idx} style={{ color: block.color || '#0e1b10', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: '1', textAlign: block.align || 'center', margin: '16px 20px' }}>
                    {replaceVars(block.text)}
                  </Text>
                )
              case 'text':
                return (
                  <Text key={idx} style={{ color: block.color || '#0e1b10', fontSize: '14px', letterSpacing: '-0.01em', lineHeight: '1.4', textAlign: block.align || 'center', margin: '0 40px 24px', whiteSpace: 'pre-line' }}>
                    {replaceVars(block.text)}
                  </Text>
                )
              case 'cta':
                return (
                  <Section key={idx} style={{ textAlign: 'center', padding: '0 20px 24px' }}>
                    <Button
                      href={link}
                      style={{
                        backgroundColor: block.backgroundColor || '#00c4cc',
                        color: block.textColor || '#ffffff',
                        fontSize: '18px',
                        fontWeight: 700,
                        borderRadius: '100px',
                        padding: '18px 48px',
                        textDecoration: 'none',
                        display: 'inline-block',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {replaceVars(block.label)}
                    </Button>
                  </Section>
                )
              case 'html': {
                const rawHtml = replaceVars(block.html || '').replaceAll('{roletaLink}', link)
                return <div key={idx} dangerouslySetInnerHTML={{ __html: rawHtml }} />
              }
              case 'footer':
                return (
                  <Section key={idx} style={{ backgroundColor: block.backgroundColor || '#070300', padding: '30px 30px 20px' }}>
                    {block.heading && (
                      <Text style={{ color: block.textColor || '#f6f5f1', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '1.2', margin: '0 0 16px' }}>
                        {replaceVars(block.heading)}
                      </Text>
                    )}
                    {block.text && (
                      <Text style={{ color: block.textColor || '#f6f5f1', fontSize: '17px', letterSpacing: '-0.01em', lineHeight: '1.4', margin: '0 0 16px', whiteSpace: 'pre-line' }}>
                        {replaceVars(block.text)}
                      </Text>
                    )}
                    {block.copyright && (
                      <Text style={{ color: '#bfc3c8', fontSize: '13px', letterSpacing: '-0.01em', lineHeight: '1.15', margin: '16px 0 0' }}>
                        {replaceVars(block.copyright)}
                      </Text>
                    )}
                  </Section>
                )
              default:
                return null
            }
          })}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WheelInviteBlocksEmail,
  subject: (data: Record<string, any>) => data.subject || '🎰 Seu giro está disponível!',
  displayName: 'Convite Roleta - Blocos (Operador)',
  previewData: {
    name: 'João',
    body: 'Seu giro já está disponível!',
    roletaLink: 'https://tipspayroleta.com',
    blocks: DEFAULT_BLOCKS,
  },
} satisfies TemplateEntry
