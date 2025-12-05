"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Send, Zap } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { type ChatMessage, getModels, streamCompare } from "@/lib/api";

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
  const abortControllerRef = useRef<AbortController | null>(null);

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

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">Сравнение LLM</h1>
        <p className="text-muted-foreground">
          Выберите модели и сравните их ответы на один и тот же промпт
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar with settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Модели</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {modelsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                models?.map((model) => (
                  <div className="flex items-center space-x-2" key={model.name}>
                    <Checkbox
                      checked={selectedModels.includes(model.name)}
                      id={model.name}
                      onCheckedChange={() => toggleModel(model.name)}
                    />
                    <Label
                      className="cursor-pointer font-normal text-sm"
                      htmlFor={model.name}
                    >
                      {model.name}
                    </Label>
                  </div>
                ))
              )}
              {!modelsLoading && (!models || models.length === 0) && (
                <p className="text-muted-foreground text-sm">
                  Нет доступных моделей. Проверьте подключение к LLM сервису.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">Настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  Temperature: {temperature.toFixed(2)}
                </Label>
                <Slider
                  max={2}
                  min={0}
                  onValueChange={([v]) => setTemperature(v)}
                  step={0.1}
                  value={[temperature]}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-medium text-sm">
                Системный промпт
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[100px] text-sm"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Системные инструкции для модели..."
                value={systemPrompt}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Textarea
                  className="min-h-[80px]"
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleGenerate();
                    }
                  }}
                  placeholder="Введите ваш запрос..."
                  value={prompt}
                />
                <Button
                  className="h-auto min-h-[80px] w-12"
                  disabled={
                    isGenerating ||
                    selectedModels.length === 0 ||
                    !prompt.trim()
                  }
                  onClick={handleGenerate}
                  size="icon"
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                Выбрано моделей: {selectedModels.length} • Ctrl/Cmd + Enter для
                отправки
              </p>
            </CardContent>
          </Card>

          {/* Responses grid */}
          {Object.keys(responses).length > 0 && (
            <div
              className={`grid gap-4 ${
                selectedModels.length === 1
                  ? "grid-cols-1"
                  : selectedModels.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {selectedModels.map((model) => (
                <Card className="flex flex-col" key={model}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate font-medium text-sm">
                        {model}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {responses[model]?.done ? (
                          <>
                            {responses[model]?.duration && (
                              <Badge className="text-xs" variant="secondary">
                                <Clock className="mr-1 h-3 w-3" />
                                {formatDuration(responses[model].duration!)}
                              </Badge>
                            )}
                            {responses[model]?.tokens && (
                              <Badge className="text-xs" variant="outline">
                                <Zap className="mr-1 h-3 w-3" />
                                {responses[model].tokens} tok
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge className="text-xs" variant="secondary">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Генерация...
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {responses[model]?.content || (
                          <span className="text-muted-foreground">
                            Ожидание ответа...
                          </span>
                        )}
                        {!responses[model]?.done && (
                          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground/50" />
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
