// Íconos de trazo propios dibujados con react-native-svg (viewBox 24x24).
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

export type IconName =
  | 'home'
  | 'dumbbell'
  | 'food'
  | 'chart'
  | 'chat'
  | 'user'
  | 'plus'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'camera'
  | 'image'
  | 'trash'
  | 'settings'
  | 'crown'
  | 'close'
  | 'cart'
  | 'refresh'
  | 'info'
  | 'send'
  | 'clock'
  | 'flame'
  | 'share'
  | 'swap'
  | 'lock';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

// Devuelve las formas de cada ícono; todas heredan el trazo del <Svg> padre.
function shapes(name: IconName) {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M3 10.5 12 3l9 7.5" />
          <Path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
        </>
      );
    case 'dumbbell':
      return (
        <>
          <Line x1="7" y1="12" x2="17" y2="12" />
          <Rect x="3.5" y="7" width="3.5" height="10" rx="1" />
          <Rect x="17" y="7" width="3.5" height="10" rx="1" />
          <Line x1="2" y1="12" x2="3.5" y2="12" />
          <Line x1="20.5" y1="12" x2="22" y2="12" />
        </>
      );
    case 'food':
      return (
        <>
          <Path d="M7 3v8" />
          <Path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" />
          <Path d="M7 11v10" />
          <Path d="M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17" />
        </>
      );
    case 'chart':
      return (
        <>
          <Path d="M3 3v18h18" />
          <Polyline points="7 15 11 10 14 13 20 6" />
        </>
      );
    case 'chat':
      return <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z" />;
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </>
      );
    case 'plus':
      return (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Line x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case 'check':
      return <Polyline points="4 12.5 9.5 18 20 6.5" />;
    case 'chevron-right':
      return <Polyline points="9 5 16 12 9 19" />;
    case 'chevron-left':
      return <Polyline points="15 5 8 12 15 19" />;
    case 'camera':
      return (
        <>
          <Path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <Circle cx="12" cy="13" r="3.5" />
        </>
      );
    case 'image':
      return (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="2" />
          <Circle cx="8.5" cy="9.5" r="1.5" />
          <Path d="m21 16-5-5-9 9" />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4 7h16" />
          <Path d="M9 7V4h6v3" />
          <Path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          <Line x1="10" y1="11" x2="10" y2="17" />
          <Line x1="14" y1="11" x2="14" y2="17" />
        </>
      );
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </>
      );
    case 'crown':
      return (
        <>
          <Path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5Z" />
          <Line x1="5" y1="21" x2="19" y2="21" />
        </>
      );
    case 'close':
      return (
        <>
          <Line x1="6" y1="6" x2="18" y2="18" />
          <Line x1="18" y1="6" x2="6" y2="18" />
        </>
      );
    case 'cart':
      return (
        <>
          <Path d="M2.5 3.5h2.5l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
          <Circle cx="9.5" cy="20" r="1.3" />
          <Circle cx="17.5" cy="20" r="1.3" />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
          <Polyline points="4 3 4 8 9 8" />
          <Path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
          <Polyline points="20 21 20 16 15 16" />
        </>
      );
    case 'info':
      return (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Line x1="12" y1="11" x2="12" y2="16.5" />
          <Line x1="12" y1="7.5" x2="12.01" y2="7.5" />
        </>
      );
    case 'send':
      return (
        <>
          <Path d="M21 3 10 14" />
          <Path d="M21 3 14.5 21l-4.5-7-7-4.5Z" />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Polyline points="12 7 12 12 15.5 14" />
        </>
      );
    case 'flame':
      return <Path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.6 2.6-5.6 4-8.4.6 1.6 1.4 2.6 2.6 3.4C12 6.6 13 4.4 14.5 3c.4 3 5.5 5.8 5.5 11.4 0 3.8-3.1 6.6-8 6.6Z" />;
    case 'share':
      return (
        <>
          <Path d="M12 15V3" />
          <Polyline points="7.5 7.5 12 3 16.5 7.5" />
          <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </>
      );
    case 'swap':
      return (
        <>
          <Path d="M4 8h15" />
          <Polyline points="15 4 19 8 15 12" />
          <Path d="M20 16H5" />
          <Polyline points="9 12 5 16 9 20" />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
          <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </>
      );
    default:
      return null;
  }
}

export function Icon({ name, size = 22, color }: IconProps) {
  const { c } = useTheme();
  const stroke = color ?? c.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shapes(name)}
    </Svg>
  );
}
