"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  Settings2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardGlass,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { type ChatMessage, getModels, streamCompare } from "@/lib/api";
import { cn } from "@/lib/utils";

type ModelResponse = {
  content: string;
  done: boolean;
  duration?: number;
  tokens?: number;
};

export default function ComparePage() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant. Be concise and clear."
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ["llm-models"],
    queryFn: getModels,
  });

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };

  const handleGenerate = useCallback(async () => {
    if (selectedModels.length === 0 || !prompt.trim()) return;

    setIsGenerating(true);
    setResponses(
      Object.fromEntries(
        selectedModels.map((m) => [m, { content: "", done: false }])
      )
    );

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    try {
      const stream = streamCompare(selectedModels, messages, {
        temperature,
      });

      for await (const event of stream) {
        if (event.type === "chunk") {
          setResponses((prev) => ({
            ...prev,
            [event.data.model]: {
              ...prev[event.data.model],
              content: prev[event.data.model].content + event.data.content,
              done: event.data.done,
            },
          }));
        } else if (event.type === "model_done") {
          setResponses((prev) => ({
            ...prev,
            [event.data.model]: {
              ...prev[event.data.model],
              done: true,
              duration: event.data.duration,
              tokens: event.data.eval_count,
            },
          }));
        }
      }
    } catch (error) {
      console.error("Compare error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedModels, prompt, systemPrompt, temperature]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getGridCols = () => {
    const count = selectedModels.length;
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 lg:grid-cols-2";
    if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 font-bold text-2xl tracking-tight">
            <span className="gradient-neon-text">Сравнение</span> LLM
          </h1>
          <p className="text-muted-foreground">
            Выберите модели и сравните их ответы на один и тот же промпт
          </p>
        </div>

        {/* Prompt input card */}
        <CardGlass className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-1 space-y-3">
                <Textarea
                  className="min-h-[100px] resize-none"
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleGenerate();
                    }
                  }}
                  placeholder="Введите ваш запрос..."
                  value={prompt}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>Выбрано моделей: {selectedModels.length}</span>
                    <span>•</span>
                    <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                      Ctrl
                    </kbd>
                    <span>+</span>
                    <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                      Enter
                    </kbd>
                  </div>
                  <Button
                    className="lg:hidden"
                    onClick={() => setShowSettings(!showSettings)}
                    size="sm"
                    variant="ghost"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                className="h-auto min-h-[100px] w-14"
                disabled={
                  isGenerating || selectedModels.length === 0 || !prompt.trim()
                }
                onClick={handleGenerate}
                variant="neon"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardContent>
        </CardGlass>

        {/* Responses grid */}
        {Object.keys(responses).length > 0 && (
          <div className={cn("grid gap-4", getGridCols())}>
            {selectedModels.map((model) => (
              <Card
                className={cn(
                  "flex flex-col transition-all duration-300",
                  !responses[model]?.done &&
                    "border-primary/30 shadow-[0_0_20px_rgba(255,45,117,0.1)]"
                )}
                key={model}
              >
                <CardHeader className="border-border/50 border-b pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          responses[model]?.done
                            ? "bg-accent/10"
                            : "animate-pulse bg-primary/10"
                        )}
                      >
                        <Bot
                          className={cn(
                            "h-4 w-4",
                            responses[model]?.done
                              ? "text-accent"
                              : "text-primary"
                          )}
                        />
                      </div>
                      <CardTitle className="truncate font-medium text-sm">
                        {model}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {responses[model]?.done ? (
                        <>
                          {responses[model]?.duration && (
                            <Badge className="text-xs" variant="cyan">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDuration(responses[model].duration!)}
                            </Badge>
                          )}
                          {responses[model]?.tokens && (
                            <Badge className="text-xs" variant="neon">
                              <Zap className="mr-1 h-3 w-3" />
                              {responses[model].tokens}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge
                          className="animate-pulse text-xs"
                          variant="outline"
                        >
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Генерация
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-4">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {responses[model]?.content || (
                        <span className="text-muted-foreground">
                          Ожидание ответа...
                        </span>
                      )}
                      {!responses[model]?.done && responses[model]?.content && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary" />
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {Object.keys(responses).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-medium">Нет ответов</h3>
            <p className="max-w-sm text-muted-foreground text-sm">
              Выберите модели, введите промпт и нажмите кнопку отправки, чтобы
              сравнить ответы
            </p>
          </div>
        )}
      </div>

      {/* Settings sidebar */}
      <aside
        className={cn(
          "w-full border-border/50 border-l bg-card/50 backdrop-blur-sm lg:w-[300px]",
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
            {/* Model selection */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">Модели</Label>
              {modelsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : models && models.length > 0 ? (
                <div className="space-y-2">
                  {models.map((model) => (
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all duration-200",
                        selectedModels.includes(model.name)
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-secondary/30"
                      )}
                      htmlFor={`model-${model.name}`}
                      key={model.name}
                    >
                      <Checkbox
                        checked={selectedModels.includes(model.name)}
                        id={`model-${model.name}`}
                        onCheckedChange={() => toggleModel(model.name)}
                      />
                      <span className="flex-1 truncate text-sm">
                        {model.name}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-border border-dashed p-4 text-center text-muted-foreground text-sm">
                  Нет доступных моделей. Проверьте подключение к LLM сервису.
                </p>
              )}
            </div>

            {/* Temperature slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Temperature</Label>
                <span className="font-mono text-primary text-sm">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                max={2}
                min={0}
                onValueChange={([v]) => setTemperature(v)}
                step={0.1}
                value={[temperature]}
              />
              <p className="text-muted-foreground text-xs">
                Выше = более креативные ответы
              </p>
            </div>

            {/* System prompt */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">Системный промпт</Label>
              <Textarea
                className="min-h-[120px] resize-none text-sm"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Системные инструкции для модели..."
                value={systemPrompt}
              />
            </div>

            {/* Quick actions */}
            {selectedModels.length > 0 && (
              <Button
                className="w-full"
                onClick={() => setSelectedModels([])}
                size="sm"
                variant="outline"
              >
                Снять выбор со всех
              </Button>
            )}

            {models &&
              models.length > 0 &&
              selectedModels.length < models.length && (
                <Button
                  className="w-full"
                  onClick={() => setSelectedModels(models.map((m) => m.name))}
                  size="sm"
                  variant="outline"
                >
                  Выбрать все модели
                </Button>
              )}
          </div>
        </div>
      </aside>
    </div>
  );
}
