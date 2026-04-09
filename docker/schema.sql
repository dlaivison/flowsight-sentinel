CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE cameras (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forsight_id   VARCHAR(128) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  location      VARCHAR(255),
  is_online     BOOLEAN DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  floor             VARCHAR(64),
  absence_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  warning_threshold_minutes INTEGER NOT NULL DEFAULT 20,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_cameras (
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  camera_id  UUID REFERENCES cameras(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, camera_id)
);

CREATE TABLE guards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forsight_poi_id VARCHAR(128) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  badge_number    VARCHAR(64),
  photo_url       TEXT,
  group_name      VARCHAR(128),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guard_post_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id    UUID REFERENCES guards(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at  TIMESTAMPTZ,
  assigned_by VARCHAR(128)
);

CREATE VIEW active_assignments AS
  SELECT
    g.id            AS guard_id,
    g.name          AS guard_name,
    g.forsight_poi_id,
    g.photo_url,
    g.badge_number,
    g.group_name,
    p.id            AS post_id,
    p.name          AS post_name,
    p.floor,
    p.absence_threshold_minutes,
    p.warning_threshold_minutes,
    a.assigned_at
  FROM guards g
  JOIN guard_post_assignments a ON a.guard_id = g.id AND a.removed_at IS NULL
  JOIN posts p ON p.id = a.post_id
  WHERE g.is_active = TRUE AND p.is_active = TRUE;

CREATE TABLE detection_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forsight_event_id VARCHAR(128) UNIQUE,
  guard_id          UUID REFERENCES guards(id) ON DELETE SET NULL,
  camera_id         UUID REFERENCES cameras(id) ON DELETE SET NULL,
  detected_at       TIMESTAMPTZ NOT NULL,
  confidence        NUMERIC(5,4),
  frame_image_url   TEXT,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detection_guard_time ON detection_events (guard_id, detected_at DESC);
CREATE INDEX idx_detection_camera_time ON detection_events (camera_id, detected_at DESC);

CREATE TABLE absence_state (
  guard_id              UUID PRIMARY KEY REFERENCES guards(id) ON DELETE CASCADE,
  post_id               UUID REFERENCES posts(id) ON DELETE SET NULL,
  last_detected_at      TIMESTAMPTZ,
  last_camera_id        UUID REFERENCES cameras(id) ON DELETE SET NULL,
  last_frame_image_url  TEXT,
  absence_minutes       INTEGER DEFAULT 0,
  status                VARCHAR(16) DEFAULT 'present'
                          CHECK (status IN ('present','warning','alarm')),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alarms (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id            UUID REFERENCES guards(id) ON DELETE SET NULL,
  post_id             UUID REFERENCES posts(id) ON DELETE SET NULL,
  absence_minutes     INTEGER NOT NULL,
  threshold_minutes   INTEGER NOT NULL,
  frame_image_url     TEXT,
  triggered_at        TIMESTAMPTZ DEFAULT NOW(),
  status              VARCHAR(16) DEFAULT 'active'
                        CHECK (status IN ('active','snoozed','acknowledged','auto_resolved')),
  snoozed_until       TIMESTAMPTZ,
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     VARCHAR(128),
  notes               TEXT,
  whatsapp_sent       BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at    TIMESTAMPTZ
);

CREATE INDEX idx_alarms_guard ON alarms (guard_id, triggered_at DESC);
CREATE INDEX idx_alarms_active ON alarms (status) WHERE status = 'active';

CREATE TABLE whatsapp_license (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key   VARCHAR(256) UNIQUE,
  is_active     BOOLEAN DEFAULT FALSE,
  activated_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_config (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number   VARCHAR(32) NOT NULL,
  label          VARCHAR(128),
  is_active      BOOLEAN DEFAULT TRUE,
  notify_alarm   BOOLEAN DEFAULT TRUE,
  notify_warning BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_config (
  key         VARCHAR(128) PRIMARY KEY,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value, description) VALUES
  ('polling_interval_seconds', '30',    'Intervalo de polling na API do Forsight'),
  ('forsight_api_url',         '',      'URL base da API do Forsight'),
  ('forsight_api_key',         '',      'Chave de autenticação do Forsight'),
  ('default_absence_threshold','30',    'Threshold padrão de ausência em minutos'),
  ('default_warning_threshold','20',    'Threshold padrão de aviso em minutos');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  role          VARCHAR(16) DEFAULT 'manager'
                  CHECK (role IN ('admin','manager')),
  full_name     VARCHAR(128),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (username, password_hash, role, full_name)
VALUES ('admin', '$2b$12$rBs0zmkFnR3eJ7vCpIHEFO3e2xXuBqZrNF3Y0Kz7h9P1Qw5sJVdCi', 'admin', 'Administrador');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cameras_updated     BEFORE UPDATE ON cameras      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_posts_updated       BEFORE UPDATE ON posts         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_guards_updated      BEFORE UPDATE ON guards        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_absence_updated     BEFORE UPDATE ON absence_state FOR EACH ROW EXECUTE FUNCTION update_updated_at();
