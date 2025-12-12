/**
 * Chat and message types for LLM interactions.
 */

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: { url: string };
};

export type ContentPart = TextContent | ImageContent;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type CompareChunk = {
  model: string;
  content: string;
  done: boolean;
};

export type CompareModelDone = {
  model: string;
  fullContent: string;
  duration: number;
  eval_count?: number;
};
