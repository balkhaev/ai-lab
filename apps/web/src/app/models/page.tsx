"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Box,
  Check,
  Clock,
  Cpu,
  Database,
  Download,
  FileBox,
  HardDrive,
  ImageIcon,
  Loader2,
  MemoryStick,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  Video,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardGlass,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CachedModel,
  deleteCachedModel,
  downloadModelToCache,
  getCachedModels,
  getModelsList,
  loadModel,
  type ModelInfo,
  type ModelStatus,
  type ModelType,
  unloadModel,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const MODEL_TYPE_CONFIG = {
  llm: {
    label: "LLM",
    icon: Cpu,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  image: {
    label: "Image",
    icon: ImageIcon,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  image2image: {
    label: "Img2Img",
    icon: ImageIcon,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
  },
  video: {
    label: "Video",
    icon: Video,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
} as const;

const STATUS_CONFIG: Record<
  ModelStatus,
  { label: string; color: string; bgColor: string }
> = {
  not_loaded: {
    label: "Не загружена",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  loading: {
    label: "Загрузка...",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  loaded: {
    label: "Загружена",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  unloading: {
    label: "Выгрузка...",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  error: {
    label: "Ошибка",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
};

const PRESET_MODELS = [
  // LLM Models
  {
    id: "NousResearch/Hermes-3-Llama-3.2-3B",
    type: "llm" as ModelType,
    name: "Hermes-3-Llama-3.2-3B",
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    type: "llm" as ModelType,
    name: "Qwen2.5-7B-Instruct",
  },
  {
    id: "meta-llama/Llama-3.2-3B-Instruct",
    type: "llm" as ModelType,
    name: "Llama-3.2-3B-Instruct",
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    type: "llm" as ModelType,
    name: "Mistral-7B-Instruct",
  },
  // Image Models
  {
    id: "Tongyi-MAI/Z-Image-Turbo",
    type: "image" as ModelType,
    name: "Z-Image-Turbo",
  },
  {
    id: "stabilityai/stable-diffusion-xl-base-1.0",
    type: "image" as ModelType,
    name: "SDXL Base",
  },
  // Image2Image Models
  {
    id: "Heartsync/NSFW-Uncensored",
    type: "image2image" as ModelType,
    name: "NSFW-Uncensored",
  },
  {
    id: "stabilityai/stable-diffusion-xl-base-1.0",
    type: "image2image" as ModelType,
    name: "SDXL Img2Img",
  },
  // Video Models
  {
    id: "Phr00t/WAN2.2-14B-Rapid-AllInOne",
    type: "video" as ModelType,
    name: "WAN Rapid (8GB VRAM)",
    description: "FP8, 4 steps, fastest",
  },
  {
    id: "Lightricks/LTX-Video",
    type: "video" as ModelType,
    name: "LTX-Video",
    description: "Fast, 30fps",
  },
  {
    id: "THUDM/CogVideoX-5b-I2V",
    type: "video" as ModelType,
    name: "CogVideoX-5B",
    description: "Good quality I2V",
  },
  {
    id: "Wan-AI/Wan2.2-I2V-14B-480P-Diffusers",
    type: "video" as ModelType,
    name: "Wan2.2 I2V",
    description: "High quality, 24fps",
  },
];

function formatBytes(mb: number | null): string {
  if (mb === null) {
    return "N/A";
  }
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

function formatBytesFromBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) {
    return "N/A";
  }
  return new Date(isoString).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) {
    return "N/A";
  }
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) {
    return "только что";
  }
  if (diffMins < 60) {
    return `${diffMins} мин. назад`;
  }
  if (diffHours < 24) {
    return `${diffHours} ч. назад`;
  }
  if (diffDays < 30) {
    return `${diffDays} дн. назад`;
  }
  return formatDate(isoString);
}

function ModelCard({
  model,
  onUnload,
  isUnloading,
}: {
  model: ModelInfo;
  onUnload: () => void;
  isUnloading: boolean;
}) {
  const typeConfig = MODEL_TYPE_CONFIG[model.model_type];
  const statusConfig = STATUS_CONFIG[model.status];
  const TypeIcon = typeConfig.icon;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        model.status === "loaded" &&
          "border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]",
        model.status === "loading" && "animate-pulse border-yellow-500/30",
        model.status === "error" && "border-red-500/30"
      )}
    >
      {/* Status indicator line */}
      <div
        className={cn(
          "absolute top-0 left-0 h-1 w-full",
          model.status === "loaded" && "bg-green-500",
          model.status === "loading" && "bg-yellow-500",
          model.status === "unloading" && "bg-orange-500",
          model.status === "error" && "bg-red-500"
        )}
      />

      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                typeConfig.bgColor
              )}
            >
              <TypeIcon className={cn("h-5 w-5", typeConfig.color)} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{model.name}</h3>
              <p className="truncate text-muted-foreground text-xs">
                {model.model_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "shrink-0",
                statusConfig.bgColor,
                statusConfig.color
              )}
              variant="outline"
            >
              {(model.status === "loading" || model.status === "unloading") && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {model.status === "loaded" && <Check className="mr-1 h-3 w-3" />}
              {model.status === "error" && (
                <AlertCircle className="mr-1 h-3 w-3" />
              )}
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Model details */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Box className="h-3 w-3" />
            {typeConfig.label}
          </span>
          {model.loaded_at ? (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Загружена: {formatDate(model.loaded_at)}
            </span>
          ) : null}
        </div>

        {/* Error message */}
        {model.error ? (
          <div className="mt-3 rounded-md bg-red-500/10 p-2 text-red-500 text-xs">
            {model.error}
          </div>
        ) : null}

        {/* Actions */}
        {model.status === "loaded" && (
          <div className="mt-4">
            <Button
              className="w-full"
              disabled={isUnloading}
              onClick={onUnload}
              size="sm"
              variant="outline"
            >
              {isUnloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Выгрузка...
                </>
              ) : (
                <>
                  <PowerOff className="mr-2 h-4 w-4" />
                  Выгрузить
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GpuMemoryCard({
  total,
  used,
  free,
}: {
  total: number | null;
  used: number | null;
  free: number | null;
}) {
  const usagePercent = total && used ? Math.round((used / total) * 100) : 0;

  return (
    <CardGlass>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MemoryStick className="h-5 w-5 text-primary" />
          GPU Память
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Использовано</span>
            <span className="font-medium font-mono">
              {formatBytes(used)} / {formatBytes(total)}
            </span>
          </div>
          <Progress className="h-2" value={usagePercent} />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>{usagePercent}% использовано</span>
            <span>{formatBytes(free)} свободно</span>
          </div>
        </div>
      </CardContent>
    </CardGlass>
  );
}

function formatGb(gb: number | null): string {
  if (gb === null) {
    return "N/A";
  }
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(1)} TB`;
  }
  return `${gb.toFixed(1)} GB`;
}

function DiskUsageCard({
  total,
  used,
  free,
}: {
  total: number | null;
  used: number | null;
  free: number | null;
}) {
  const usagePercent = total && used ? Math.round((used / total) * 100) : 0;

  return (
    <CardGlass>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-5 w-5 text-blue-500" />
          Диск (кэш моделей)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Использовано</span>
            <span className="font-medium font-mono">
              {formatGb(used)} / {formatGb(total)}
            </span>
          </div>
          <Progress className="h-2" value={usagePercent} />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>{usagePercent}% использовано</span>
            <span>{formatGb(free)} свободно</span>
          </div>
        </div>
      </CardContent>
    </CardGlass>
  );
}

function CachedModelCard({
  model,
  onDelete,
  onLoadToGpu,
  isDeleting,
  isLoadingToGpu,
}: {
  model: CachedModel;
  onDelete: () => void;
  onLoadToGpu: () => void;
  isDeleting: boolean;
  isLoadingToGpu: boolean;
}) {
  const modelName = model.repo_id.split("/").pop() || model.repo_id;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <FileBox className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{modelName}</h3>
              <p className="truncate text-muted-foreground text-xs">
                {model.repo_id}
              </p>
            </div>
          </div>

          <Badge className="shrink-0 font-mono text-xs" variant="secondary">
            {formatBytesFromBytes(model.size_on_disk)}
          </Badge>
        </div>

        {/* Model details */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {model.nb_files} файлов
          </span>
          {model.last_accessed ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(model.last_accessed)}
            </span>
          ) : null}
          {model.revisions.length > 0 ? (
            <span className="flex items-center gap-1">
              <Box className="h-3 w-3" />
              {model.revisions.length} ревиз.
            </span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            disabled={isLoadingToGpu || isDeleting}
            onClick={onLoadToGpu}
            size="sm"
            variant="outline"
          >
            {isLoadingToGpu ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />В GPU
              </>
            )}
          </Button>
          <Button
            className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            disabled={isDeleting || isLoadingToGpu}
            onClick={onDelete}
            size="sm"
            variant="outline"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ModelsPage() {
  const queryClient = useQueryClient();
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newModelType, setNewModelType] = useState<ModelType>("llm");
  const [unloadingModelId, setUnloadingModelId] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [loadingToGpuModelId, setLoadingToGpuModelId] = useState<string | null>(
    null
  );

  // GPU models query
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["models"],
    queryFn: getModelsList,
    refetchInterval: 5000,
  });

  // Cached models query
  const {
    data: cacheData,
    isLoading: isCacheLoading,
    error: cacheError,
    refetch: refetchCache,
    isRefetching: isCacheRefetching,
  } = useQuery({
    queryKey: ["cachedModels"],
    queryFn: getCachedModels,
    refetchInterval: 30_000, // Less frequent - cache changes less often
  });

  const loadMutation = useMutation({
    mutationFn: loadModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      setLoadDialogOpen(false);
      setNewModelId("");
    },
  });

  const downloadMutation = useMutation({
    mutationFn: downloadModelToCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cachedModels"] });
      setLoadDialogOpen(false);
      setNewModelId("");
    },
  });

  const unloadMutation = useMutation({
    mutationFn: unloadModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      setUnloadingModelId(null);
    },
    onError: () => {
      setUnloadingModelId(null);
    },
  });

  const deleteCacheMutation = useMutation({
    mutationFn: deleteCachedModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cachedModels"] });
      setDeletingModelId(null);
    },
    onError: () => {
      setDeletingModelId(null);
    },
  });

  const handleLoad = () => {
    if (!newModelId.trim()) {
      return;
    }
    loadMutation.mutate({
      model_id: newModelId.trim(),
      model_type: newModelType,
    });
  };

  const handleDownloadOnly = () => {
    if (!newModelId.trim()) {
      return;
    }
    downloadMutation.mutate({
      repo_id: newModelId.trim(),
      model_type: newModelType,
    });
  };

  const handleUnload = (model: ModelInfo) => {
    setUnloadingModelId(model.model_id);
    unloadMutation.mutate({
      model_id: model.model_id,
      model_type: model.model_type,
    });
  };

  const handleDeleteCached = (repoId: string) => {
    setDeletingModelId(repoId);
    deleteCacheMutation.mutate(repoId);
  };

  const handleLoadCachedToGpu = (model: CachedModel) => {
    setLoadingToGpuModelId(model.repo_id);
    // Try to infer model type from repo_id or default to llm
    const modelType = inferModelType(model.repo_id);
    loadMutation.mutate(
      {
        model_id: model.repo_id,
        model_type: modelType,
      },
      {
        onSettled: () => {
          setLoadingToGpuModelId(null);
        },
      }
    );
  };

  const handlePresetSelect = (preset: (typeof PRESET_MODELS)[0]) => {
    setNewModelId(preset.id);
    setNewModelType(preset.type);
  };

  const loadedModels = data?.models.filter((m) => m.status === "loaded") || [];
  const otherModels =
    data?.models.filter(
      (m) => m.status !== "loaded" && m.status !== "not_loaded"
    ) || [];
  const cachedModels = cacheData?.models || [];

  // Helper to infer model type from repo_id
  function inferModelType(repoId: string): ModelType {
    const lowerRepoId = repoId.toLowerCase();
    if (
      lowerRepoId.includes("video") ||
      lowerRepoId.includes("wan") ||
      lowerRepoId.includes("ltx") ||
      lowerRepoId.includes("cog")
    ) {
      return "video";
    }
    if (
      lowerRepoId.includes("sdxl") ||
      lowerRepoId.includes("stable-diffusion") ||
      lowerRepoId.includes("z-image") ||
      lowerRepoId.includes("flux")
    ) {
      return "image";
    }
    return "llm";
  }

  return (
    <div className="container max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-2 font-bold text-2xl tracking-tight">
            <span className="gradient-neon-text">Управление</span> моделями
          </h1>
          <p className="text-muted-foreground">
            Загружайте и выгружайте модели для оптимизации GPU памяти
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isRefetching}
            onClick={() => refetch()}
            size="sm"
            variant="outline"
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isRefetching ? "animate-spin" : "")}
            />
            Обновить
          </Button>
          <Button
            onClick={() => setLoadDialogOpen(true)}
            size="sm"
            variant="neon"
          >
            <Plus className="mr-2 h-4 w-4" />
            Загрузить модель
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <Card className="mb-6 border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-500">Ошибка загрузки</p>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error
                  ? error.message
                  : "Не удалось получить список моделей"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Content */}
      {data ? (
        <div className="space-y-6">
          {/* System Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <GpuMemoryCard
              free={data.gpu_memory_free_mb}
              total={data.gpu_memory_total_mb}
              used={data.gpu_memory_used_mb}
            />
            <DiskUsageCard
              free={data.disk_free_gb}
              total={data.disk_total_gb}
              used={data.disk_used_gb}
            />
          </div>

          {/* Loaded models */}
          {loadedModels.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
                <Power className="h-5 w-5 text-green-500" />
                Активные модели
                <Badge variant="secondary">{loadedModels.length}</Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loadedModels.map((model) => (
                  <ModelCard
                    isUnloading={unloadingModelId === model.model_id}
                    key={model.model_id}
                    model={model}
                    onUnload={() => handleUnload(model)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading/unloading/error models */}
          {otherModels.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />В
                процессе
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherModels.map((model) => (
                  <ModelCard
                    isUnloading={false}
                    key={model.model_id}
                    model={model}
                    onUnload={() => {
                      // noop - модель в процессе загрузки/выгрузки
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state for GPU models */}
          {loadedModels.length === 0 && otherModels.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-secondary p-4">
                  <MemoryStick className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 font-medium">Нет загруженных моделей</h3>
                <p className="mb-4 max-w-sm text-muted-foreground text-sm">
                  Загрузите модель в GPU, чтобы начать генерацию.
                </p>
                <Button onClick={() => setLoadDialogOpen(true)} variant="neon">
                  <Plus className="mr-2 h-4 w-4" />
                  Загрузить модель
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Cached models section */}
          <div className="mt-8 border-t pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-lg">
                <HardDrive className="h-5 w-5 text-blue-500" />
                Модели на диске
                {cachedModels.length > 0 && (
                  <Badge variant="secondary">{cachedModels.length}</Badge>
                )}
                {cacheData && (
                  <span className="ml-2 font-mono text-muted-foreground text-sm">
                    ({formatBytesFromBytes(cacheData.total_size_bytes)})
                  </span>
                )}
              </h2>
              <Button
                disabled={isCacheRefetching}
                onClick={() => refetchCache()}
                size="sm"
                variant="ghost"
              >
                <RefreshCw
                  className={cn(
                    "mr-2 h-4 w-4",
                    isCacheRefetching ? "animate-spin" : ""
                  )}
                />
                Обновить
              </Button>
            </div>

            {/* Cache loading state */}
            {isCacheLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {/* Cache error state */}
            {cacheError ? (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500">
                      Ошибка загрузки кэша
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {cacheError instanceof Error
                        ? cacheError.message
                        : "Не удалось получить список кэшированных моделей"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Cached models grid */}
            {cacheData && cachedModels.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cachedModels.map((model) => (
                  <CachedModelCard
                    isDeleting={deletingModelId === model.repo_id}
                    isLoadingToGpu={loadingToGpuModelId === model.repo_id}
                    key={model.repo_id}
                    model={model}
                    onDelete={() => handleDeleteCached(model.repo_id)}
                    onLoadToGpu={() => handleLoadCachedToGpu(model)}
                  />
                ))}
              </div>
            ) : null}

            {/* Empty cache state */}
            {cacheData && cachedModels.length === 0 && !isCacheLoading && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-secondary p-4">
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 font-medium">Кэш пуст</h3>
                  <p className="mb-4 max-w-sm text-muted-foreground text-sm">
                    Скачайте модели на диск для быстрой последующей загрузки в
                    GPU.
                  </p>
                  <Button
                    onClick={() => setLoadDialogOpen(true)}
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Скачать модель
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {/* Load model dialog */}
      <Dialog onOpenChange={setLoadDialogOpen} open={loadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Загрузить модель</DialogTitle>
            <DialogDescription>
              Введите HuggingFace ID модели или выберите из популярных
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preset models */}
            <div className="space-y-2">
              <Label className="text-sm">Популярные модели</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_MODELS.map((preset) => {
                  const config = MODEL_TYPE_CONFIG[preset.type];
                  const Icon = config.icon;
                  return (
                    <Button
                      className="h-auto px-3 py-1.5"
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      size="sm"
                      variant={newModelId === preset.id ? "default" : "outline"}
                    >
                      <Icon className={cn("mr-1.5 h-3 w-3", config.color)} />
                      {preset.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Model ID input */}
            <div className="space-y-2">
              <Label htmlFor="model-id">HuggingFace Model ID</Label>
              <Input
                id="model-id"
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder="organization/model-name"
                value={newModelId}
              />
            </div>

            {/* Model type */}
            <div className="space-y-2">
              <Label>Тип модели</Label>
              <Select
                onValueChange={(v) => setNewModelType(v as ModelType)}
                value={newModelType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm">
                    <span className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      LLM (языковая модель)
                    </span>
                  </SelectItem>
                  <SelectItem value="image">
                    <span className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-purple-500" />
                      Image (генерация изображений)
                    </span>
                  </SelectItem>
                  <SelectItem value="image2image">
                    <span className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-indigo-500" />
                      Img2Img (трансформация)
                    </span>
                  </SelectItem>
                  <SelectItem value="video">
                    <span className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-pink-500" />
                      Video (генерация видео)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button onClick={() => setLoadDialogOpen(false)} variant="outline">
              Отмена
            </Button>
            <Button
              disabled={
                !newModelId.trim() ||
                downloadMutation.isPending ||
                loadMutation.isPending
              }
              onClick={handleDownloadOnly}
              variant="outline"
            >
              {downloadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Скачивание...
                </>
              ) : (
                <>
                  <HardDrive className="mr-2 h-4 w-4" />
                  Только на диск
                </>
              )}
            </Button>
            <Button
              disabled={
                !newModelId.trim() ||
                loadMutation.isPending ||
                downloadMutation.isPending
              }
              onClick={handleLoad}
              variant="neon"
            >
              {loadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Загрузить в GPU
                </>
              )}
            </Button>
          </DialogFooter>

          {/* Error */}
          {loadMutation.error || downloadMutation.error ? (
            <div className="mt-2 rounded-md bg-red-500/10 p-3 text-red-500 text-sm">
              {(loadMutation.error || downloadMutation.error) instanceof Error
                ? (loadMutation.error || downloadMutation.error)?.message
                : "Ошибка загрузки модели"}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
