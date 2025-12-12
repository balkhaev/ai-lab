"use client";

import { useEffect, useRef } from "react";

/**
 * Liquid Glass Mesh Background
 * Soft, flowing gradients inspired by Apple's Liquid Glass design
 */
export function LiquidGlassBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Primary blue orb - top left */}
      <div
        className="-left-[20%] -top-[10%] absolute h-[800px] w-[800px] animate-float-slow rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.5 0.15 250 / 0.6) 0%, oklch(0.3 0.1 260 / 0.2) 40%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Secondary purple orb - center right */}
      <div
        className="-right-[15%] absolute top-[20%] h-[700px] w-[700px] animate-float rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, oklch(0.45 0.18 280 / 0.5) 0%, oklch(0.25 0.1 270 / 0.15) 45%, transparent 70%)",
          filter: "blur(100px)",
          animationDelay: "-4s",
        }}
      />

      {/* Tertiary cyan accent - bottom */}
      <div
        className="-bottom-[20%] absolute left-[30%] h-[600px] w-[600px] animate-float-slow rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.55 0.12 200 / 0.4) 0%, oklch(0.3 0.08 210 / 0.1) 50%, transparent 70%)",
          filter: "blur(90px)",
          animationDelay: "-2s",
        }}
      />

      {/* Subtle ambient light - center */}
      <div
        className="absolute top-[40%] left-[40%] h-[500px] w-[500px] animate-pulse-glow rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(circle, oklch(0.7 0.1 250 / 0.3) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />

      {/* Noise texture overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, oklch(0.06 0.015 260 / 0.4) 100%)",
        }}
      />
    </div>
  );
}

/**
 * Minimal gradient background for better performance
 */
export function GradientMeshBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Primary gradient orb */}
      <div
        className="-left-1/4 -top-1/4 absolute h-[600px] w-[600px] animate-float rounded-full opacity-25 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.5 0.15 250) 0%, transparent 70%)",
        }}
      />

      {/* Secondary gradient orb */}
      <div
        className="-right-1/4 absolute top-1/3 h-[500px] w-[500px] animate-float rounded-full opacity-20 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.45 0.18 280) 0%, transparent 70%)",
          animationDelay: "-3s",
        }}
      />

      {/* Tertiary gradient orb */}
      <div
        className="-bottom-1/4 absolute left-1/3 h-[400px] w-[400px] animate-float rounded-full opacity-15 blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.12 200) 0%, transparent 70%)",
          animationDelay: "-1.5s",
        }}
      />
    </div>
  );
}

/**
 * Animated particle background (canvas-based)
 * More performance intensive, use sparingly
 */
export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationFrameId: number;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      hue: number;

      constructor(canvasWidth: number, canvasHeight: number) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.speedY = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.3 + 0.1;
        // Blue to purple range
        this.hue = Math.random() * 40 + 230;
      }

      update(canvasWidth: number, canvasHeight: number) {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > canvasWidth) {
          this.speedX *= -1;
        }
        if (this.y < 0 || this.y > canvasHeight) {
          this.speedY *= -1;
        }
      }

      draw(context: CanvasRenderingContext2D) {
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fillStyle = `oklch(0.6 0.15 ${this.hue} / ${this.opacity})`;
        context.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 20_000);

      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const connectParticles = () => {
      const maxDistance = 120;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.08;
            ctx.beginPath();
            ctx.strokeStyle = `oklch(0.5 0.12 250 / ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.update(canvas.width, canvas.height);
        particle.draw(ctx);
      }

      connectParticles();
      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener("resize", init);

    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      className="pointer-events-none fixed inset-0 z-0"
      ref={canvasRef}
      style={{ opacity: 0.5 }}
    />
  );
}
