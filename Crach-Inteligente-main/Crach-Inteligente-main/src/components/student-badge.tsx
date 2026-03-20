import { type Student } from "@/lib/types";
import { type BadgeStyleConfig, type TextStyle } from "@/lib/badge-styles";
import Image from "next/image";

interface StudentBadgeProps {
  student: Student;
  background: string;
  styles: BadgeStyleConfig;
}

const BADGE_BASE_WIDTH = 1063;
const BADGE_BASE_HEIGHT = 768;

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export default function StudentBadge({ student, background, styles }: StudentBadgeProps) {
  
  const renderText = (text: string, style: TextStyle) => {
    if (!text || !style) return null;
    const rgb = hexToRgb(style.backgroundColor);
    const opacity = typeof style.backgroundOpacity === 'number' ? style.backgroundOpacity : 0;
    const rgba = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : 'transparent';
    
    const scaledFontSize = `${((style.fontSize || 24) / BADGE_BASE_HEIGHT) * 100}cqh`;
    const paddingTop = `${((style.paddingTop || 0) / BADGE_BASE_HEIGHT) * 100}cqh`;
    const paddingLeft = `${((style.paddingLeft || 0) / BADGE_BASE_WIDTH) * 100}cqw`;
    
    return (
      <div
        className="absolute flex items-center overflow-hidden"
        style={{
          left: `${((style.x || 0) / BADGE_BASE_WIDTH) * 100}%`,
          top: `${((style.y || 0) / BADGE_BASE_HEIGHT) * 100}%`,
          width: `${((style.width || 100) / BADGE_BASE_WIDTH) * 100}%`,
          height: `${((style.height || 40) / BADGE_BASE_HEIGHT) * 100}%`,
          fontSize: scaledFontSize,
          color: style.color || '#000000',
          fontWeight: style.fontWeight || 'normal',
          textAlign: style.textAlign || 'left',
          backgroundColor: rgba,
          borderRadius: `${((style.backgroundRadius || 0) / BADGE_BASE_WIDTH) * 100}cqw`,
          paddingTop: paddingTop,
          paddingLeft: paddingLeft,
          justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
          zIndex: 20,
          lineHeight: 0.95
        }}
      >
        <span className="w-full leading-tight whitespace-normal break-words line-clamp-2">
          {text}
        </span>
      </div>
    );
  };

  const photoStyles = styles?.photo || { x: 0, y: 0, width: 100, height: 100, borderRadius: 0 };

  const photoStyle: React.CSSProperties = {
    left: `${(photoStyles.x / BADGE_BASE_WIDTH) * 100}%`,
    top: `${(photoStyles.y / BADGE_BASE_HEIGHT) * 100}%`,
    width: `${(photoStyles.width / BADGE_BASE_WIDTH) * 100}%`,
    height: `${(photoStyles.height / BADGE_BASE_HEIGHT) * 100}%`,
    borderRadius: `${(photoStyles.borderRadius / BADGE_BASE_WIDTH) * 100}cqw`,
    boxSizing: 'border-box',
    zIndex: 10,
    overflow: 'hidden',
    position: 'absolute'
  };

  if (photoStyles.hasBorder && (photoStyles.borderWidth || 0) > 0) {
    const borderColorRgb = hexToRgb(photoStyles.borderColor);
    const borderColorRgba = borderColorRgb
      ? `rgba(${borderColorRgb.r}, ${borderColorRgb.g}, ${borderColorRgb.b}, ${photoStyles.borderOpacity || 1})`
      : 'transparent';
    
    photoStyle.border = `${(photoStyles.borderWidth / BADGE_BASE_WIDTH) * 100}cqw solid ${borderColorRgba}`;
  }

  const badgeRadius = `${((styles?.badgeRadius || 0) / BADGE_BASE_WIDTH) * 100}cqw`;

  return (
    <div
      className="relative aspect-[1063/768] w-full overflow-hidden bg-white shadow-md [container-type:size]"
      style={{ borderRadius: badgeRadius }}
      data-ai-hint="student badge"
    >
      <div className="absolute inset-0 z-0">
        {background && (
          <Image 
            src={background} 
            alt="Badge Background" 
            fill 
            className="object-cover" 
            priority
            unoptimized
          />
        )}
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none">
        <div style={photoStyle}>
          {student.fotoUrl && (
            <Image
              src={student.fotoUrl}
              alt={`Photo of ${student.nome}`}
              fill
              className="object-cover"
              unoptimized
            />
          )}
        </div>

        {renderText(student.nome, styles?.name)}
        {renderText(student.turma, styles?.turma)}
        
        {styles?.customFields?.map((field) => {
            const value = student.customData?.[field.id];
            if (!value) return null;
            return (
                <div key={field.id}>
                    {renderText(value, field)}
                </div>
            );
        })}
      </div>
    </div>
  );
}
