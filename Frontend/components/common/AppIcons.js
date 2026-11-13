import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

/**
 * Line icons (24x24, round strokes) for the user Profile / Edit-profile
 * screens. They replace the emoji glyphs that were used before, and take
 * their color from the `color` prop (so they can be teal or white).
 */
const base = (size, color, strokeWidth = 1.7) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const PersonIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="12" cy="8" r="3.6" />
    <Path d="M4.5 20c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
  </Svg>
);

export const MailIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <Path d="M3.5 7.5l8.5 6 8.5-6" />
  </Svg>
);

export const GiftIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3.5" y="9" width="17" height="11" rx="2" />
    <Path d="M3 9h18v3H3zM12 9v11" />
    <Path d="M12 9c-1.5-4-5.5-4-5.5-1.6C6.5 9 9 9 12 9zM12 9c1.5-4 5.5-4 5.5-1.6C17.5 9 15 9 12 9z" />
  </Svg>
);

export const GenderIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="10" cy="14" r="5" />
    <Path d="M14 10l6-6M15 4h5v5" />
  </Svg>
);

export const BarChartIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Rect x="4" y="12" width="4" height="8" rx="1" />
    <Rect x="10" y="4" width="4" height="16" rx="1" />
    <Rect x="16" y="9" width="4" height="11" rx="1" />
  </Svg>
);

export const AwardIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="12" cy="9" r="5.5" />
    <Path d="M12 6.5l1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2L8.8 8.8 11 8.5z" />
    <Path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" />
  </Svg>
);

export const HeartIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
  </Svg>
);

export const HomeAddressIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Path d="M4 11l8-7 8 7" />
    <Path d="M6 10v10h12V10" />
    <Path d="M10 20v-5h4v5" />
  </Svg>
);

export const LockIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Rect x="5" y="11" width="14" height="9.5" rx="2.2" />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const CameraIcon = ({ color, size = 18 }) => (
  <Svg {...base(size, color)}>
    <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.3-2h6.4l1.3 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <Circle cx="12" cy="13" r="3.4" />
  </Svg>
);

export const BellIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const CrownIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Path d="M3.5 18.5l-1-11 5.5 4.5L12 5l4 8 5.5-5.5-1 11z" />
  </Svg>
);

export const MedalIcon = AwardIcon;
