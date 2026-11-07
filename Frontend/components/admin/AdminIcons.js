import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

/**
 * Extra line icons for the ADMIN screens (same 24x24 / 1.6 stroke language as
 * components/trainer/TrainerIcons). The icons the trainer already has
 * (Home, Dumbbell, Profile, Clipboard, Flag, Qr, Users, Alert, Chevrons...)
 * are imported from there instead of being duplicated.
 */
const base = (size, color, strokeWidth = 1.6) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const BriefcaseIcon = ({ color, size = 28 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <Path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
    <Path d="M3 13h18" />
    <Path d="M10.5 13v1.5h3V13" />
  </Svg>
);

export const BellIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15L6 16.5Z" />
    <Path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

export const GiftIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3.5" y="9" width="17" height="4" rx="1" />
    <Path d="M5 13v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V13" />
    <Path d="M12 9v11.5" />
    <Path d="M12 9c-1.2-4-5.5-4.2-5.5-1.6C6.5 9 9 9 12 9Zm0 0c1.2-4 5.5-4.2 5.5-1.6C17.5 9 15 9 12 9Z" />
  </Svg>
);

export const StarIcon = ({ color, size = 16 }) => (
  <Svg {...base(size, color)}>
    <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />
  </Svg>
);

export const BarChartIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Line x1="4" y1="20" x2="20" y2="20" />
    <Rect x="5.5" y="11" width="3" height="9" rx="0.8" />
    <Rect x="10.5" y="5" width="3" height="15" rx="0.8" />
    <Rect x="15.5" y="14" width="3" height="6" rx="0.8" />
  </Svg>
);

export const ClockIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 7.5V12l3 2" />
  </Svg>
);
