"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Boxes, ImageIcon, Info, Loader2, Upload, X, Zap } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { GalleryGrid, type GalleryItem } from "@/components/gallery-grid";
import { PageHeader, PageLayout, SettingsSidebar } from "@/components/layout";
import { TipsCard } from "@/components/tips-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardGlass,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskProgress } from "@/components/ui/task-progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTask } from "@/hooks/use-task";
import {
  generateImageTo3D,
  getImageTo3DModels,
  getImageTo3DStatus,
  type ImageTo3DResult,
  type Task,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Generated3D = {
  result: ImageTo3DResult;
  imagePreview: string;
};

export default function ImageTo3DPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined
  );
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Generated3D[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available models
  const { data: modelsData } = useQuery({
    queryKey: ["image-to-3d-models"],
    queryFn: getImageTo3DModels,
    staleTime: 60_000,
  });

  // Use the task polling hook
  const { task, isCompleted, isFailed } = useTask(currentTaskId, {
    pollInterval: 3000, // 3D generation is slower
  });

  // Handle task completion
  const handleTaskComplete = useCallback(async () => {
    if (!(currentTaskId && imagePreview)) {
      return;
    }

    try {
      const statusResult = await getImageTo3DStatus(currentTaskId);

      if (statusResult.result) {
        setGallery((prev) => [
          {
            result: statusResult.result as ImageTo3DResult,
            imagePreview,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Failed to get task result:", err);
    } finally {
      setCurrentTaskId(null);
    }
  }, [currentTaskId, imagePreview]);

  // Auto-fetch result when completed
  if (isCompleted && currentTaskId) {
    handleTaskComplete();
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) {
        throw new Error("No image selected");
      }
      return generateImageTo3D({
        image: selectedImage,
        model: selectedModel,
      });
    },
    onSuccess: (data: Task) => {
      setCurrentTaskId(data.id);
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
    if (!selectedImage) {
      return;
    }
    mutation.mutate();
  }, [selectedImage, mutation]);

  const isGenerating =
    mutation.isPending || (task && !isFailed && task.status !== "cancelled");

  const handleDismissTask = useCallback(() => {
    setCurrentTaskId(null);
  }, []);

  const currentPreset = selectedModel
    ? modelsData?.presets?.[selectedModel]
    : modelsData?.presets?.[modelsData?.models?.[0] ?? ""];

  // Convert gallery to GalleryItem format
  const galleryItems: GalleryItem[] = gallery.map((item, index) => ({
    id: `3d-${item.result.generation_time}-${index}`,
    type: "3d" as const,
    imagePreview: item.imagePreview,
    generation_time: item.result.generation_time,
    outputs: {
      point_cloud: Boolean(item.result.point_cloud_ply_base64),
      depth_map: Boolean(item.result.depth_map),
      normal_map: Boolean(item.result.normal_map),
      gaussians: Boolean(item.result.gaussians),
    },
    point_cloud_ply_base64: item.result.point_cloud_ply_base64 ?? undefined,
  }));

  const modelBadge = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="cursor-help gap-1" variant="neon">
            <Zap className="h-3 w-3" />
            HunyuanWorld-Mirror
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="space-y-1 text-xs">
            <p className="font-medium">tencent/HunyuanWorld-Mirror</p>
            <p className="text-muted-foreground">
              Универсальная модель для 3D-реконструкции
            </p>
            <p className="text-muted-foreground">~16GB VRAM</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const sidebarContent = (
    <div className="space-y-6">
      {/* Model selector */}
      {modelsData !== null &&
      modelsData !== undefined &&
      modelsData.models.length > 0 ? (
        <div className="space-y-3">
          <Label className="font-medium text-sm">Модель</Label>
          <Select
            onValueChange={setSelectedModel}
            value={
              selectedModel || modelsData.current_model || modelsData.models[0]
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              {modelsData.models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model.split("/").pop()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Model capabilities */}
      {currentPreset ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Info className="h-4 w-4 text-primary" />
              Возможности модели
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              {currentPreset.outputs.point_cloud ? (
                <Badge className="text-xs" variant="outline">
                  Point Cloud
                </Badge>
              ) : null}
              {currentPreset.outputs.depth_map ? (
                <Badge className="text-xs" variant="outline">
                  Depth Map
                </Badge>
              ) : null}
              {currentPreset.outputs.normal_map ? (
                <Badge className="text-xs" variant="outline">
                  Normal Map
                </Badge>
              ) : null}
              {currentPreset.outputs.gaussians ? (
                <Badge className="text-xs" variant="outline">
                  3D Gaussians
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground">
              VRAM: ~{currentPreset.vram_gb}GB
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Tips card */}
      <TipsCard
        tips={[
          "Используйте чёткие фотографии с хорошим освещением",
          "Объект должен быть хорошо виден на изображении",
          "Лучше всего работает с фотографиями сцен и объектов",
          "PLY файл можно открыть в Blender, MeshLab и других 3D-редакторах",
        ]}
      >
        <p className="text-primary">
          • Генерация занимает 30-60 секунд на мощном GPU
        </p>
      </TipsCard>

      {/* What is generated */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-medium text-sm">
            <Boxes className="h-4 w-4" />
            Что генерируется
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-xs">
          <p>
            <strong className="text-foreground">Point Cloud</strong> — облако
            3D-точек в формате PLY
          </p>
          <p>
            <strong className="text-foreground">Depth Map</strong> — карта
            глубины сцены
          </p>
          <p>
            <strong className="text-foreground">Normal Map</strong> — карта
            нормалей поверхностей
          </p>
          <p>
            <strong className="text-foreground">3D Gaussians</strong> —
            параметры для Gaussian Splatting
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <PageLayout
      sidebar={
        <SettingsSidebar
          onOpenChange={setShowSettings}
          open={showSettings}
          title="Параметры 3D"
        >
          {sidebarContent}
        </SettingsSidebar>
      }
    >
      {/* Header */}
      <PageHeader
        description="Создавайте 3D-представления из обычных фотографий"
        highlight="3D-реконструкция"
        onSettingsToggle={() => setShowSettings(true)}
        showSettingsToggle
        title="3D-реконструкция из изображения"
        titleExtra={modelBadge}
      />

      {/* Upload card */}
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

          <Button
            className="w-full"
            disabled={isGenerating || !selectedImage}
            onClick={handleGenerate}
            variant="neon"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание 3D-модели...
              </>
            ) : (
              <>
                <Boxes className="mr-2 h-4 w-4" />
                Создать 3D
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
                processing: "3D-реконструкция...",
                completed: "3D-модель готова!",
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
      <GalleryGrid
        columns={2}
        items={galleryItems}
        title="Созданные 3D-модели"
      />

      {/* Empty state */}
      {!(isGenerating || task) && gallery.length === 0 && (
        <EmptyState
          description="Загрузите изображение, чтобы создать свою первую 3D-модель"
          icon={Boxes}
          title="Нет 3D-моделей"
        />
      )}
    </PageLayout>
  );
}
