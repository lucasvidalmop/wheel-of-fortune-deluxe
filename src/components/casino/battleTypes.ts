// Types and defaults for the Battle Slot feature.
// Independent from the Roleta types — do not mix them.

export interface BattleParticipant {
  id: string;
  name: string;
  game?: string; // chosen slot game (ex: Fortune Tiger)
  avatarUrl?: string;
  weight?: number; // optional weighting for the draw (default 1)
  score?: number; // manual ranking score, defined per round by the operator
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
  headerAccentColor: string; // underline / accent under title
  titleColor: string;

  // Background
  bgColor: string;
  bgImageUrl?: string;
  bgImageMobileUrl?: string;

  // Wheel visuals (minimalist style)
  wheelOuterRingColor: string;
  wheelDividerColor: string;
  wheelDividerWidth: number;
  wheelGlowColor: string;
  wheelPointerColor: string;
  wheelInnerColor: string; // inner disc color
  wheelCenterButtonColor: string; // SPIN center button bg
  wheelCenterButtonTextColor: string;
  wheelCenterButtonText: string;

  // Default segment palette (used when participants don't override colors)
  segmentPalette: string[];
  segmentTextColor: string;
  segmentFontSize: number;

  // Action button (below wheel)
  buttonColor: string;
  buttonTextColor: string;
  buttonText: string;
  buttonFontSize: number;
  buttonBorderRadius: number;
  buttonBorderColor: string;

  // Side panels
  panelBgColor: string;
  panelBorderColor: string;
  panelTextColor: string;
  panelLabelColor: string; // small uppercase labels
  inputBgColor: string;
  inputBorderColor: string;
  inputTextColor: string;

  // Result box
  resultBoxColor: string;
  resultTextColor: string;
  resultBorderColor: string;
  resultTitle: string;

  // SEO
  seoTitle?: string;
  seoDescription?: string;
  faviconUrl?: string;
}

export const defaultBattleConfig: BattleConfig = {
  pageTitle: 'SLOT BATTLE',
  pageSubtitle: '',
  headerMode: 'text',
  headerTitleSize: 64,
  headerSubtitleSize: 14,
  headerImageSize: 120,
  headerAccentColor: '#3DE8D2',
  titleColor: '#FFFFFF',

  bgColor: '#0B0F14',

  wheelOuterRingColor: '#1A2028',
  wheelDividerColor: '#2A323C',
  wheelDividerWidth: 1,
  wheelGlowColor: '#3DE8D2',
  wheelPointerColor: '#3DE8D2',
  wheelInnerColor: '#0F141A',
  wheelCenterButtonColor: '#0F141A',
  wheelCenterButtonTextColor: '#3DE8D2',
  wheelCenterButtonText: 'SPIN',

  segmentPalette: [
    '#11161C',
    '#161C24',
    '#0F141A',
    '#1A2028',
  ],
  segmentTextColor: '#E6FFFB',
  segmentFontSize: 13,

  buttonColor: 'transparent',
  buttonTextColor: '#5A6470',
  buttonText: 'GIRAR',
  buttonFontSize: 14,
  buttonBorderRadius: 6,
  buttonBorderColor: '#1F262E',

  panelBgColor: '#11161C',
  panelBorderColor: '#1F262E',
  panelTextColor: '#E6FFFB',
  panelLabelColor: '#8A95A1',
  inputBgColor: '#0B0F14',
  inputBorderColor: '#3DE8D2',
  inputTextColor: '#E6FFFB',

  resultBoxColor: '#11161C',
  resultTextColor: '#3DE8D2',
  resultBorderColor: '#3DE8D2',
  resultTitle: 'VENCEDOR',
};
