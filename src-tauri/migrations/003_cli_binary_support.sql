-- Add cli_path column to ai_providers for custom binary paths
ALTER TABLE ai_providers ADD COLUMN cli_path TEXT;
