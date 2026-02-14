-- Add iid (project-scoped pipeline number) and name (commit message) to pipelines
ALTER TABLE pipelines ADD COLUMN iid INTEGER;
ALTER TABLE pipelines ADD COLUMN name TEXT;
