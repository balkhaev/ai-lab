"use client";

import {
  ImageIcon,
  MessageSquare,
  Shield,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { CardGlass } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    href: "/chat",
    icon: MessageSquare,
    title: "AI Чат",
    description:
      "Общайтесь с AI, прикрепляйте изображения. Vision-модели понимают картинки.",
    gradient: "from-primary to-accent",
    glowColor: "rgba(255, 45, 117, 0.3)",
  },
  {
    href: "/image",
    icon: ImageIcon,
    title: "Генерация изображений",
    description:
      "Создавайте уникальные изображения с помощью Z-Image-Turbo. Высокое качество за секунды.",
    gradient: "from-accent to-[oklch(0.75_0.15_195)]",
    glowColor: "rgba(168, 85, 247, 0.3)",
  },
  {
    href: "/video",
    icon: Video,
    title: "Генерация видео",
    description:
      "Оживите изображения с wan2.2-Remix. Превратите статику в динамику.",
    gradient: "from-[oklch(0.75_0.15_195)] to-primary",
    glowColor: "rgba(6, 182, 212, 0.3)",
  },
] as const;

const stats = [
  { label: "Моделей", value: "10+", icon: Sparkles },
  { label: "Скорость", value: "<5s", icon: Zap },
  { label: "Приватность", value: "100%", icon: Shield },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-6 py-16 text-center lg:py-24">
        {/* Glow effect behind logo */}
        <div className="absolute top-1/4 h-[300px] w-[300px] rounded-full bg-primary/20 blur-[100px]" />

        <Logo animated className="mb-8" size="xl" />

        <h1 className="mb-4 max-w-2xl font-bold text-4xl tracking-tight lg:text-5xl">
          <span className="gradient-neon-text">AI-powered</span> платформа
          <br />
          для генерации контента
        </h1>

        <p className="mb-8 max-w-lg text-lg text-muted-foreground">
          Создавайте изображения, видео и текст с помощью передовых нейросетей.
          Всё в одном месте.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="neon">
            <Link href="/chat">
              <MessageSquare className="mr-2 h-5 w-5" />
              Начать чат
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/image">
              <Sparkles className="mr-2 h-5 w-5" />
              Генерация
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 lg:gap-16">
          {stats.map(({ label, value, icon: Icon }) => (
            <div className="flex flex-col items-center" key={label}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-bold text-2xl text-glow-pink">
                  {value}
                </span>
              </div>
              <span className="text-muted-foreground text-sm">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center font-semibold text-2xl">
            Возможности платформы
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map(
              ({
                href,
                icon: Icon,
                title,
                description,
                gradient,
                glowColor,
              }) => (
                <Link className="group" href={href} key={href}>
                  <CardGlass className="h-full transition-transform duration-300 hover:scale-[1.02]">
                    <div className="px-6">
                      {/* Icon with gradient background */}
                      <div
                        className={cn(
                          "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl",
                          "bg-gradient-to-br",
                          gradient,
                          "shadow-lg transition-shadow duration-300"
                        )}
                        style={{
                          boxShadow: `0 0 30px ${glowColor}`,
                        }}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>

                      <h3 className="mb-2 font-semibold text-lg transition-colors group-hover:text-primary">
                        {title}
                      </h3>

                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {description}
                      </p>
                    </div>

                    {/* Bottom accent line */}
                    <div className="mt-auto px-6 pb-6">
                      <div
                        className={cn(
                          "h-0.5 w-0 rounded-full bg-gradient-to-r transition-all duration-500 group-hover:w-full",
                          gradient
                        )}
                      />
                    </div>
                  </CardGlass>
                </Link>
              )
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="border-border/50 border-t bg-card/30 px-6 py-12 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-semibold text-xl">Готовы начать?</h2>
          <p className="mb-6 text-muted-foreground">
            Выберите инструмент и создайте что-то уникальное прямо сейчас
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/chat">
                <MessageSquare className="mr-2 h-4 w-4" />
                Чат
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/image">
                <ImageIcon className="mr-2 h-4 w-4" />
                Изображение
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/video">
                <Video className="mr-2 h-4 w-4" />
                Видео
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
