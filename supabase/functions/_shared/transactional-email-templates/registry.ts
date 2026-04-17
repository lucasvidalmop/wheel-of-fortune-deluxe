/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as wheelInvite } from './wheel-invite.tsx'
import { template as wheelInviteCustom } from './wheel-invite-custom.tsx'
import { template as wheelInviteLucas } from './wheel-invite-lucas.tsx'
import { template as wheelInviteBlocks } from './wheel-invite-blocks.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'wheel-invite': wheelInvite,
  'wheel-invite-custom': wheelInviteCustom,
  'wheel-invite-lucas': wheelInviteLucas,
  'wheel-invite-blocks': wheelInviteBlocks,
}
