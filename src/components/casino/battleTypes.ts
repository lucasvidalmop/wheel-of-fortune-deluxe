// Types and defaults for the Battle Slot feature.
// Independent from the Roleta types — do not mix them.

export interface BattleParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  weight?: number; // optional weighting for the draw (default 1)
}

export interface BattleConfig {
  // Header / page
  pageTitle: string;
  pageSubtitle: string;
  headerMode: 'text' | 'image' | 'image_text';
  headerImageUrl?: string;
  headerTitleSize: number;
  headerSubtitleSize: number;
  headerImageSize: number;

  // Background
  bgColor: string;
  bgImageUrl?: string;
  bgImageMobileUrl?: string;

  // Wheel visuals
  wheelOuterRingColor: string;
  wheelDividerColor: string;
  wheelDividerWidth: number;
  wheelLedColor: string;
  wheelLedSize: number;
  wheelGlowColor: string;
  wheelPointerColor: string;
  wheelCenterCapColor: string;
  wheelCenterImageUrl?: string;

  // Default segment palette (used when participants don't override colors)
  segmentPalette: string[];
  segmentTextColor: string;
  segmentFontSize: number;

  // Action button
  buttonColor: string;
  buttonTextColor: string;
  buttonText: string;
  buttonFontSize: number;
  buttonBorderRadius: number;

  // Result box
  resultBoxColor: string;
  resultTextColor: string;
  resultBorderColor: string;
  resultTitle: string; // e.g. "Vencedor"

  // Mobile adjustments
  mobileWheelScale?: number;
  mobileWheelOffsetY?: number;

  // SEO
  seoTitle?: string;
  seoDescription?: string;
  faviconUrl?: string;

  // Participants (defined later by the user, but stored with the config)
  participants: BattleParticipant[];
}

export const defaultBattleConfig: BattleConfig = {
  pageTitle: 'BATALHA SLOT',
  pageSubtitle: 'Quem será o sorteado?',
  headerMode: 'text',
  headerTitleSize: 36,
  headerSubtitleSize: 14,
  headerImageSize: 120,

  bgColor: '#0b0820',

  wheelOuterRingColor: '#8B8B8B',
  wheelDividerColor: '#C0C0C0',
  wheelDividerWidth: 3,
  wheelLedColor: '#FFE033',
  wheelLedSize: 5,
  wheelGlowColor: '#FFD700',
  wheelPointerColor: '#E0E0E0',
  wheelCenterCapColor: '#2a2a2a',

  segmentPalette: [
    '#1a1a3e',
    '#2d1a1a',
    '#1a2a1a',
    '#2a1a2a',
    '#1a2a2a',
    '#3a2a1a',
    '#1a1a2a',
    '#2a2a1a',
  ],
  segmentTextColor: '#ffffff',
  segmentFontSize: 14,

  buttonColor: '#FFD700',
  buttonTextColor: '#000000',
  buttonText: 'GIRAR',
  buttonFontSize: 18,
  buttonBorderRadius: 12,

  resultBoxColor: '#000000',
  resultTextColor: '#FFD700',
  resultBorderColor: '#FFD700',
  resultTitle: 'VENCEDOR',

  participants: [],
};
