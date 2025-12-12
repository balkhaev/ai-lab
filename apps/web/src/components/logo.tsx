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
        {/* Subtle glow effect layer */}
        <div
          className="absolute inset-0 opacity-40 blur-xl"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.65 0.18 250), oklch(0.6 0.2 280))",
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
            {/* Liquid Glass gradient */}
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id="liquid-gradient"
              x1="0"
              x2="48"
              y1="0"
              y2="48"
            >
              <stop offset="0%" stopColor="oklch(0.7 0.15 250)" />
              <stop offset="50%" stopColor="oklch(0.6 0.18 270)" />
              <stop offset="100%" stopColor="oklch(0.55 0.15 290)" />
            </linearGradient>

            {/* Subtle glow filter */}
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
                stdDeviation="1.5"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glass fill gradient */}
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id="glass-fill"
              x1="6"
              x2="42"
              y1="4"
              y2="44"
            >
              <stop
                offset="0%"
                stopColor="oklch(0.2 0.02 260)"
                stopOpacity="0.8"
              />
              <stop
                offset="100%"
                stopColor="oklch(0.1 0.02 260)"
                stopOpacity="0.6"
              />
            </linearGradient>
          </defs>

          {/* Hexagon shape with glass effect */}
          <path
            d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
            fill="url(#glass-fill)"
            filter="url(#glow)"
            stroke="url(#liquid-gradient)"
            strokeWidth="1.5"
          />

          {/* Inner geometric pattern */}
          <path
            d="M24 12L32 18V30L24 36L16 30V18L24 12Z"
            fill="none"
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.5"
            strokeWidth="1"
          />

          {/* Center dot / node */}
          <circle
            cx="24"
            cy="24"
            fill="url(#liquid-gradient)"
            filter="url(#glow)"
            r="4"
          />

          {/* Connection lines */}
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
            strokeWidth="1"
            x1="24"
            x2="24"
            y1="12"
            y2="20"
          />
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
            strokeWidth="1"
            x1="24"
            x2="24"
            y1="28"
            y2="36"
          />
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
            strokeWidth="1"
            x1="16"
            x2="20"
            y1="18"
            y2="22"
          />
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
            strokeWidth="1"
            x1="32"
            x2="28"
            y1="18"
            y2="22"
          />
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
            strokeWidth="1"
            x1="16"
            x2="20"
            y1="30"
            y2="26"
          />
          <line
            stroke="url(#liquid-gradient)"
            strokeOpacity="0.3"
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
          className={cn("gradient-text font-semibold tracking-tight", text)}
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
          id="liquid-gradient-icon"
          x1="0"
          x2="48"
          y1="0"
          y2="48"
        >
          <stop offset="0%" stopColor="oklch(0.7 0.15 250)" />
          <stop offset="50%" stopColor="oklch(0.6 0.18 270)" />
          <stop offset="100%" stopColor="oklch(0.55 0.15 290)" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="glass-fill-icon"
          x1="6"
          x2="42"
          y1="4"
          y2="44"
        >
          <stop offset="0%" stopColor="oklch(0.2 0.02 260)" stopOpacity="0.8" />
          <stop
            offset="100%"
            stopColor="oklch(0.1 0.02 260)"
            stopOpacity="0.6"
          />
        </linearGradient>
        <filter
          filterUnits="userSpaceOnUse"
          height="200%"
          id="glow-icon"
          width="200%"
          x="-50%"
          y="-50%"
        >
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="1" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
        fill="url(#glass-fill-icon)"
        filter="url(#glow-icon)"
        stroke="url(#liquid-gradient-icon)"
        strokeWidth="1.5"
      />
      <path
        d="M24 12L32 18V30L24 36L16 30V18L24 12Z"
        fill="none"
        stroke="url(#liquid-gradient-icon)"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <circle
        cx="24"
        cy="24"
        fill="url(#liquid-gradient-icon)"
        filter="url(#glow-icon)"
        r="4"
      />
    </svg>
  );
}
