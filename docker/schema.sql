-- FlowSight Sentinel — Schema completo
-- Gerado automaticamente em 2026-04-10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Função de atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ─── TABELAS ────────────────────────────────────────────────────────────────

CREATE TABLE public.cameras (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    forsight_id   VARCHAR(128) UNIQUE NOT NULL,
    name          VARCHAR(255) NOT NULL,
    location      VARCHAR(255),
    is_online     BOOLEAN DEFAULT TRUE,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.posts (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                      VARCHAR(255) NOT NULL,
    description               TEXT,
    floor                     VARCHAR(64),
    absence_threshold_minutes INTEGER NOT NULL DEFAULT 30,
    warning_threshold_minutes INTEGER NOT NULL DEFAULT 20,
    absence_threshold_seconds INTEGER DEFAULT 60,
    warning_threshold_seconds INTEGER DEFAULT 30,
    is_active                 BOOLEAN DEFAULT TRUE,
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.post_cameras (
    post_id   UUID NOT NULL,
    camera_id UUID NOT NULL,
    PRIMARY KEY (post_id, camera_id)
);

CREATE TABLE public.guards (
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

CREATE TABLE public.guard_post_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id    UUID,
    post_id     UUID,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at  TIMESTAMPTZ,
    assigned_by VARCHAR(128)
);

CREATE TABLE public.absence_state (
    guard_id             UUID PRIMARY KEY,
    post_id              UUID,
    last_detected_at     TIMESTAMPTZ,
    last_camera_id       UUID,
    last_frame_image_url TEXT,
    absence_minutes      INTEGER DEFAULT 0,
    status               VARCHAR(16) DEFAULT 'present'
        CHECK (status IN ('present','warning','alarm')),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.post_coverage_state (
    post_id         UUID PRIMARY KEY,
    status          VARCHAR(20) DEFAULT 'covered',
    last_detected_at TIMESTAMPTZ,
    last_guard_id   UUID,
    last_guard_name VARCHAR(100),
    last_camera_id  UUID,
    absence_seconds INTEGER DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.alarms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id        UUID,
    post_id         UUID,
    absence_minutes INTEGER NOT NULL,
    threshold_minutes INTEGER NOT NULL,
    frame_image_url TEXT,
    triggered_at    TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(16) DEFAULT 'active'
        CHECK (status IN ('active','snoozed','acknowledged','auto_resolved')),
    snoozed_until   TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(128),
    notes           TEXT,
    whatsapp_sent   BOOLEAN DEFAULT FALSE,
    whatsapp_sent_at TIMESTAMPTZ
);

CREATE TABLE public.detection_events (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    forsight_event_id VARCHAR(128) UNIQUE,
    guard_id         UUID,
    camera_id        UUID,
    detected_at      TIMESTAMPTZ NOT NULL,
    confidence       NUMERIC(5,4),
    frame_image_url  TEXT,
    raw_payload      JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.users (
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

CREATE TABLE public.system_config (
    key         VARCHAR(128) PRIMARY KEY,
    value       TEXT,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.shift_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64) NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL,
    color      VARCHAR(16) DEFAULT '#58A6FF',
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.shift_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_type_id UUID NOT NULL,
    guard_id      UUID NOT NULL,
    post_id       UUID,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    status        VARCHAR(32) NOT NULL DEFAULT 'active',
    notes         TEXT,
    created_by    VARCHAR(64),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shift_type_id, guard_id, date)
);

CREATE TABLE public.absence_reasons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(64) NOT NULL,
    type            VARCHAR(16) NOT NULL DEFAULT 'both',
    default_minutes INTEGER NOT NULL DEFAULT 15,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.absence_justifications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id          UUID NOT NULL,
    guard_id         UUID,
    reason_id        UUID,
    custom_reason    TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at       TIMESTAMPTZ NOT NULL,
    resolved_at      TIMESTAMPTZ,
    status           VARCHAR(16) DEFAULT 'active',
    created_by       VARCHAR(64),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_config (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number     VARCHAR(32) NOT NULL,
    label            VARCHAR(128),
    is_active        BOOLEAN DEFAULT TRUE,
    notify_alarm     BOOLEAN DEFAULT TRUE,
    notify_warning   BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_license (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(256) UNIQUE,
    is_active   BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── VIEW ───────────────────────────────────────────────────────────────────

CREATE VIEW public.active_assignments AS
    SELECT g.id AS guard_id, g.name AS guard_name, g.forsight_poi_id,
           g.photo_url, g.badge_number, g.group_name,
           p.id AS post_id, p.name AS post_name, p.floor,
           p.absence_threshold_minutes, p.warning_threshold_minutes,
           a.assigned_at
    FROM public.guards g
    JOIN public.guard_post_assignments a ON a.guard_id = g.id AND a.removed_at IS NULL
    JOIN public.posts p ON p.id = a.post_id
    WHERE g.is_active = TRUE AND p.is_active = TRUE;

-- ─── FOREIGN KEYS ───────────────────────────────────────────────────────────

ALTER TABLE public.post_cameras
    ADD FOREIGN KEY (post_id)   REFERENCES public.posts(id) ON DELETE CASCADE,
    ADD FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;

ALTER TABLE public.guard_post_assignments
    ADD FOREIGN KEY (guard_id) REFERENCES public.guards(id) ON DELETE CASCADE,
    ADD FOREIGN KEY (post_id)  REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.absence_state
    ADD FOREIGN KEY (guard_id)       REFERENCES public.guards(id) ON DELETE CASCADE,
    ADD FOREIGN KEY (post_id)        REFERENCES public.posts(id) ON DELETE SET NULL,
    ADD FOREIGN KEY (last_camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;

ALTER TABLE public.post_coverage_state
    ADD FOREIGN KEY (post_id)       REFERENCES public.posts(id),
    ADD FOREIGN KEY (last_guard_id) REFERENCES public.guards(id),
    ADD FOREIGN KEY (last_camera_id) REFERENCES public.cameras(id);

ALTER TABLE public.alarms
    ADD FOREIGN KEY (guard_id) REFERENCES public.guards(id) ON DELETE SET NULL,
    ADD FOREIGN KEY (post_id)  REFERENCES public.posts(id) ON DELETE SET NULL;

ALTER TABLE public.detection_events
    ADD FOREIGN KEY (guard_id)  REFERENCES public.guards(id) ON DELETE SET NULL,
    ADD FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;

ALTER TABLE public.shift_schedules
    ADD FOREIGN KEY (shift_type_id) REFERENCES public.shift_types(id),
    ADD FOREIGN KEY (guard_id)      REFERENCES public.guards(id),
    ADD FOREIGN KEY (post_id)       REFERENCES public.posts(id);

ALTER TABLE public.absence_justifications
    ADD FOREIGN KEY (post_id)   REFERENCES public.posts(id),
    ADD FOREIGN KEY (guard_id)  REFERENCES public.guards(id),
    ADD FOREIGN KEY (reason_id) REFERENCES public.absence_reasons(id);

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────

CREATE INDEX idx_alarms_active      ON public.alarms(status) WHERE status = 'active';
CREATE INDEX idx_alarms_guard       ON public.alarms(guard_id, triggered_at DESC);
CREATE INDEX idx_detection_camera   ON public.detection_events(camera_id, detected_at DESC);
CREATE INDEX idx_detection_guard    ON public.detection_events(guard_id, detected_at DESC);

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────

CREATE TRIGGER trg_cameras_updated  BEFORE UPDATE ON public.cameras  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_guards_updated   BEFORE UPDATE ON public.guards   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_posts_updated    BEFORE UPDATE ON public.posts    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_absence_updated  BEFORE UPDATE ON public.absence_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── DADOS INICIAIS ──────────────────────────────────────────────────────────

-- Usuário admin padrão (senha: admin123 — TROCAR EM PRODUÇÃO)
INSERT INTO public.users (username, password_hash, role, full_name)
VALUES ('admin', '$2b$10$4oKSaJUVeOgK3aNLXGAdy.L3G.U52nqtNJbnR.sZflnabgAFUY1Qm', 'admin', 'Administrador')
ON CONFLICT DO NOTHING;

-- Configurações padrão do sistema
INSERT INTO public.system_config (key, value, description) VALUES
    ('forsight_api_url',           'https://127.0.0.1',   'URL base da API Forsight'),
    ('forsight_username',          '',                     'Usuário da API Forsight'),
    ('forsight_password',          '',                     'Senha da API Forsight'),
    ('guards_watchlist_id',        '',                     'ID da watchlist de vigilantes no Corsight'),
    ('polling_interval_seconds',   '30',                   'Intervalo de recálculo em segundos'),
    ('default_warning_threshold',  '20',                   'Threshold padrão de aviso (minutos)'),
    ('default_absence_threshold',  '30',                   'Threshold padrão de alarme (minutos)')
ON CONFLICT (key) DO NOTHING;

-- Turnos padrão
INSERT INTO public.shift_types (name, start_time, end_time, color) VALUES
    ('Manhã', '06:00', '18:00', '#F0A500'),
    ('Noite', '18:00', '06:00', '#58A6FF')
ON CONFLICT DO NOTHING;

-- Motivos de ausência padrão
INSERT INTO public.absence_reasons (name, type, default_minutes) VALUES
    ('Banheiro',       'individual', 15),
    ('Almoço',         'individual', 40),
    ('Troca de turno', 'post',       20),
    ('Ocorrência',     'individual', 30),
    ('Manutenção',     'post',       60),
    ('Outro',          'both',       15)
ON CONFLICT DO NOTHING;

