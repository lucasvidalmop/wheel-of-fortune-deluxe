export interface WheelSegment {
  id: string;
  title: string;
  reward: string;
  color: string;
  gradientOverlay: string;
  textColor: string;
  imageUrl?: string;
  percentage: number;
}

export interface WheelConfig {
  segments: WheelSegment[];
  outerRingColor: string;
  ledColor: string;
  centerCapColor: string;
  centerImageUrl?: string;
  dividerColor: string;
  glowColor: string;
  pointerColor: string;
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
};
