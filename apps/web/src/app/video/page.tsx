"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Download,
  ImageIcon,
  Lightbulb,
  Loader2,
  Play,
  RefreshCw,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  generateVideo,
  getVideoStatus,
  type VideoTaskResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type GeneratedVideo = {
  video_base64: string;
  prompt: string;
  imagePreview: string;
};

export default function VideoPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState(50);
  const [guidanceScale, setGuidanceScale] = useState(6.0);
  const [numFrames, setNumFrames] = useState(49);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [currentTask, setCurrentTask] = useState<VideoTaskResponse | null>(
    null
  );
  const [gallery, setGallery] = useState<GeneratedVideo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    },
    []
  );

  const pollTaskStatus = useCallback(
    async (
      taskId: string,
      originalImagePreview: string,
      originalPrompt: string
    ) => {
      pollingRef.current = setInterval(async () => {
        const status = await getVideoStatus(taskId);
        setCurrentTask(status);

        if (status.status === "completed" && status.video_base64) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setGallery((prev) => [
            {
              video_base64: status.video_base64!,
              prompt: originalPrompt,
              imagePreview: originalImagePreview,
            },
            ...prev,
          ]);
          setCurrentTask(null);
        } else if (status.status === "failed" && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 2000);
    },
    []
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) throw new Error("No image selected");
      return generateVideo(selectedImage, prompt, {
        num_inference_steps: steps,
        guidance_scale: guidanceScale,
        num_frames: numFrames,
        seed,
      });
    },
    onSuccess: (data) => {
      setCurrentTask(data);
      if (imagePreview && data.task_id) {
        pollTaskStatus(data.task_id, imagePreview, prompt);
      }
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
    if (file && file.type.startsWith("image/")) {
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
    if (!(selectedImage && prompt.trim())) return;
    mutation.mutate();
  }, [selectedImage, prompt, mutation]);

  const handleDownload = (video: GeneratedVideo) => {
    const link = document.createElement("a");
    link.href = `data:video/mp4;base64,${video.video_base64}`;
    link.download = "generated-video.mp4";
    link.click();
  };

  const isGenerating =
    mutation.isPending || currentTask?.status === "processing";

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 font-bold text-2xl tracking-tight">
            <span className="gradient-neon-text">Генерация</span> видео
          </h1>
          <p className="text-muted-foreground">
            Оживите изображения с помощью wan2.2-Remix (image-to-video)
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
              <div
                className={cn(
                  "relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300",
                  isDragOver
                    ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(255,45,117,0.2)]"
                    : imagePreview
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-secondary/30"
                )}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      alt="Preview"
                      className="mx-auto max-h-64 rounded-lg shadow-lg"
                      src={imagePreview}
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
              </div>
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
        {currentTask && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-4">
                {currentTask.status === "processing" ? (
                  <>
                    <div className="relative h-16 w-16">
                      <div className="absolute inset-0 animate-glow-pulse rounded-full border-2 border-primary/50" />
                      <Loader2 className="h-16 w-16 animate-spin p-3 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Генерация видео...</p>
                      <p className="text-muted-foreground text-sm">
                        Это может занять несколько минут
                      </p>
                    </div>
                  </>
                ) : currentTask.status === "failed" ? (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                      <X className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-destructive">
                        Ошибка генерации
                      </p>
                      {currentTask.error && (
                        <p className="text-destructive/80 text-sm">
                          {currentTask.error}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="font-medium">В очереди...</p>
                  </>
                )}

                {currentTask.progress != null && (
                  <div className="w-full max-w-xs">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_rgba(255,45,117,0.5)] transition-all duration-500"
                        style={{ width: `${currentTask.progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-muted-foreground text-xs">
                      {currentTask.progress}%
                    </p>
                  </div>
                )}
              </div>
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
              {gallery.map((video, index) => (
                <Card
                  className="group overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                  key={index}
                >
                  <div className="relative">
                    <video
                      className="aspect-video w-full object-cover"
                      controls
                      loop
                      src={`data:video/mp4;base64,${video.video_base64}`}
                    />
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
                      <img
                        alt="Source"
                        className="h-12 w-12 rounded-lg object-cover shadow-sm"
                        src={video.imagePreview}
                      />
                      <p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
                        {video.prompt}
                      </p>
                    </div>
                    <Badge className="text-xs" variant="purple">
                      <Play className="mr-1 h-3 w-3" />
                      wan2.2-Remix
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!(isGenerating || currentTask) && gallery.length === 0 && (
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
            {/* Parameters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Steps</Label>
                <span className="font-mono text-primary text-sm">{steps}</span>
              </div>
              <Slider
                max={100}
                min={10}
                onValueChange={([v]) => setSteps(v)}
                step={5}
                value={[steps]}
              />
              <p className="text-muted-foreground text-xs">
                Больше = выше качество, дольше генерация
              </p>
            </div>

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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Кадров</Label>
                <span className="font-mono text-primary text-sm">
                  {numFrames}
                </span>
              </div>
              <Slider
                max={81}
                min={16}
                onValueChange={([v]) => setNumFrames(v)}
                step={1}
                value={[numFrames]}
              />
              <p className="text-muted-foreground text-xs">
                При 8 FPS: ~{(numFrames / 8).toFixed(1)} сек видео
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
                onChange={(e) =>
                  setSeed(e.target.value ? Number(e.target.value) : undefined)
                }
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
                  Советы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground text-xs">
                <p>• Используйте чёткие изображения без шума</p>
                <p>
                  • Описывайте плавные движения: &quot;камера
                  приближается&quot;, &quot;волосы развеваются&quot;
                </p>
                <p>• Избегайте резких изменений сцены</p>
                <p>• Оптимальный размер: 720x480 или 480x720</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </aside>
    </div>
  );
}
