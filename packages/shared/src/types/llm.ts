/**
 * LLM-related types for language model interactions.
 */

export type LLMPromptFormat =
  | "chatml"
  | "mistral"
  | "llama2"
  | "llama3"
  | "alpaca";

export type LLMPreset = {
  model_id: string;
  name: string;
  description: string;
  // Prompt format
  prompt_format: LLMPromptFormat;
  // Generation parameters
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
  // UI hints
  min_temperature: number;
  max_temperature: number;
  supports_system_prompt: boolean;
  supports_vision: boolean;
};

export type LLMModelsResponse = {
  models: Model[];
  presets: Record<string, LLMPreset>;
};

export type Model = {
  name: string;
  model_id?: string;
  size: number;
  modified_at: string;
  preset: LLMPreset | null;
  loaded: boolean;
};
