import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

/**
 * Outlined line icons used by the trainer screens (same 24x24 / 1.6 stroke
 * language as AdminBottomNav so the whole staff UI reads as one family).
 * Every icon takes `color` and optional `size`.
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

export const CalendarIcon = ({ color, size = 28 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <Path d="M3.5 10h17" />
    <Path d="M8 3v4M16 3v4" />
  </Svg>
);

export const HomeIcon = ({ color, size = 28 }) => (
  <Svg {...base(size, color)}>
    <Path d="M3 11.5 12 4l9 7.5" />
    <Path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
  </Svg>
);

export const DumbbellIcon = ({ color, size = 28 }) => (
  <Svg {...base(size, color)}>
    <Rect x="2.5" y="8" width="3" height="8" rx="1" />
    <Rect x="18.5" y="8" width="3" height="8" rx="1" />
    <Rect x="5.5" y="10" width="2" height="4" rx="0.5" />
    <Rect x="16.5" y="10" width="2" height="4" rx="0.5" />
    <Line x1="7.5" y1="12" x2="16.5" y2="12" />
  </Svg>
);

export const ProfileIcon = ({ color, size = 28 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6" />
  </Svg>
);

export const ClipboardIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <Path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
    <Path d="M8.5 11h7M8.5 15h4.5" />
  </Svg>
);

export const AlertIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Path d="M12 3.5 2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3.5Z" />
    <Path d="M12 10v4.5" />
    <Circle cx="12" cy="17.5" r="0.6" fill={color} />
  </Svg>
);

export const FlagIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Path d="M5 21V4" />
    <Path d="M5 4.5h11.5l-2 3.7 2 3.8H5" />
  </Svg>
);

export const QrIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color)}>
    <Rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <Rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <Rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <Path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
  </Svg>
);

export const ChevronRightIcon = ({ color, size = 20 }) => (
  <Svg {...base(size, color, 2)}>
    <Path d="m9 5 7 7-7 7" />
  </Svg>
);

export const ChevronLeftIcon = ({ color, size = 24 }) => (
  <Svg {...base(size, color, 2)}>
    <Path d="m15 5-7 7 7 7" />
  </Svg>
);

export const CheckIcon = ({ color, size = 16 }) => (
  <Svg {...base(size, color, 2.6)}>
    <Path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const CloseIcon = ({ color, size = 18 }) => (
  <Svg {...base(size, color, 2.2)}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const UsersIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Circle cx="9" cy="8.5" r="3.5" />
    <Path d="M2.5 20c0-3.3 2.9-5.2 6.5-5.2s6.5 1.9 6.5 5.2" />
    <Path d="M16 5.2a3.3 3.3 0 0 1 0 6.3M18.5 14.9c1.9.6 3 2.1 3 5.1" />
  </Svg>
);

export const HandIcon = ({ color, size = 22 }) => (
  <Svg {...base(size, color)}>
    <Path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7-2.8 0-4.3-1.4-5.5-3.5L3 13.5a1.5 1.5 0 0 1 2.6-1.5L8 15" />
  </Svg>
);
