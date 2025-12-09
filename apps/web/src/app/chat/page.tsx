"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Clock,
  ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Settings2,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  type ChatMessage,
  type ContentPart,
  fileToDataUrl,
  getModels,
  loadModel,
  multimodalMessage,
  streamChat,
  streamCompare,
  textMessage,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ModelResponse = {
  content: string;
  done: boolean;
  duration?: number;
  tokens?: number;
};

type MessageWithId = {
  id: string;
  message: ChatMessage;
  isStreaming?: boolean;
  // For compare mode: responses from multiple models
  modelResponses?: Record<string, ModelResponse>;
  // Which models were used for this response
  models?: string[];
};

type AttachedImage = {
  id: string;
  file: File;
  preview: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(
    "Ты полезный AI-ассистент. Отвечай кратко и по существу."
  );
  const [temperature, setTemperature] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    data: models,
    isLoading: modelsLoading,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ["llm-models"],
    queryFn: getModels,
  });

  // Check if compare mode (multiple models selected)
  const isCompareMode = selectedModels.length > 1;

  // Get first selected model's preset for temperature hints
  const currentPreset = useMemo(() => {
    if (!(models && selectedModels.length > 0)) {
      return null;
    }
    const model = models.find((m) => m.name === selectedModels[0]);
    return model?.preset ?? null;
  }, [models, selectedModels]);

  // Set default model when models load (prefer loaded models)
  useEffect(() => {
    if (models && models.length > 0 && selectedModels.length === 0) {
      const loadedModel = models.find((m) => m.loaded);
      setSelectedModels([loadedModel?.name ?? models[0].name]);
    }
  }, [models, selectedModels.length]);

  // Toggle model selection
  const toggleModel = useCallback(
    async (modelName: string) => {
      const model = models?.find((m) => m.name === modelName);

      // If model is not loaded, load it first
      if (model && !model.loaded) {
        setIsLoadingModel(true);
        try {
          const modelId = model.model_id ?? model.preset?.model_id ?? modelName;
          await loadModel({
            model_id: modelId,
            model_type: "llm",
          });
          await refetchModels();
        } catch (error) {
          console.error("Failed to load model:", error);
          setIsLoadingModel(false);
          return;
        }
        setIsLoadingModel(false);
      }

      setSelectedModels((prev) =>
        prev.includes(modelName)
          ? prev.filter((m) => m !== modelName)
          : [...prev, modelName]
      );
    },
    [models, refetchModels]
  );

  // Auto-scroll to bottom when new messages are added
  const messagesLength = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: need to scroll on messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesLength]);

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: need to resize on input change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) {
        return;
      }

      const newImages: AttachedImage[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          const preview = URL.createObjectURL(file);
          newImages.push({
            id: crypto.randomUUID(),
            file,
            preview,
          });
        }
      }

      setAttachedImages((prev) => [...prev, ...newImages]);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const removeImage = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (
      (!input.trim() && attachedImages.length === 0) ||
      selectedModels.length === 0
    ) {
      return;
    }

    setIsGenerating(true);

    // Create user message
    let userMessage: ChatMessage;
    if (attachedImages.length > 0) {
      const imageUrls = await Promise.all(
        attachedImages.map((img) => fileToDataUrl(img.file))
      );
      userMessage = multimodalMessage("user", input.trim(), imageUrls);
    } else {
      userMessage = textMessage("user", input.trim());
    }

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    // Add user message
    setMessages((prev) => [...prev, { id: userMsgId, message: userMessage }]);

    // Clear input and images
    setInput("");
    for (const img of attachedImages) {
      URL.revokeObjectURL(img.preview);
    }
    setAttachedImages([]);

    // Build full message history (only single-model responses for context)
    const chatMessages: ChatMessage[] = [
      textMessage("system", systemPrompt),
      ...messages
        .filter((m) => !m.modelResponses) // Only include single-model messages in history
        .map((m) => m.message),
      userMessage,
    ];

    if (selectedModels.length === 1) {
      // Single model mode - use streamChat
      const modelName = selectedModels[0];

      // Add empty assistant message for streaming
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          message: { role: "assistant", content: "" },
          isStreaming: true,
          models: [modelName],
        },
      ]);

      try {
        const stream = streamChat(modelName, chatMessages, { temperature });

        let fullContent = "";
        for await (const chunk of stream) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, message: { ...m.message, content: fullContent } }
                : m
            )
          );
        }

        // Mark as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  message: {
                    ...m.message,
                    content: "Ошибка при получении ответа. Попробуйте снова.",
                  },
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } else {
      // Compare mode - use streamCompare
      const initialResponses: Record<string, ModelResponse> = {};
      for (const model of selectedModels) {
        initialResponses[model] = { content: "", done: false };
      }

      // Add empty assistant message with model responses
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          message: { role: "assistant", content: "" },
          isStreaming: true,
          modelResponses: initialResponses,
          models: selectedModels,
        },
      ]);

      try {
        const stream = streamCompare(selectedModels, chatMessages, {
          temperature,
        });

        for await (const event of stream) {
          if (event.type === "chunk") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId || !m.modelResponses) {
                  return m;
                }
                return {
                  ...m,
                  modelResponses: {
                    ...m.modelResponses,
                    [event.data.model]: {
                      ...m.modelResponses[event.data.model],
                      content:
                        m.modelResponses[event.data.model].content +
                        event.data.content,
                      done: event.data.done,
                    },
                  },
                };
              })
            );
          } else if (event.type === "model_done") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId || !m.modelResponses) {
                  return m;
                }
                return {
                  ...m,
                  modelResponses: {
                    ...m.modelResponses,
                    [event.data.model]: {
                      ...m.modelResponses[event.data.model],
                      done: true,
                      duration: event.data.duration,
                      tokens: event.data.eval_count,
                    },
                  },
                };
              })
            );
          } else if (event.type === "all_done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
              )
            );
          }
        }

        // Ensure streaming is marked complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (error) {
        console.error("Compare error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
      }
    }

    setIsGenerating(false);
  }, [
    input,
    attachedImages,
    selectedModels,
    systemPrompt,
    temperature,
    messages,
  ]);

  const clearChat = useCallback(() => {
    setMessages([]);
    for (const img of attachedImages) {
      URL.revokeObjectURL(img.preview);
    }
    setAttachedImages([]);
  }, [attachedImages]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getGridCols = (count: number) => {
    if (count <= 1) {
      return "grid-cols-1";
    }
    if (count === 2) {
      return "grid-cols-1 lg:grid-cols-2";
    }
    if (count === 3) {
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    }
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  };

  const renderMessageContent = (content: ChatMessage["content"]) => {
    if (typeof content === "string") {
      return <span className="whitespace-pre-wrap">{content}</span>;
    }

    return (
      <div className="space-y-2">
        {/* Render images first */}
        {content.some((part) => part.type === "image_url") && (
          <div className="flex flex-wrap gap-2">
            {content
              .filter(
                (part): part is ContentPart & { type: "image_url" } =>
                  part.type === "image_url"
              )
              .map((part) => (
                <div
                  className="relative h-32 w-32 overflow-hidden rounded-lg border border-border"
                  key={part.image_url.url.slice(0, 100)}
                >
                  <Image
                    alt="Attached"
                    className="object-cover"
                    fill
                    src={part.image_url.url}
                  />
                </div>
              ))}
          </div>
        )}
        {/* Render text */}
        {content
          .filter(
            (part): part is ContentPart & { type: "text" } =>
              part.type === "text"
          )
          .map((part) => (
            <span className="whitespace-pre-wrap" key={part.text.slice(0, 100)}>
              {part.text}
            </span>
          ))}
      </div>
    );
  };

  const renderAssistantMessage = (msg: MessageWithId) => {
    const { id, message, isStreaming, modelResponses, models: msgModels } = msg;

    // Compare mode: render grid of model responses
    if (modelResponses && msgModels && msgModels.length > 1) {
      return (
        <div className="w-full" key={id}>
          <div className={cn("grid gap-3", getGridCols(msgModels.length))}>
            {msgModels.map((model) => {
              const response = modelResponses[model];
              if (!response) {
                return null;
              }

              return (
                <Card
                  className={cn(
                    "flex flex-col transition-all duration-300",
                    !response.done &&
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
                            response.done
                              ? "bg-accent/10"
                              : "animate-pulse bg-primary/10"
                          )}
                        >
                          <Bot
                            className={cn(
                              "h-4 w-4",
                              response.done ? "text-accent" : "text-primary"
                            )}
                          />
                        </div>
                        <CardTitle className="truncate font-medium text-sm">
                          {models?.find((m) => m.name === model)?.preset
                            ?.name ?? model}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {response.done ? (
                          <>
                            {response.duration ? (
                              <Badge className="text-xs" variant="cyan">
                                <Clock className="mr-1 h-3 w-3" />
                                {formatDuration(response.duration)}
                              </Badge>
                            ) : null}
                            {response.tokens ? (
                              <Badge className="text-xs" variant="neon">
                                <Zap className="mr-1 h-3 w-3" />
                                {response.tokens}
                              </Badge>
                            ) : null}
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
                    <ScrollArea className="h-[200px] pr-4">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {response.content || (
                          <span className="text-muted-foreground">
                            Ожидание ответа...
                          </span>
                        )}
                        {!response.done && response.content && (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary" />
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // Single model mode: render regular bubble
    return (
      <div className="flex gap-3" key={id}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <Bot className="h-4 w-4 text-accent" />
        </div>
        <div className="max-w-[80%] rounded-xl bg-secondary/50 px-4 py-3">
          <div className="text-sm leading-relaxed">
            {renderMessageContent(message.content)}
            {isStreaming === true ? (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary" />
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-border/50 border-b px-6 py-4">
          <div>
            <h1 className="font-bold text-xl tracking-tight">
              <span className="gradient-neon-text">AI</span> Чат
              {isCompareMode ? (
                <Badge className="ml-2 text-xs" variant="secondary">
                  Сравнение
                </Badge>
              ) : null}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isCompareMode
                ? `Сравнение ${selectedModels.length} моделей`
                : "Общайтесь с AI и прикрепляйте изображения"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={clearChat} size="sm" variant="ghost">
              <Trash2 className="mr-2 h-4 w-4" />
              Очистить
            </Button>
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full bg-secondary p-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 font-medium">Начните диалог</h3>
                <p className="max-w-sm text-muted-foreground text-sm">
                  {isCompareMode
                    ? "Выбрано несколько моделей — ответы будут показаны параллельно"
                    : "Введите сообщение или прикрепите изображение, чтобы начать общение с AI"}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.message.role === "user") {
                return (
                  <div className="flex flex-row-reverse gap-3" key={msg.id}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="max-w-[80%] rounded-xl bg-primary/10 px-4 py-3 text-foreground">
                      <div className="text-sm leading-relaxed">
                        {renderMessageContent(msg.message.content)}
                      </div>
                    </div>
                  </div>
                );
              }

              return renderAssistantMessage(msg);
            })}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-border/50 border-t bg-card/50 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl">
            {/* Attached images preview */}
            {attachedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedImages.map((img) => (
                  <div className="group relative" key={img.id}>
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                      <Image
                        alt="Preview"
                        className="object-cover"
                        fill
                        src={img.preview}
                      />
                    </div>
                    <button
                      className="-right-2 -top-2 absolute flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removeImage(img.id)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  className="min-h-[48px] resize-none pr-24"
                  disabled={isGenerating}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Введите сообщение..."
                  ref={textareaRef}
                  rows={1}
                  value={input}
                />
                <div className="absolute right-2 bottom-2 flex gap-1">
                  <input
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    type="file"
                  />
                  <Button
                    disabled={isGenerating}
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                    variant="ghost"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                className="h-auto min-h-[48px] px-4"
                disabled={
                  isGenerating ||
                  (!input.trim() && attachedImages.length === 0) ||
                  selectedModels.length === 0
                }
                onClick={handleSend}
                variant="neon"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
              <span>
                {attachedImages.length > 0 && (
                  <Badge className="mr-2" variant="secondary">
                    <ImageIcon className="mr-1 h-3 w-3" />
                    {attachedImages.length}
                  </Badge>
                )}
                <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                  Enter
                </kbd>{" "}
                отправить •{" "}
                <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                  Shift + Enter
                </kbd>{" "}
                новая строка
              </span>
            </div>
          </div>
        </div>
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
              <div className="flex items-center justify-between">
                <Label className="font-medium text-sm">Модели</Label>
                <Badge variant="outline">{selectedModels.length}</Badge>
              </div>
              {modelsLoading || isLoadingModel ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  {isLoadingModel ? (
                    <p className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Загрузка модели...
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!(modelsLoading || isLoadingModel) &&
              models !== undefined &&
              models.length > 0 ? (
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
                        disabled={isLoadingModel}
                        id={`model-${model.name}`}
                        onCheckedChange={() => toggleModel(model.name)}
                      />
                      <div className="flex flex-1 items-center gap-2 truncate">
                        <span className="flex-1 truncate text-sm">
                          {model.preset?.name ?? model.name}
                        </span>
                        {model.loaded ? null : (
                          <Badge className="text-[10px]" variant="outline">
                            ↓
                          </Badge>
                        )}
                        {model.preset?.supports_vision === true ? (
                          <Badge className="text-[10px]" variant="secondary">
                            VL
                          </Badge>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
              {!(modelsLoading || isLoadingModel) &&
              (!models || models.length === 0) ? (
                <p className="rounded-lg border border-border border-dashed p-4 text-center text-muted-foreground text-sm">
                  Нет доступных моделей
                </p>
              ) : null}

              {/* Quick actions */}
              <div className="flex gap-2">
                {selectedModels.length > 0 ? (
                  <Button
                    className="flex-1"
                    onClick={() => setSelectedModels([])}
                    size="sm"
                    variant="outline"
                  >
                    Снять все
                  </Button>
                ) : null}
                {models !== undefined &&
                models.length > 0 &&
                selectedModels.length < models.length ? (
                  <Button
                    className="flex-1"
                    onClick={() => setSelectedModels(models.map((m) => m.name))}
                    size="sm"
                    variant="outline"
                  >
                    Выбрать все
                  </Button>
                ) : null}
              </div>
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
                max={currentPreset?.max_temperature ?? 2}
                min={currentPreset?.min_temperature ?? 0}
                onValueChange={([v]) => setTemperature(v)}
                step={0.1}
                value={[temperature]}
              />
              <p className="text-muted-foreground text-xs">
                {currentPreset
                  ? `Рекомендуется: ${currentPreset.temperature.toFixed(1)}`
                  : "Выше = более креативные ответы"}
              </p>
            </div>

            {/* System prompt */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">Системный промпт</Label>
              <Textarea
                className="min-h-[120px] resize-none text-sm"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Инструкции для AI..."
                value={systemPrompt}
              />
            </div>

            {/* Info */}
            <CardGlass className="p-4">
              <div className="space-y-2 text-xs">
                <p className="font-medium text-foreground">💡 Подсказки</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Выберите несколько моделей для сравнения</li>
                  <li>• Прикрепляйте изображения для анализа</li>
                  <li>• VL модели понимают изображения</li>
                  <li>• История сохраняется в сессии</li>
                </ul>
              </div>
            </CardGlass>
          </div>
        </div>
      </aside>
    </div>
  );
}
