"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Settings2,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardGlass } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  type ChatMessage,
  type ContentPart,
  fileToDataUrl,
  getModels,
  multimodalMessage,
  streamChat,
  textMessage,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type MessageWithId = {
  id: string;
  message: ChatMessage;
  isStreaming?: boolean;
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
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(
    "Ты полезный AI-ассистент. Отвечай кратко и по существу."
  );
  const [temperature, setTemperature] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ["llm-models"],
    queryFn: getModels,
  });

  // Set default model when models load
  useEffect(() => {
    if (models && models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

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
    if ((!input.trim() && attachedImages.length === 0) || !selectedModel) {
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

    // Add empty assistant message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        message: { role: "assistant", content: "" },
        isStreaming: true,
      },
    ]);

    try {
      // Build full message history
      const chatMessages: ChatMessage[] = [
        textMessage("system", systemPrompt),
        ...messages.map((m) => m.message),
        userMessage,
      ];

      const stream = streamChat(selectedModel, chatMessages, { temperature });

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
      // Update with error message
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
    } finally {
      setIsGenerating(false);
    }
  }, [
    input,
    attachedImages,
    selectedModel,
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

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-border/50 border-b px-6 py-4">
          <div>
            <h1 className="font-bold text-xl tracking-tight">
              <span className="gradient-neon-text">AI</span> Чат
            </h1>
            <p className="text-muted-foreground text-sm">
              Общайтесь с AI и прикрепляйте изображения
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
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full bg-secondary p-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 font-medium">Начните диалог</h3>
                <p className="max-w-sm text-muted-foreground text-sm">
                  Введите сообщение или прикрепите изображение, чтобы начать
                  общение с AI
                </p>
              </div>
            )}

            {messages.map(({ id, message, isStreaming }) => (
              <div
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
                key={id}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    message.role === "user" ? "bg-primary/10" : "bg-accent/10"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4 text-primary" />
                  ) : (
                    <Bot className="h-4 w-4 text-accent" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary/10 text-foreground"
                      : "bg-secondary/50"
                  )}
                >
                  <div className="text-sm leading-relaxed">
                    {renderMessageContent(message.content)}
                    {isStreaming === true ? (
                      <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary" />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-border/50 border-t bg-card/50 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
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
                  !selectedModel
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
          "w-full border-border/50 border-l bg-card/50 backdrop-blur-sm lg:w-[280px]",
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
              <Label className="font-medium text-sm">Модель</Label>
              {modelsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select onValueChange={setSelectedModel} value={selectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите модель" />
                  </SelectTrigger>
                  <SelectContent>
                    {models?.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                placeholder="Инструкции для AI..."
                value={systemPrompt}
              />
            </div>

            {/* Info */}
            <CardGlass className="p-4">
              <div className="space-y-2 text-xs">
                <p className="font-medium text-foreground">💡 Подсказки</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Прикрепляйте изображения для анализа</li>
                  <li>• История сохраняется в сессии</li>
                  <li>• VL модели понимают изображения</li>
                </ul>
              </div>
            </CardGlass>
          </div>
        </div>
      </aside>
    </div>
  );
}
