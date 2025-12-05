"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Settings2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardGlass } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { generateImage, type ImageGenerationParams } from "@/lib/api";
import { cn } from "@/lib/utils";

type GeneratedImage = {
  image_base64: string;
  seed: number;
  generation_time: number;
  prompt: string;
};

const PRESET_SIZES = [
  { label: "1:1", width: 1024, height: 1024 },
  { label: "16:9", width: 1344, height: 768 },
  { label: "9:16", width: 768, height: 1344 },
  { label: "4:3", width: 1152, height: 896 },
  { label: "3:4", width: 896, height: 1152 },
];

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(4);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );

  const mutation = useMutation({
    mutationFn: async (params: ImageGenerationParams) => {
      const result = await generateImage(params);
      return { ...result, prompt: params.prompt };
    },
    onSuccess: (data) => {
      setGallery((prev) => [data, ...prev]);
    },
  });

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;

    mutation.mutate({
      prompt,
      negative_prompt: negativePrompt || undefined,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidanceScale,
      seed,
    });
  }, [
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    guidanceScale,
    seed,
    mutation,
  ]);

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${image.image_base64}`;
    link.download = `generated-${image.seed}.png`;
    link.click();
  };

  const handleCopySeed = (seedValue: number) => {
    navigator.clipboard.writeText(seedValue.toString());
    setCopiedSeed(seedValue);
    setTimeout(() => setCopiedSeed(null), 2000);
  };

  const selectPresetSize = (preset: (typeof PRESET_SIZES)[0]) => {
    setWidth(preset.width);
    setHeight(preset.height);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 font-bold text-2xl tracking-tight">
            <span className="gradient-neon-text">Генерация</span> изображений
          </h1>
          <p className="text-muted-foreground">
            Создавайте уникальные изображения с помощью Z-Image-Turbo
          </p>
        </div>

        {/* Prompt input card */}
        <CardGlass className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="prompt">
                Промпт
              </Label>
              <Textarea
                className="min-h-[120px] resize-none"
                id="prompt"
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
                placeholder="Опишите изображение, которое хотите создать..."
                value={prompt}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="negative">
                Негативный промпт{" "}
                <span className="font-normal text-muted-foreground">
                  (опционально)
                </span>
              </Label>
              <Textarea
                className="min-h-[60px] resize-none"
                id="negative"
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Чего не должно быть на изображении..."
                value={negativePrompt}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={mutation.isPending || !prompt.trim()}
                onClick={handleGenerate}
                variant="neon"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Сгенерировать
                  </>
                )}
              </Button>
              <Button
                className="lg:hidden"
                onClick={() => setShowSettings(!showSettings)}
                size="icon"
                variant="outline"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              Нажмите{" "}
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                Enter
              </kbd>{" "}
              для генерации
            </p>
          </CardContent>
        </CardGlass>

        {/* Current generation */}
        {mutation.isPending && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square max-h-[400px] w-full">
                <Skeleton className="h-full w-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
                  <div className="mb-4 h-16 w-16 animate-glow-pulse rounded-full border-2 border-primary/50">
                    <Sparkles className="h-full w-full p-4 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Создаём изображение...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">
              Галерея{" "}
              <span className="font-normal text-muted-foreground">
                ({gallery.length})
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {gallery.map((image, index) => (
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,45,117,0.2)]"
                  key={`${image.seed}-${index}`}
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="relative aspect-square">
                    <img
                      alt={image.prompt}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      src={`data:image/png;base64,${image.image_base64}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Скачать
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopySeed(image.seed);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        {copiedSeed === image.seed ? (
                          <Check className="mr-1 h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="mr-1 h-4 w-4" />
                        )}
                        Seed
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="mb-2 line-clamp-2 text-muted-foreground text-sm">
                      {image.prompt}
                    </p>
                    <div className="flex gap-2">
                      <Badge className="text-xs" variant="neon">
                        <Clock className="mr-1 h-3 w-3" />
                        {formatTime(image.generation_time)}
                      </Badge>
                      <Badge className="text-xs" variant="outline">
                        Seed: {image.seed}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!mutation.isPending && gallery.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-medium">Нет изображений</h3>
            <p className="max-w-sm text-muted-foreground text-sm">
              Введите промпт и нажмите кнопку генерации, чтобы создать своё
              первое изображение
            </p>
          </div>
        )}
      </div>

      {/* Settings sidebar */}
      <aside
        className={cn(
          "w-full border-border/50 border-l bg-card/50 backdrop-blur-sm lg:w-[320px]",
          showSettings ? "block" : "hidden lg:block"
        )}
      >
        <div className="sticky top-0 h-full overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <h3 className="font-semibold">Настройки</h3>
            <Button
              onClick={() => setShowSettings(false)}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Size presets */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">Размер</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_SIZES.map((preset) => (
                  <Button
                    key={preset.label}
                    onClick={() => selectPresetSize(preset)}
                    size="sm"
                    variant={
                      width === preset.width && height === preset.height
                        ? "default"
                        : "outline"
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Ширина
                  </Label>
                  <Input
                    max={2048}
                    min={256}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    step={64}
                    type="number"
                    value={width}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Высота
                  </Label>
                  <Input
                    max={2048}
                    min={256}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    step={64}
                    type="number"
                    value={height}
                  />
                </div>
              </div>
            </div>

            {/* Steps slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Steps</Label>
                <span className="font-mono text-primary text-sm">{steps}</span>
              </div>
              <Slider
                max={50}
                min={1}
                onValueChange={([v]) => setSteps(v)}
                step={1}
                value={[steps]}
              />
              <p className="text-muted-foreground text-xs">
                Больше шагов = выше качество, дольше генерация
              </p>
            </div>

            {/* Guidance scale slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Guidance Scale</Label>
                <span className="font-mono text-primary text-sm">
                  {guidanceScale.toFixed(1)}
                </span>
              </div>
              <Slider
                max={20}
                min={1}
                onValueChange={([v]) => setGuidanceScale(v)}
                step={0.5}
                value={[guidanceScale]}
              />
              <p className="text-muted-foreground text-xs">
                Выше = точнее следует промпту
              </p>
            </div>

            {/* Seed input */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">
                Seed{" "}
                <span className="font-normal text-muted-foreground">
                  (опционально)
                </span>
              </Label>
              <Input
                onChange={(e) =>
                  setSeed(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="Случайный"
                type="number"
                value={seed ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                Для воспроизводимых результатов
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Image lightbox */}
      {selectedImage && (
        <button
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-background/90 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
              setSelectedImage(null);
            }
          }}
          type="button"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              alt={selectedImage.prompt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              src={`data:image/png;base64,${selectedImage.image_base64}`}
            />
            <div className="-bottom-16 -translate-x-1/2 absolute left-1/2 flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedImage);
                }}
                variant="secondary"
              >
                <Download className="mr-2 h-4 w-4" />
                Скачать
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopySeed(selectedImage.seed);
                }}
                variant="outline"
              >
                {copiedSeed === selectedImage.seed ? (
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Seed: {selectedImage.seed}
              </Button>
            </div>
            <Button
              className="-top-4 -right-4 absolute"
              onClick={() => setSelectedImage(null)}
              size="icon"
              variant="secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </button>
      )}
    </div>
  );
}
