// Real category icons. Hand-drawn as SVG paths (no emoji, no
// external assets). Line style with subtle fills, sized by the
// `size` prop. Each icon fits inside a 48×48 viewBox so it scales
// cleanly.
//
// These are deliberately simple — recognisable at 40px on a phone
// tile, and they look professional, not cartoonish.

type IconProps = { size?: number; color?: string };

export function MilkIcon({ size = 24, color = "#1e40af" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* milk carton body */}
      <path
        d="M14 16h20v26a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V16z"
        fill="#dbeafe"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* carton top */}
      <path
        d="M14 16l4-6h12l4 6"
        fill="#bfdbfe"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* milk level line */}
      <path d="M14 24h20" stroke={color} strokeWidth="2" opacity="0.5" />
      {/* milk drop */}
      <path
        d="M24 30c-2 2.5-3.5 4-3.5 5.5a3.5 3.5 0 0 0 7 0c0-1.5-1.5-3-3.5-5.5z"
        fill={color}
      />
    </svg>
  );
}

export function YoghurtIcon({ size = 24, color = "#9d174d" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* cup body */}
      <path
        d="M12 18h24l-2.5 22a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2L12 18z"
        fill="#fce7f3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* lid */}
      <path
        d="M11 14h26v4H11z"
        fill="#f9a8d4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* spoon */}
      <path
        d="M22 26l3-3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="27" cy="23" r="2.5" fill={color} />
    </svg>
  );
}

export function ButterIcon({ size = 24, color = "#92400e" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* butter block */}
      <path
        d="M8 20l16-8 16 8v10l-16 8-16-8V20z"
        fill="#fef3c7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* top face */}
      <path
        d="M8 20l16-8 16 8-16 8-16-8z"
        fill="#fde68a"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* butter knife mark */}
      <path
        d="M20 24v6M28 24v6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function CheeseIcon({ size = 24, color = "#854d0e" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* cheese wedge */}
      <path
        d="M8 32V22l32-10v20H8z"
        fill="#fef9c3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* top sloping face */}
      <path
        d="M8 22l32-10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* holes */}
      <circle cx="20" cy="30" r="2" fill={color} opacity="0.6" />
      <circle cx="30" cy="28" r="2.5" fill={color} opacity="0.6" />
      <circle cx="28" cy="34" r="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}

export function PackageIcon({ size = 24, color = "#3730a3" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* box body */}
      <path
        d="M10 18l14-8 14 8v14l-14 8-14-8V18z"
        fill="#e0e7ff"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* top face */}
      <path
        d="M10 18l14-8 14 8-14 8-14-8z"
        fill="#c7d2fe"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* vertical crease */}
      <path d="M24 26v14" stroke={color} strokeWidth="2" opacity="0.5" />
    </svg>
  );
}