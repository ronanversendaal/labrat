/**
 * AI provider and suggestion types for the frontend
 *
 * These types mirror the Rust backend types and match the
 * Tauri command contracts defined in tauri-commands.md
 */

/** AI provider type */
export type AIProviderType =
  | 'claude_cli'
  | 'opencode_cli'
  | 'ollama_cli'
  | 'llm_cli'
  | 'gemini_cli'
  | 'custom_cli'
  | 'anthropic_api'
  | 'openai_api';

/** An AI provider configuration */
export interface AIProvider {
  id: string;
  provider_type: AIProviderType;
  name: string;
  model: string | null;
  cli_path: string | null;
  is_default: boolean;
  enabled: boolean;
  is_available: boolean;
}

/** Suggestion category */
export type SuggestionCategory =
  | 'code_quality'
  | 'potential_bug'
  | 'performance'
  | 'security'
  | 'best_practice'
  | 'readability'
  | 'documentation';

/** Suggestion severity */
export type SuggestionSeverity = 'info' | 'warning' | 'error';

/** Suggestion status */
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'posted';

/** An AI suggestion for code review */
export interface AISuggestion {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  suggested_code: string | null;
  original_code: string;
  status: SuggestionStatus;
}

/** Request to add an AI provider */
export interface AddProviderRequest {
  provider_type: AIProviderType;
  name: string;
  model?: string;
  api_key?: string;
  cli_path?: string;
}

/** Request to analyze a diff */
export interface AnalyzeDiffRequest {
  project_id: number;
  mr_iid: number;
  provider_id?: string;
}

/** Response from analyzing a diff */
export interface AnalyzeDiffResponse {
  suggestions: AISuggestion[];
  provider_used: string;
  analysis_time_ms: number;
}

/** Analysis status */
export type AnalysisStatus = 'started' | 'processing' | 'completed' | 'error';

/** Progress event during analysis */
export interface AnalysisProgressEvent {
  mr_id: number;
  status: AnalysisStatus;
  progress: number;
  message: string;
}

/** Request to update suggestion status */
export interface UpdateSuggestionRequest {
  suggestion_id: string;
  status: SuggestionStatus;
}

/** Response from checking CLI availability */
export interface CliAvailableResponse {
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

/** Response from checking a CLI binary */
export interface CliCheckResponse {
  provider_type: AIProviderType;
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

/** A model available from a provider */
export interface AvailableModel {
  id: string;
  name: string | null;
}

/** Response from listing available models */
export interface ModelsResponse {
  provider_type: AIProviderType;
  models: AvailableModel[];
}

/** Response from validating a CLI path */
export interface ValidateCliPathResponse {
  valid: boolean;
  version: string | null;
  error: string | null;
}
