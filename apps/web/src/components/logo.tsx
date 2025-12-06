"use client";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  animated?: boolean;
};

const sizeMap = {
  sm: { icon: 24, text: "text-lg" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 48, text: "text-2xl" },
  xl: { icon: 64, text: "text-3xl" },
};

export function Logo({
  className,
  size = "md",
  showText = true,
  animated = true,
}: LogoProps) {
  const { icon, text } = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative", animated ? "animate-float" : "")}>
        {/* Glow effect layer */}
        <div
          className="absolute inset-0 opacity-60 blur-lg"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.7 0.25 350), oklch(0.65 0.25 300))",
          }}
        />

        {/* Main logo SVG */}
        <svg
          aria-label="AI Lab Logo"
          className="relative"
          fill="none"
          height={icon}
          role="img"
          viewBox="0 0 48 48"
          width={icon}
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>AI Lab Logo</title>
          <defs>
            {/* Neon gradient */}
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id="neon-gradient"
              x1="0"
              x2="48"
              y1="0"
              y2="48"
            >
              <stop offset="0%" stopColor="oklch(0.7 0.25 350)" />
              <stop offset="50%" stopColor="oklch(0.65 0.25 300)" />
              <stop offset="100%" stopColor="oklch(0.75 0.15 195)" />
            </linearGradient>

            {/* Glow filter */}
            <filter
              filterUnits="userSpaceOnUse"
              height="200%"
              id="glow"
              width="200%"
              x="-50%"
              y="-50%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="2"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Hexagon shape */}
          <path
            d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
            fill="oklch(0.12 0.02 280)"
            filter="url(#glow)"
            stroke="url(#neon-gradient)"
            strokeWidth="2"
          />

          {/* Inner geometric pattern - AI symbol */}
          <path
            d="M24 12L32 18V30L24 36L16 30V18L24 12Z"
            fill="none"
            stroke="url(#neon-gradient)"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />

          {/* Center dot / node */}
          <circle
            cx="24"
            cy="24"
            fill="url(#neon-gradient)"
            filter="url(#glow)"
            r="4"
          />

          {/* Connection lines */}
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="24"
            x2="24"
            y1="12"
            y2="20"
          />
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="24"
            x2="24"
            y1="28"
            y2="36"
          />
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="16"
            x2="20"
            y1="18"
            y2="22"
          />
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="32"
            x2="28"
            y1="18"
            y2="22"
          />
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="16"
            x2="20"
            y1="30"
            y2="26"
          />
          <line
            stroke="url(#neon-gradient)"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1="32"
            x2="28"
            y1="30"
            y2="26"
          />
        </svg>
      </div>

      {showText ? (
        <span
          className={cn(
            "gradient-neon-text font-bold tracking-tight",
            text,
            animated ? "animate-neon-flicker" : ""
          )}
        >
          ai-lab
        </span>
      ) : null}
    </div>
  );
}

export function LogoIcon({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      aria-label="AI Lab Logo"
      className={className}
      fill="none"
      height={size}
      role="img"
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>AI Lab Logo</title>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="neon-gradient-icon"
          x1="0"
          x2="48"
          y1="0"
          y2="48"
        >
          <stop offset="0%" stopColor="oklch(0.7 0.25 350)" />
          <stop offset="50%" stopColor="oklch(0.65 0.25 300)" />
          <stop offset="100%" stopColor="oklch(0.75 0.15 195)" />
        </linearGradient>
        <filter
          filterUnits="userSpaceOnUse"
          height="200%"
          id="glow-icon"
          width="200%"
          x="-50%"
          y="-50%"
        >
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="1.5" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
        fill="oklch(0.12 0.02 280)"
        filter="url(#glow-icon)"
        stroke="url(#neon-gradient-icon)"
        strokeWidth="2"
      />
      <path
        d="M24 12L32 18V30L24 36L16 30V18L24 12Z"
        fill="none"
        stroke="url(#neon-gradient-icon)"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <circle
        cx="24"
        cy="24"
        fill="url(#neon-gradient-icon)"
        filter="url(#glow-icon)"
        r="4"
      />
    </svg>
  );
}
