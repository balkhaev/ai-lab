"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Download,
  ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardGlass,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { generateVideo, getTaskResult, type Task } from "@/lib/api";
import { cn } from "@/lib/utils";

// Current video model configuration
const VIDEO_MODEL = {
  id: "Phr00t/WAN2.2-14B-Rapid-AllInOne",
  name: "WAN Rapid",
  description: "FP8, 4 steps, 8GB VRAM",
  fps: 24,
  isRapid: true,
  // Rapid model uses fixed optimal params: 4 steps, CFG 1
  defaultSteps: 4,
  defaultCfg: 1.0,
};

type GeneratedVideo = {
  video_base64: string;
  prompt: string;
  imagePreview: string;
};

export default function VideoPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  // Use model defaults - Rapid model uses 4 steps, CFG 1 automatically
  const [steps, setSteps] = useState(VIDEO_MODEL.defaultSteps);
  const [guidanceScale, setGuidanceScale] = useState(VIDEO_MODEL.defaultCfg);
  const [numFrames, setNumFrames] = useState(49);
  const [seed, setSeed] = useState<number | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [gallery, setGallery] = useState<GeneratedVideo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [currentTaskId, imagePreview, currentPrompt]);

  // Auto-fetch result when completed
  if (isCompleted && currentTaskId) {
    handleTaskComplete();
  }

  // Clear task on failure after showing error
  if (isFailed && currentTaskId && task?.error) {
    // Keep task visible to show error, user can dismiss
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

  const handleDownload = (video: GeneratedVideo) => {
    const link = document.createElement("a");
    link.href = `data:video/mp4;base64,${video.video_base64}`;
    link.download = "generated-video.mp4";
    link.click();
  };

  const isGenerating =
    mutation.isPending || (task && !isFailed && task.status !== "cancelled");

  const handleDismissTask = useCallback(() => {
    setCurrentTaskId(null);
    setCurrentPrompt("");
  }, []);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="font-bold text-2xl tracking-tight">
              <span className="gradient-neon-text">Генерация</span> видео
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="cursor-help gap-1" variant="neon">
                    <Zap className="h-3 w-3" />
                    {VIDEO_MODEL.name}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="space-y-1 text-xs">
                    <p className="font-medium">{VIDEO_MODEL.id}</p>
                    <p className="text-muted-foreground">
                      {VIDEO_MODEL.description}
                    </p>
                    <p className="text-muted-foreground">
                      Автоматически: {VIDEO_MODEL.defaultSteps} шагов, CFG{" "}
                      {VIDEO_MODEL.defaultCfg}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground">
            Оживите изображения с помощью image-to-video генерации (
            {VIDEO_MODEL.fps} FPS)
          </p>
        </div>

        {/* Upload and prompt card */}
        <CardGlass className="mb-6">
          <CardContent className="space-y-4 pt-6">
            {/* Image upload area */}
            <div className="space-y-2">
              <Label className="font-medium text-sm">
                Исходное изображение
              </Label>
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
                onCancel={isFailed ? handleDismissTask : undefined}
                onRetry={() => mutation.mutate()}
                task={task}
              />
            </CardContent>
          </Card>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">
              Созданные видео{" "}
              <span className="font-normal text-muted-foreground">
                ({gallery.length})
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {gallery.map((video) => (
                <Card
                  className="group overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                  key={`${video.prompt}-${video.video_base64.slice(0, 20)}`}
                >
                  <div className="relative">
                    <video
                      className="aspect-video w-full object-cover"
                      controls
                      loop
                      src={`data:video/mp4;base64,${video.video_base64}`}
                    >
                      <track kind="captions" />
                    </video>
                    <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <Button
                        className="shadow-lg"
                        onClick={() => handleDownload(video)}
                        size="sm"
                        variant="secondary"
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Скачать
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-3 flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="Source"
                        className="h-12 w-12 rounded-lg object-cover shadow-sm"
                        height={48}
                        src={video.imagePreview}
                        width={48}
                      />
                      <p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
                        {video.prompt}
                      </p>
                    </div>
                    <Badge className="text-xs" variant="purple">
                      <Zap className="mr-1 h-3 w-3" />
                      {VIDEO_MODEL.name}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!(isGenerating || task) && gallery.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-medium">Нет видео</h3>
            <p className="max-w-sm text-muted-foreground text-sm">
              Загрузите изображение и опишите движение, чтобы создать своё
              первое видео
            </p>
          </div>
        )}
      </div>

      {/* Settings sidebar */}
      <aside className="hidden w-[320px] border-border/50 border-l bg-card/50 backdrop-blur-sm lg:block">
        <div className="sticky top-0 h-full overflow-auto p-6">
          <div className="space-y-6">
            {/* Model info */}
            {VIDEO_MODEL.isRapid ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-primary">Rapid Mode</p>
                      <p className="text-muted-foreground">
                        Автоматически применяются оптимальные параметры:{" "}
                        {VIDEO_MODEL.defaultSteps} шагов, CFG{" "}
                        {VIDEO_MODEL.defaultCfg}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Parameters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 font-medium text-sm">
                  Steps
                  {VIDEO_MODEL.isRapid ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Для Rapid модели рекомендуется{" "}
                          {VIDEO_MODEL.defaultSteps} шагов
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </Label>
                <span className="font-mono text-primary text-sm">{steps}</span>
              </div>
              <Slider
                max={VIDEO_MODEL.isRapid ? 10 : 100}
                min={VIDEO_MODEL.isRapid ? 1 : 10}
                onValueChange={([v]) => setSteps(v)}
                step={1}
                value={[steps]}
              />
              <p className="text-muted-foreground text-xs">
                {VIDEO_MODEL.isRapid
                  ? "Rapid: 4 шага оптимально"
                  : "Больше = выше качество, дольше генерация"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 font-medium text-sm">
                  Guidance Scale (CFG)
                  {VIDEO_MODEL.isRapid ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Для Rapid модели рекомендуется CFG{" "}
                          {VIDEO_MODEL.defaultCfg}
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
                max={VIDEO_MODEL.isRapid ? 5 : 20}
                min={1}
                onValueChange={([v]) => setGuidanceScale(v)}
                step={0.5}
                value={[guidanceScale]}
              />
              <p className="text-muted-foreground text-xs">
                {VIDEO_MODEL.isRapid
                  ? "Rapid: CFG 1 оптимально"
                  : "Влияние промпта на генерацию"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Кадров</Label>
                <span className="font-mono text-primary text-sm">
                  {numFrames}
                </span>
              </div>
              <Slider
                max={97}
                min={17}
                onValueChange={([v]) => setNumFrames(v)}
                step={8}
                value={[numFrames]}
              />
              <p className="text-muted-foreground text-xs">
                При {VIDEO_MODEL.fps} FPS: ~
                {(numFrames / VIDEO_MODEL.fps).toFixed(1)} сек видео
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
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-medium text-sm">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  Советы для {VIDEO_MODEL.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground text-xs">
                <p>• Используйте чёткие изображения без шума</p>
                <p>
                  • Описывайте плавные движения: &quot;камера
                  приближается&quot;, &quot;волосы развеваются&quot;
                </p>
                <p>• Избегайте резких изменений сцены</p>
                <p>• Оптимальный размер: 832x480 (16:9) или 480x832 (9:16)</p>
                {VIDEO_MODEL.isRapid ? (
                  <p className="text-primary">
                    • Rapid: генерация за ~30 сек на 4090
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </aside>
    </div>
  );
}
