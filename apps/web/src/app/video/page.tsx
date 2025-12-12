"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  HardDrive,
  ImageIcon,
  Info,
  Loader2,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GalleryGrid, type GalleryItem } from "@/components/gallery-grid";
import { PageHeader, PageLayout, SettingsSidebar } from "@/components/layout";
import { TipsCard } from "@/components/tips-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardGlass } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TaskProgress } from "@/components/ui/task-progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTask } from "@/hooks/use-task";
import {
  generateVideo,
  getTaskResult,
  getVideoModels,
  type Task,
  type VideoPreset,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type GeneratedVideo = {
  video_base64: string;
  prompt: string;
  imagePreview: string;
  model: string;
};

// Default preset for fallback
const DEFAULT_PRESET: VideoPreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки",
  num_inference_steps: 50,
  guidance_scale: 6.0,
  num_frames: 49,
  fps: 24,
  vram_gb: 24,
  is_rapid: false,
  supports_t2v: true,
  supports_i2v: true,
  min_steps: 10,
  max_steps: 100,
  min_guidance: 1,
  max_guidance: 15,
};

export default function VideoPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [steps, setSteps] = useState(4);
  const [guidanceScale, setGuidanceScale] = useState(1.0);
  const [numFrames, setNumFrames] = useState(49);
  const [seed, setSeed] = useState<number | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [gallery, setGallery] = useState<GeneratedVideo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available video models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["videoModels"],
    queryFn: getVideoModels,
    staleTime: 60_000,
  });

  const models = modelsData?.models ?? [];
  const presets = modelsData?.presets ?? {};

  // Get current preset
  const currentPreset: VideoPreset = selectedModel
    ? (presets[selectedModel] ?? DEFAULT_PRESET)
    : DEFAULT_PRESET;

  // Set initial model when data loads
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      // Prefer WAN Rapid as default, or first available
      const rapidModel = models.find((m) => m.includes("Rapid"));
      setSelectedModel(rapidModel ?? models[0]);
    }
  }, [models, selectedModel]);

  // Update parameters when model changes
  useEffect(() => {
    if (selectedModel && presets[selectedModel]) {
      const preset = presets[selectedModel];
      setSteps(preset.num_inference_steps);
      setGuidanceScale(preset.guidance_scale);
      setNumFrames(preset.num_frames);
    }
  }, [selectedModel, presets]);

  // Use the new task polling hook
  const { task, isCompleted, isFailed } = useTask(currentTaskId, {
    pollInterval: 2000,
  });

  // Handle task completion
  const handleTaskComplete = useCallback(async () => {
    if (!(currentTaskId && imagePreview)) {
      return;
    }

    try {
      const result = await getTaskResult(currentTaskId);
      const videoBase64 = result.result?.video_base64 as string | undefined;

      if (videoBase64) {
        setGallery((prev) => [
          {
            video_base64: videoBase64,
            prompt: currentPrompt,
            imagePreview,
            model: selectedModel ?? "unknown",
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Failed to get task result:", err);
    } finally {
      setCurrentTaskId(null);
      setCurrentPrompt("");
    }
  }, [currentTaskId, imagePreview, currentPrompt, selectedModel]);

  // Auto-fetch result when completed
  if (isCompleted && currentTaskId) {
    handleTaskComplete();
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) {
        throw new Error("No image selected");
      }
      return generateVideo(selectedImage, prompt, {
        num_inference_steps: steps,
        guidance_scale: guidanceScale,
        num_frames: numFrames,
        seed: seed ?? undefined,
        model: selectedModel ?? undefined,
      });
    },
    onSuccess: (data: Task) => {
      setCurrentTaskId(data.id);
      setCurrentPrompt(prompt);
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = useCallback(() => {
    if (!(selectedImage && prompt.trim())) {
      return;
    }
    mutation.mutate();
  }, [selectedImage, prompt, mutation]);

  const isGenerating =
    mutation.isPending || (task && !isFailed && task.status !== "cancelled");

  const handleDismissTask = useCallback(() => {
    setCurrentTaskId(null);
    setCurrentPrompt("");
  }, []);

  // Convert gallery to GalleryItem format
  const galleryItems: GalleryItem[] = gallery.map((video, index) => ({
    id: `video-${index}-${video.prompt.slice(0, 20)}`,
    type: "video" as const,
    video_base64: video.video_base64,
    prompt: video.prompt,
    imagePreview: video.imagePreview,
    model: presets[video.model]?.name ?? video.model.split("/").pop(),
  }));

  const modelSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="gap-1"
          disabled={modelsLoading}
          size="sm"
          variant="outline"
        >
          {Boolean(modelsLoading) && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {!modelsLoading && currentPreset.is_rapid && (
            <Zap className="h-3 w-3 text-primary" />
          )}
          {!(modelsLoading || currentPreset.is_rapid) && (
            <Video className="h-3 w-3" />
          )}
          {currentPreset.name}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {models.map((modelId) => {
          const preset = presets[modelId];
          return (
            <DropdownMenuItem
              className="flex flex-col items-start gap-1 py-2"
              key={modelId}
              onClick={() => setSelectedModel(modelId)}
            >
              <div className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  {preset?.is_rapid ? (
                    <Zap className="h-3 w-3 text-primary" />
                  ) : null}
                  {preset?.name ?? modelId.split("/").pop()}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <HardDrive className="h-3 w-3" />
                  {preset?.vram_gb ?? "?"}GB
                </span>
              </div>
              <span className="line-clamp-2 text-muted-foreground text-xs">
                {preset?.description ?? modelId}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sidebarContent = (
    <div className="space-y-6">
      {/* Model info */}
      {currentPreset.is_rapid ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-1 text-xs">
                <p className="font-medium text-primary">Rapid Mode</p>
                <p className="text-muted-foreground">
                  Автоматически применяются оптимальные параметры:{" "}
                  {currentPreset.num_inference_steps} шагов, CFG{" "}
                  {currentPreset.guidance_scale}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="space-y-1 text-xs">
                <p className="font-medium">{currentPreset.name}</p>
                <p className="text-muted-foreground">
                  {currentPreset.description}
                </p>
                <p className="text-muted-foreground">
                  Требует ~{currentPreset.vram_gb}GB VRAM
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 font-medium text-sm">
            Steps
            {currentPreset.is_rapid ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Для Rapid модели рекомендуется{" "}
                    {currentPreset.num_inference_steps} шагов
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </Label>
          <span className="font-mono text-primary text-sm">{steps}</span>
        </div>
        <Slider
          max={currentPreset.max_steps}
          min={currentPreset.min_steps}
          onValueChange={([v]) => setSteps(v)}
          step={1}
          value={[steps]}
        />
        <p className="text-muted-foreground text-xs">
          {currentPreset.is_rapid
            ? `Rapid: ${currentPreset.num_inference_steps} шагов оптимально`
            : "Больше = выше качество, дольше генерация"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 font-medium text-sm">
            Guidance Scale (CFG)
            {currentPreset.is_rapid ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Для Rapid модели рекомендуется CFG{" "}
                    {currentPreset.guidance_scale}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </Label>
          <span className="font-mono text-primary text-sm">
            {guidanceScale.toFixed(1)}
          </span>
        </div>
        <Slider
          max={currentPreset.max_guidance}
          min={currentPreset.min_guidance}
          onValueChange={([v]) => setGuidanceScale(v)}
          step={0.5}
          value={[guidanceScale]}
        />
        <p className="text-muted-foreground text-xs">
          {currentPreset.is_rapid
            ? `Rapid: CFG ${currentPreset.guidance_scale} оптимально`
            : "Влияние промпта на генерацию"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-sm">Кадров</Label>
          <span className="font-mono text-primary text-sm">{numFrames}</span>
        </div>
        <Slider
          max={97}
          min={17}
          onValueChange={([v]) => setNumFrames(v)}
          step={8}
          value={[numFrames]}
        />
        <p className="text-muted-foreground text-xs">
          При {currentPreset.fps} FPS: ~
          {(numFrames / currentPreset.fps).toFixed(1)} сек видео
        </p>
      </div>

      <div className="space-y-3">
        <Label className="font-medium text-sm">
          Seed{" "}
          <span className="font-normal text-muted-foreground">
            (опционально)
          </span>
        </Label>
        <Input
          onChange={(e) => {
            const val = e.target.value;
            setSeed(val ? Number(val) : null);
          }}
          placeholder="Случайный"
          type="number"
          value={seed ?? ""}
        />
      </div>

      {/* Tips card */}
      <TipsCard title={`Советы для ${currentPreset.name}`}>
        <p>• Используйте чёткие изображения без шума</p>
        <p>
          • Описывайте плавные движения: &quot;камера приближается&quot;,
          &quot;волосы развеваются&quot;
        </p>
        <p>• Избегайте резких изменений сцены</p>
        <p>• Оптимальный размер: 832x480 (16:9) или 480x832 (9:16)</p>
        {currentPreset.is_rapid ? (
          <p className="text-primary">• Rapid: генерация за ~30 сек на 4090</p>
        ) : null}
        {currentPreset.supports_i2v ? null : (
          <p className="text-yellow-500">
            • Эта модель только для text-to-video
          </p>
        )}
      </TipsCard>
    </div>
  );

  return (
    <PageLayout
      sidebar={
        <SettingsSidebar
          onOpenChange={setShowSettings}
          open={showSettings}
          title="Параметры видео"
        >
          {sidebarContent}
        </SettingsSidebar>
      }
    >
      {/* Header */}
      <PageHeader
        description={`Оживите изображения с помощью image-to-video генерации (${currentPreset.fps} FPS)`}
        highlight="Генерация"
        onSettingsToggle={() => setShowSettings(true)}
        showSettingsToggle
        title="Генерация видео"
        titleExtra={modelSelector}
      />

      {/* Upload and prompt card */}
      <CardGlass className="mb-6">
        <CardContent className="space-y-4 pt-6">
          {/* Image upload area */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">Исходное изображение</Label>
            <button
              aria-label="Область загрузки изображения"
              className={cn(
                "relative w-full rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300",
                Boolean(isDragOver) &&
                  "border-primary bg-primary/5 shadow-[0_0_30px_rgba(255,45,117,0.2)]",
                !isDragOver &&
                  Boolean(imagePreview) &&
                  "border-primary/50 bg-primary/5",
                !(isDragOver || imagePreview) &&
                  "border-border hover:border-primary/30 hover:bg-secondary/30"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              type="button"
            >
              {imagePreview ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Preview"
                    className="mx-auto max-h-64 rounded-lg shadow-lg"
                    height={256}
                    src={imagePreview}
                    width={256}
                  />
                  <Button
                    className="-top-2 -right-2 absolute h-8 w-8 shadow-lg"
                    onClick={clearImage}
                    size="icon"
                    variant="destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="mb-3 text-muted-foreground">
                    Перетащите изображение сюда или
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Выбрать файл
                  </Button>
                </div>
              )}
              <input
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
                ref={fileInputRef}
                type="file"
              />
            </button>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="prompt">
              Описание движения
            </Label>
            <Textarea
              className="min-h-[80px] resize-none"
              id="prompt"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
              placeholder="Опишите, как должно двигаться изображение..."
              value={prompt}
            />
          </div>

          <Button
            className="w-full"
            disabled={isGenerating || !selectedImage || !prompt.trim()}
            onClick={handleGenerate}
            variant="neon"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Генерация видео...
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                Создать видео
              </>
            )}
          </Button>
        </CardContent>
      </CardGlass>

      {/* Current task status */}
      {Boolean(task || mutation.isPending) && (
        <Card className="mb-6 overflow-hidden">
          <CardContent className="pt-6">
            <TaskProgress
              isCreating={mutation.isPending}
              messages={{
                creating: "Создание задачи...",
                pending: "В очереди...",
                processing: "Генерация видео...",
                completed: "Видео готово!",
                failed: "Ошибка генерации",
              }}
              // biome-ignore lint/nursery/noLeakedRender: prop value, not rendered content
              onCancel={isFailed ? handleDismissTask : undefined}
              onRetry={() => mutation.mutate()}
              task={task}
            />
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      <GalleryGrid columns={2} items={galleryItems} title="Созданные видео" />

      {/* Empty state */}
      {!(isGenerating || task) && gallery.length === 0 && (
        <EmptyState
          description="Загрузите изображение и опишите движение, чтобы создать своё первое видео"
          icon={Video}
          title="Нет видео"
        />
      )}
    </PageLayout>
  );
}
