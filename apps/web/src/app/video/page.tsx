"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Download,
  ImageIcon,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  generateVideo,
  getVideoStatus,
  type VideoTaskResponse,
} from "@/lib/api";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
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
    <div className="container mx-auto max-w-7xl space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">Генерация видео</h1>
        <p className="text-muted-foreground">
          Оживите изображения с помощью wan2.2-Remix (image-to-video)
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main content */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-4">
              {/* Image upload area */}
              <div className="space-y-2">
                <Label>Исходное изображение</Label>
                <div
                  className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                    imagePreview
                      ? "border-primary"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img
                        alt="Preview"
                        className="mx-auto max-h-64 rounded-lg"
                        src={imagePreview}
                      />
                      <Button
                        className="-top-2 -right-2 absolute h-6 w-6"
                        onClick={clearImage}
                        size="icon"
                        variant="destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8">
                      <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                      <p className="mb-2 text-muted-foreground text-sm">
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
                <Label htmlFor="prompt">Описание движения</Label>
                <Textarea
                  className="min-h-[80px]"
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
          </Card>

          {/* Current task status */}
          {currentTask && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      {currentTask.status === "processing" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="font-medium">
                            Генерация видео...
                          </span>
                        </>
                      ) : currentTask.status === "failed" ? (
                        <>
                          <X className="h-4 w-4 text-destructive" />
                          <span className="font-medium text-destructive">
                            Ошибка генерации
                          </span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span className="font-medium">В очереди...</span>
                        </>
                      )}
                    </div>
                    {currentTask.error && (
                      <p className="text-destructive text-sm">
                        {currentTask.error}
                      </p>
                    )}
                    {currentTask.progress != null && (
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${currentTask.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-muted-foreground text-xs">
                  Генерация видео занимает несколько минут. Не закрывайте
                  страницу.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Созданные видео</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {gallery.map((video, index) => (
                  <Card className="overflow-hidden" key={index}>
                    <div className="group relative">
                      <video
                        className="aspect-video w-full object-cover"
                        controls
                        loop
                        src={`data:video/mp4;base64,${video.video_base64}`}
                      />
                      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          onClick={() => handleDownload(video)}
                          size="sm"
                          variant="secondary"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Скачать
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <div className="mb-2 flex gap-3">
                        <img
                          alt="Source"
                          className="h-12 w-12 rounded object-cover"
                          src={video.imagePreview}
                        />
                        <p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
                          {video.prompt}
                        </p>
                      </div>
                      <Badge className="text-xs" variant="secondary">
                        <Play className="mr-1 h-3 w-3" />
                        wan2.2-Remix
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Параметры</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Steps: {steps}</Label>
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Кадров: {numFrames}</Label>
                <Slider
                  max={81}
                  min={16}
                  onValueChange={([v]) => setNumFrames(v)}
                  step={1}
                  value={[numFrames]}
                />
                <p className="text-muted-foreground text-xs">
                  При 8 FPS: {(numFrames / 8).toFixed(1)} сек видео
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Советы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground text-sm">
              <p>• Используйте чёткие изображения без шума</p>
              <p>
                • Описывайте плавные движения: "камера приближается", "волосы
                развеваются"
              </p>
              <p>• Избегайте резких изменений сцены</p>
              <p>• Оптимальный размер: 720x480 или 480x720</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
