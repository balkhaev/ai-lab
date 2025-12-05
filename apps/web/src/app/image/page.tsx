"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Clock,
  Copy,
  Download,
  Loader2,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { generateImage, type ImageGenerationParams } from "@/lib/api";

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
    <div className="container mx-auto max-w-7xl space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">
          Генерация изображений
        </h1>
        <p className="text-muted-foreground">
          Создавайте изображения с помощью Z-Image-Turbo
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main content */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Промпт</Label>
                <Textarea
                  className="min-h-[100px]"
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
                <Label htmlFor="negative">
                  Негативный промпт (опционально)
                </Label>
                <Textarea
                  className="min-h-[60px]"
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
                  onClick={() => setShowSettings(!showSettings)}
                  size="icon"
                  variant="outline"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current generation */}
          {mutation.isPending && (
            <Card>
              <CardContent className="pt-4">
                <div className="mx-auto aspect-square max-w-md">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
                <p className="mt-4 text-center text-muted-foreground text-sm">
                  <Sparkles className="mr-1 inline h-4 w-4" />
                  Создаём изображение...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Галерея</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {gallery.map((image, index) => (
                  <Card
                    className="overflow-hidden"
                    key={`${image.seed}-${index}`}
                  >
                    <div className="group relative">
                      <img
                        alt={image.prompt}
                        className="aspect-square w-full object-cover"
                        src={`data:image/png;base64,${image.image_base64}`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          onClick={() => handleDownload(image)}
                          size="sm"
                          variant="secondary"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Скачать
                        </Button>
                        <Button
                          onClick={() => handleCopySeed(image.seed)}
                          size="sm"
                          variant="secondary"
                        >
                          <Copy className="mr-1 h-4 w-4" />
                          Seed
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="mb-2 line-clamp-2 text-muted-foreground text-sm">
                        {image.prompt}
                      </p>
                      <div className="flex gap-2">
                        <Badge className="text-xs" variant="secondary">
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
        </div>

        {/* Settings sidebar */}
        <div className={`space-y-4 ${showSettings ? "" : "hidden lg:block"}`}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Размер</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label className="text-xs">Ширина</Label>
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
                  <Label className="text-xs">Высота</Label>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Параметры</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Steps: {steps}</Label>
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

              <div className="space-y-2">
                <Label className="text-sm">
                  Guidance Scale: {guidanceScale.toFixed(1)}
                </Label>
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

              <div className="space-y-2">
                <Label className="text-sm">Seed (опционально)</Label>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
