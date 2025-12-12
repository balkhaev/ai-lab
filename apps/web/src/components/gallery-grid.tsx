"use client";

import { Check, Clock, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BaseGalleryItem = {
  id: string;
  prompt?: string;
  generation_time?: number;
  seed?: number;
};

type ImageGalleryItem = BaseGalleryItem & {
  type: "image";
  image_base64: string;
  mode?: "text2image" | "image2image";
};

type VideoGalleryItem = BaseGalleryItem & {
  type: "video";
  video_base64: string;
  imagePreview?: string;
  model?: string;
};

type ThreeDGalleryItem = BaseGalleryItem & {
  type: "3d";
  imagePreview: string;
  outputs: {
    point_cloud?: boolean;
    depth_map?: boolean;
    normal_map?: boolean;
    gaussians?: boolean;
  };
  point_cloud_ply_base64?: string;
};

export type GalleryItem =
  | ImageGalleryItem
  | VideoGalleryItem
  | ThreeDGalleryItem;

type GalleryGridProps = {
  /** Array of gallery items */
  items: GalleryItem[];
  /** Title for the gallery section */
  title?: string;
  /** Number of columns (responsive by default) */
  columns?: 1 | 2 | 3;
  /** Called when an image item is clicked */
  onImageClick?: (item: ImageGalleryItem) => void;
  /** Custom render for badges */
  renderBadges?: (item: GalleryItem) => React.ReactNode;
  /** Additional class name */
  className?: string;
};

function formatTime(seconds: number) {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  return `${seconds.toFixed(2)}s`;
}

function ImageCard({
  item,
  onClick,
  copiedSeed,
  onCopySeed,
  onDownload,
}: {
  item: ImageGalleryItem;
  onClick?: () => void;
  copiedSeed: number | null;
  onCopySeed: (seed: number) => void;
  onDownload: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,45,117,0.2)]"
      onClick={onClick}
    >
      <div className="relative aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={item.prompt || "Generated image"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          height={512}
          src={`data:image/png;base64,${item.image_base64}`}
          width={512}
        />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            size="sm"
            variant="secondary"
          >
            <Download className="mr-1 h-4 w-4" />
            Скачать
          </Button>
          {item.seed !== undefined && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onCopySeed(item.seed as number);
              }}
              size="sm"
              variant="secondary"
            >
              {copiedSeed === item.seed ? (
                <Check className="mr-1 h-4 w-4 text-green-500" />
              ) : (
                <Copy className="mr-1 h-4 w-4" />
              )}
              Seed
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-3">
        {item.prompt ? (
          <p className="mb-2 line-clamp-2 text-muted-foreground text-sm">
            {item.prompt}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {item.generation_time !== undefined ? (
            <Badge className="text-xs" variant="neon">
              <Clock className="mr-1 h-3 w-3" />
              {formatTime(item.generation_time)}
            </Badge>
          ) : null}
          {item.seed !== undefined ? (
            <Badge className="text-xs" variant="outline">
              Seed: {item.seed}
            </Badge>
          ) : null}
          {item.mode ? (
            <Badge
              className="text-xs"
              variant={item.mode === "text2image" ? "default" : "secondary"}
            >
              {item.mode === "text2image" ? "T2I" : "I2I"}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoCard({
  item,
  onDownload,
}: {
  item: VideoGalleryItem;
  onDownload: () => void;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
      <div className="relative">
        <video
          className="aspect-video w-full object-cover"
          controls
          loop
          src={`data:video/mp4;base64,${item.video_base64}`}
        >
          <track kind="captions" />
        </video>
        <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Button
            className="shadow-lg"
            onClick={onDownload}
            size="sm"
            variant="secondary"
          >
            <Download className="mr-1 h-4 w-4" />
            Скачать
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {item.imagePreview ? (
          <div className="mb-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Source"
              className="h-12 w-12 rounded-lg object-cover shadow-sm"
              height={48}
              src={item.imagePreview}
              width={48}
            />
            {item.prompt ? (
              <p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
                {item.prompt}
              </p>
            ) : null}
          </div>
        ) : null}
        {item.model ? (
          <Badge className="text-xs" variant="purple">
            {item.model}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ThreeDCard({
  item,
  onDownloadPLY,
}: {
  item: ThreeDGalleryItem;
  onDownloadPLY: () => void;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
      <CardContent className="p-4">
        <div className="mb-4 flex gap-4">
          {/* Original image */}
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Source"
              className="h-24 w-24 rounded-lg object-cover shadow-sm"
              height={96}
              src={item.imagePreview}
              width={96}
            />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              {item.outputs.point_cloud ? (
                <Badge className="text-xs" variant="neon">
                  Point Cloud
                </Badge>
              ) : null}
              {item.outputs.depth_map ? (
                <Badge className="text-xs" variant="outline">
                  Depth Map
                </Badge>
              ) : null}
              {item.outputs.normal_map ? (
                <Badge className="text-xs" variant="outline">
                  Normal Map
                </Badge>
              ) : null}
              {item.outputs.gaussians ? (
                <Badge className="text-xs" variant="purple">
                  3D Gaussians
                </Badge>
              ) : null}
            </div>

            {item.generation_time !== undefined ? (
              <p className="text-muted-foreground text-xs">
                Время генерации: {item.generation_time.toFixed(1)}с
              </p>
            ) : null}
          </div>
        </div>

        {/* Download buttons */}
        {item.point_cloud_ply_base64 ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onDownloadPLY} size="sm" variant="secondary">
              <Download className="mr-1 h-4 w-4" />
              Скачать PLY
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Unified gallery grid component for displaying generated content.
 */
export function GalleryGrid({
  items,
  title = "Галерея",
  columns = 3,
  onImageClick,
  className,
}: GalleryGridProps) {
  const [copiedSeed, setCopiedSeed] = useState<number | null>(null);

  const handleCopySeed = (seed: number) => {
    navigator.clipboard.writeText(seed.toString());
    setCopiedSeed(seed);
    setTimeout(() => setCopiedSeed(null), 2000);
  };

  const handleDownloadImage = (item: ImageGalleryItem) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${item.image_base64}`;
    link.download = `generated-${item.seed || Date.now()}.png`;
    link.click();
  };

  const handleDownloadVideo = (item: VideoGalleryItem) => {
    const link = document.createElement("a");
    link.href = `data:video/mp4;base64,${item.video_base64}`;
    link.download = "generated-video.mp4";
    link.click();
  };

  const handleDownloadPLY = (item: ThreeDGalleryItem) => {
    if (!item.point_cloud_ply_base64) {
      return;
    }
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${item.point_cloud_ply_base64}`;
    link.download = "point_cloud.ply";
    link.click();
  };

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="font-semibold text-lg">
        {title}{" "}
        <span className="font-normal text-muted-foreground">
          ({items.length})
        </span>
      </h2>
      <div className={cn("grid gap-4", gridCols[columns])}>
        {items.map((item) => {
          if (item.type === "image") {
            return (
              <ImageCard
                copiedSeed={copiedSeed}
                item={item}
                key={item.id}
                onClick={() => onImageClick?.(item)}
                onCopySeed={handleCopySeed}
                onDownload={() => handleDownloadImage(item)}
              />
            );
          }
          if (item.type === "video") {
            return (
              <VideoCard
                item={item}
                key={item.id}
                onDownload={() => handleDownloadVideo(item)}
              />
            );
          }
          if (item.type === "3d") {
            return (
              <ThreeDCard
                item={item}
                key={item.id}
                onDownloadPLY={() => handleDownloadPLY(item)}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
