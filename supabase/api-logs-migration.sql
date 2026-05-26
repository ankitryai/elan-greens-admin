-- =============================================================================
-- API Logs — persistent log of all external API calls from the admin app.
-- Vercel is serverless (ephemeral filesystem), so logs are stored in Supabase.
-- Rows older than 30 days are auto-purged by pg_cron (see bottom of file).
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name    text        NOT NULL,   -- 'google_vision' | 'plant_id' | 'iucn' | 'gbif' | 'inaturalist' | 'powo' | 'wikimedia'
  endpoint    text        NOT NULL,   -- hostname only, e.g. 'vision.googleapis.com'
  status_code int,                    -- HTTP response status; 0 = network/timeout failure
  duration_ms int         NOT NULL,   -- wall-clock ms from request start to response end
  success     boolean     NOT NULL,
  error_msg   text,                   -- null on success; Google/service error body on failure
  meta        jsonb,                  -- { plant_id?, botanical_name? } — context for filtering
  created_at  timestamptz DEFAULT now()
);

-- Fast lookups by API name (for per-API log pages) and by date (for cleanup)
CREATE INDEX IF NOT EXISTS api_logs_api_name_created ON api_logs(api_name, created_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_created_at       ON api_logs(created_at DESC);

-- RLS: service role bypasses RLS; anon/authenticated cannot read or write
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Auto-purge rows older than 30 days (requires pg_cron extension — enabled by default on Supabase)
-- Run this once in the Supabase SQL editor after creating the table:
--
-- SELECT cron.schedule(
--   'purge-api-logs-30d',
--   '0 3 * * *',
--   $$DELETE FROM api_logs WHERE created_at < now() - interval '30 days'$$
-- );

-- =============================================================================
-- RPC function used by getApiLogStats() in queries.ts
-- Returns P50 and P90 latency per API for the last 30 days.
-- Run this in the Supabase SQL editor after creating the table.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_api_log_stats()
RETURNS TABLE (
  api_name     text,
  total_calls  bigint,
  success_pct  numeric,
  p50_ms       numeric,
  p90_ms       numeric,
  last_called  timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    api_name,
    COUNT(*)                                                          AS total_calls,
    ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 1)    AS success_pct,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms))  AS p50_ms,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_ms))  AS p90_ms,
    MAX(created_at)                                                   AS last_called
  FROM api_logs
  WHERE created_at > now() - interval '30 days'
  GROUP BY api_name
  ORDER BY api_name;
$$;
