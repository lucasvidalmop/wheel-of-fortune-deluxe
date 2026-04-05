export interface WheelSegment {
  id: string;
  title: string;
  reward: string;
  color: string;
  gradientOverlay: string;
  textColor: string;
  imageUrl?: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
  percentage: number;
  postSpinMessage?: string;
}

export interface WheelConfig {
  segments: WheelSegment[];
  outerRingColor: string;
  ledColor: string;
  centerCapColor: string;
  centerImageUrl?: string;
  centerImageOffsetX?: number;
  centerImageOffsetY?: number;
  centerImageScale?: number;
  dividerColor: string;
  glowColor: string;
  pointerColor: string;
  buttonColor: string;
  buttonTextColor: string;
  resultBoxColor: string;
  resultTextColor: string;
  resultBorderColor: string;
  pageTitle: string;
  pageSubtitle: string;
  headerMode: 'text' | 'image';
  headerImageUrl?: string;
  headerImageOffsetX?: number;
  headerImageOffsetY?: number;
  headerImageScale?: number;
  headerTitleSize: number;
  headerSubtitleSize: number;
  headerImageSize: number;
  backgroundImageUrl?: string;
  backgroundImageOffsetX?: number;
  backgroundImageOffsetY?: number;
  backgroundImageScale?: number;
  fontSizeScale: number;
  hideSegmentText: boolean;
  dividerWidth: number;
  ledSize: number;
  titleFontSize: number;
  valueFontSize: number;
  // Auth page customization
  authHeaderMode: 'text' | 'logo' | 'logo_text';
  authTitle: string;
  authSubtitle: string;
  authLogoUrl?: string;
  authLogoSize: number;
  authLogoOffsetX?: number;
  authLogoOffsetY?: number;
  authLogoScale?: number;
  authTitleSize: number;
  authSubtitleSize: number;
  authBgColor: string;
  authBgImageUrl?: string;
  authBgImageOffsetX?: number;
  authBgImageOffsetY?: number;
  authBgImageScale?: number;
  authBgImageMobileUrl?: string;
  authBgImageMobileOffsetX?: number;
  authBgImageMobileOffsetY?: number;
  authBgImageMobileScale?: number;
  authCardBgColor: string;
  authCardBorderColor: string;
  authInputBorderColor: string;
  authButtonBgColor: string;
  authButtonTextColor: string;
  authLabelColor: string;
  authTextColor: string;
  // Mobile layout adjustments
  mobileWheelOffsetX?: number;
  mobileWheelOffsetY?: number;
  mobileWheelScale?: number;
  mobileSpinsOffsetX?: number;
  mobileSpinsOffsetY?: number;
  mobileButtonOffsetX?: number;
  mobileButtonOffsetY?: number;
  mobileLogoOffsetX?: number;
  mobileLogoOffsetY?: number;
  mobileLogoScale?: number;
  // Page SEO / Favicon
  seoTitle?: string;
  seoDescription?: string;
  faviconUrl?: string;
  // Spins info text customization
  spinsTextColor?: string;
  spinsTextSize?: number;
  spinsTextFont?: string;
  noSpinsTextColor?: string;
  noSpinsTextSize?: number;
  noSpinsTextFont?: string;
  // User badge customization
  badgeBgColor?: string;
  badgeBorderColor?: string;
  badgeNameColor?: string;
  badgeLabelColor?: string;
  badgeIdColor?: string;
  // Share button customization
  shareBtnBgColor?: string;
  shareBtnTextColor?: string;
  shareBtnText?: string;
  shareBtnBorderColor?: string;
  shareBtnBorderRadius?: number;
  shareBtnFontSize?: number;
  shareBtnPaddingX?: number;
  shareBtnPaddingY?: number;
  // Share button mobile overrides
  shareBtnMobileFontSize?: number;
  shareBtnMobilePaddingX?: number;
  shareBtnMobilePaddingY?: number;
  // Post-login dialog
  postLoginDialogEnabled?: boolean;
  postLoginDialogTitle?: string;
  postLoginDialogBody?: string;
  postLoginDialogBtnEnabled?: boolean;
  postLoginDialogBtnText?: string;
  postLoginDialogBtnUrl?: string;
  postLoginDialogBtnBgColor?: string;
  postLoginDialogBtnTextColor?: string;
  postLoginDialogBgColor?: string;
  postLoginDialogTextColor?: string;
  postLoginDialogTitleColor?: string;
  postLoginDialogBorderColor?: string;
  postLoginDialogTitleSize?: number;
  postLoginDialogBodySize?: number;
  postLoginDialogBtnFontSize?: number;
  postLoginDialogBtnBorderRadius?: number;
  postLoginDialogWidth?: number;
  postLoginDialogMobileWidth?: number;
  postLoginDialogMobileTitleSize?: number;
  postLoginDialogMobileBodySize?: number;
  postLoginDialogMobileBtnFontSize?: number;
  // Dialog text formatting
  postLoginDialogTitleFont?: string;
  postLoginDialogBodyFont?: string;
  postLoginDialogTitleBold?: boolean;
  postLoginDialogTitleItalic?: boolean;
  postLoginDialogBodyBold?: boolean;
  postLoginDialogBodyItalic?: boolean;
  postLoginDialogTextAlign?: 'left' | 'center' | 'right';
}

export const defaultSegments: WheelSegment[] = [
  { id: '1', title: '20 GIROS', reward: '20', color: '#1a1a3e', gradientOverlay: 'rgba(255,215,0,0.15)', textColor: '#FFD700', percentage: 20 },
  { id: '2', title: 'GIRE AMANHÃ', reward: '0', color: '#2d1a1a', gradientOverlay: 'rgba(255,50,50,0.12)', textColor: '#FF6B6B', percentage: 10 },
  { id: '3', title: '14 GIROS', reward: '14', color: '#1a2a1a', gradientOverlay: 'rgba(0,255,100,0.12)', textColor: '#4ADE80', percentage: 15 },
  { id: '4', title: '20 GIROS', reward: '20', color: '#1a1a3e', gradientOverlay: 'rgba(100,150,255,0.15)', textColor: '#60A5FA', percentage: 20 },
  { id: '5', title: '07 GIROS', reward: '7', color: '#2a1a2a', gradientOverlay: 'rgba(200,100,255,0.12)', textColor: '#C084FC', percentage: 15 },
  { id: '6', title: '10 GIROS', reward: '10', color: '#1a2a2a', gradientOverlay: 'rgba(0,220,220,0.12)', textColor: '#22D3EE', percentage: 20 },
];

export const defaultConfig: WheelConfig = {
  segments: defaultSegments,
  outerRingColor: '#8B8B8B',
  ledColor: '#FFE033',
  centerCapColor: '#2a2a2a',
  dividerColor: '#C0C0C0',
  glowColor: '#FFD700',
  pointerColor: '#E0E0E0',
  buttonColor: '#FFD700',
  buttonTextColor: '#000000',
  resultBoxColor: '#000000',
  resultTextColor: '#FFD700',
  resultBorderColor: '#FFD700',
  pageTitle: 'ROLETA',
  pageSubtitle: 'Nível Quartzo',
  headerMode: 'text',
  headerTitleSize: 36,
  headerSubtitleSize: 12,
  headerImageSize: 120,
  fontSizeScale: 1,
  hideSegmentText: false,
  dividerWidth: 3,
  ledSize: 5,
  titleFontSize: 10,
  valueFontSize: 22,
  // Auth defaults
  authHeaderMode: 'text',
  authTitle: 'LIBERAR GIRO',
  authSubtitle: 'Informe o e-mail e o ID da sua conta para verificarmos seu cadastro.',
  authLogoSize: 80,
  authTitleSize: 18,
  authSubtitleSize: 12,
  authBgColor: '#1a0a2e',
  authCardBgColor: '#140c28',
  authCardBorderColor: '#ffffff14',
  authInputBorderColor: '#D4A017',
  authButtonBgColor: '#0ABACC',
  authButtonTextColor: '#000000',
  authLabelColor: '#ffffff',
  authTextColor: '#ffffff80',
};
