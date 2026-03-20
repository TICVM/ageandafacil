export interface BaseStyle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextStyle extends BaseStyle {
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundRadius: number;
  paddingTop: number; // Deslocamento Vertical
  paddingLeft: number; // Deslocamento Horizontal
}

export interface PhotoStyle extends BaseStyle {
  borderRadius: number;
  hasBorder: boolean;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
}

export interface CustomField extends TextStyle {
  id: string;
  label: string;
}

export interface BadgeStyleConfig {
  photo: PhotoStyle;
  name: TextStyle;
  turma: TextStyle;
  customFields: CustomField[];
  badgeRadius: number; // Arredondamento do Crachá completo
}

// Valores baseados em um design de 1063x768 pixels
export const defaultBadgeStyle: BadgeStyleConfig = {
  badgeRadius: 20,
  photo: {
    x: 376,
    y: 195,
    width: 292,
    height: 376,
    borderRadius: 20,
    hasBorder: true,
    borderWidth: 6,
    borderColor: '#ffffff',
    borderOpacity: 1,
  },
  name: {
    x: 380,
    y: 600,
    width: 640,
    height: 60,
    fontSize: 42,
    color: '#2a4d7a',
    fontWeight: 'bold',
    textAlign: 'left',
    backgroundColor: '#ffffff',
    backgroundOpacity: 0.85,
    backgroundRadius: 10,
    paddingTop: 0,
    paddingLeft: 0,
  },
  turma: {
    x: 380,
    y: 670,
    width: 280,
    height: 50,
    fontSize: 36,
    color: '#2a4d7a',
    fontWeight: 'bold',
    textAlign: 'left',
    backgroundColor: '#ffffff',
    backgroundOpacity: 0.85,
    backgroundRadius: 10,
    paddingTop: 0,
    paddingLeft: 0,
  },
  customFields: [],
};
