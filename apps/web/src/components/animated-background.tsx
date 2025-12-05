"use client";

import { useEffect, useRef } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
      color: string;

      constructor(canvasWidth: number, canvasHeight: number) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.5 + 0.1;

        const colors = [
          "255, 45, 117", // pink
          "168, 85, 247", // purple
          "6, 182, 212", // cyan
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update(canvasWidth: number, canvasHeight: number) {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > canvasWidth) this.speedX *= -1;
        if (this.y < 0 || this.y > canvasHeight) this.speedY *= -1;
      }

      draw(context: CanvasRenderingContext2D) {
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(${this.color}, ${this.opacity})`;
        context.fill();

        // Glow effect
        context.shadowBlur = 15;
        context.shadowColor = `rgba(${this.color}, ${this.opacity * 0.5})`;
        context.fill();
        context.shadowBlur = 0;
      }
    }

    const init = () => {
      resize();
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 15_000);

      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const connectParticles = () => {
      const maxDistance = 150;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.15;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 45, 117, ${opacity})`;
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

      // Draw gradient background
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
      );
      gradient.addColorStop(0, "rgba(168, 85, 247, 0.03)");
      gradient.addColorStop(0.5, "rgba(255, 45, 117, 0.02)");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      style={{ opacity: 0.6 }}
    />
  );
}

/* Simpler gradient mesh background alternative */
export function GradientMeshBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Primary gradient orb */}
      <div
        className="-left-1/4 -top-1/4 absolute h-[600px] w-[600px] animate-float rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.7 0.25 350) 0%, transparent 70%)",
        }}
      />

      {/* Secondary gradient orb */}
      <div
        className="-right-1/4 absolute top-1/3 h-[500px] w-[500px] animate-float rounded-full opacity-20 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.65 0.25 300) 0%, transparent 70%)",
          animationDelay: "-3s",
        }}
      />

      {/* Tertiary gradient orb */}
      <div
        className="-bottom-1/4 absolute left-1/3 h-[400px] w-[400px] animate-float rounded-full opacity-15 blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.75 0.15 195) 0%, transparent 70%)",
          animationDelay: "-1.5s",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}
