const https  = require('https');
const axios  = require('axios');
const { query } = require('../db');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class FortifyService {
  constructor() {
    this.baseUrl  = process.env.FORTIFY_API_URL || 'https://127.0.0.1';
    this.username = process.env.FORTIFY_USERNAME || '';
    this.password = process.env.FORTIFY_PASSWORD || '';
    this.token       = null;
    this.tokenExpiry = null;
    this.sseRequest  = null;
    this.onEvent     = null;

    this.client = axios.create({ baseURL: this.baseUrl, httpsAgent, timeout: 15000 });
  }

  async login() {
    const params = new URLSearchParams();
    params.append('username', this.username);
    params.append('password', this.password);
    const { data } = await this.client.post(
      '/users_service/auth/login/',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    this.token       = data.data.token;
    this.tokenExpiry = Date.now() + 7 * 60 * 60 * 1000; // 7h (token dura 8h)
    console.log('[Fortify] Login OK — token obtido');
    return this.token;
  }

  async _loadConfigFromDb() {
    try {
      const { query } = require('../db')
      const { rows } = await query(`
        SELECT key, value FROM system_config
        WHERE key IN ('fortify_api_url','fortify_username','fortify_password')
      `)
      rows.forEach(r => {
        if (r.key === 'fortify_api_url'  && r.value) this.baseUrl  = r.value
        if (r.key === 'fortify_username' && r.value) this.username = r.value
        if (r.key === 'fortify_password' && r.value) this.password = r.value
      })
    } catch(e) {
      console.error('[Fortify] Erro ao carregar config do banco:', e.message)
    }
  }

  async getToken() {
    // Recarrega config do banco a cada login
    await this._loadConfigFromDb()
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { data } = await this.client.post(
          '/users_service/auth/login/',
          `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&session_time=999999999999`,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        this.token = data.data?.token;
        this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
        console.log('[Fortify] Login OK — token obtido');
        return this.token;
      } catch (err) {
        console.log(`[Fortify] Login falhou (tentativa ${attempt}/5): ${err.message}`);
        if (attempt < 5) await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log('[Fortify] Não foi possível fazer login após 5 tentativas. Tentando em 30s...');
    setTimeout(() => { this.token = null; this.tokenExpiry = null; }, 30000);
    throw new Error('Fortify login failed');
  }

  async fetchCameras() {
    try {
      const token = await this.getToken();
      const { data } = await this.client.get('/cameras_service/cameras/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (data.data?.cameras || []).map(cam => ({
        fortifyId: cam.camera_id,
        name:       cam.description || cam.camera_id,
        location:   cam.camera_notes?.free_notes || null,
        isOnline:   cam.status?.status_code === 1 || false,
      }));
    } catch (err) {
      console.error('[Fortify] Erro ao buscar câmeras:', err.message);
      return [];
    }
  }

  async syncCameras() {
    const cameras = await this.fetchCameras();
    let synced = 0;
    for (const cam of cameras) {
      await query(`
        INSERT INTO cameras (fortify_id, name, location, is_online, last_seen_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (fortify_id) DO UPDATE SET
          name=EXCLUDED.name, location=EXCLUDED.location,
          is_online=EXCLUDED.is_online, last_seen_at=NOW(), updated_at=NOW()
      `, [cam.fortifyId, cam.name, cam.location, cam.isOnline]);
      synced++;
    }
    console.log(`[Fortify] ${synced} câmeras sincronizadas`);
    return synced;
  }

  async fetchPOIs() {
    try {
      const token = await this.getToken();
      const { data } = await this.client.get('/poi_service/poi_db/poi/', {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 500 },
      });
      return (data.data?.pois || []).map(poi => ({
        fortifyPoiId: poi.poi_id,
        name:          poi.display_name,
        photoUrl:      null,
        groupName:     null,
      }));
    } catch (err) {
      console.error('[Fortify] Erro ao buscar POIs:', err.message);
      return [];
    }
  }

  async startEventStream(onEventCallback) {
    this.onEvent = onEventCallback;
    await this._connectSSE();
  }

  async _connectSSE() {
    try {
      // Login com retry — tenta até conseguir
      let token = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          token = await this.getToken();
          break;
        } catch (err) {
          console.error(`[Fortify] Login falhou (tentativa ${attempt}/5):`, err.message);
          if (attempt < 5) await this._sleep(5000 * attempt);
        }
      }

      if (!token) {
        console.error('[Fortify] Não foi possível fazer login após 5 tentativas. Tentando em 30s...');
        setTimeout(() => this._connectSSE(), 30000);
        return;
      }

      // Resolve URL do SSE via redirect 307
      const sseUrl = await this._resolveSSEUrl(token);
      if (!sseUrl) {
        console.error('[Fortify] SSE redirect não retornou URL. Tentando em 10s...');
        // Invalida token para forçar novo login na próxima tentativa
        this.token = null;
        setTimeout(() => this._connectSSE(), 10000);
        return;
      }

      console.log(`[Fortify] Conectando SSE em: ${sseUrl}`);
      const parsed = new URL(sseUrl);

      const opts = {
        hostname:           parsed.hostname,
        port:               parseInt(parsed.port) || 443,
        path:               parsed.pathname + (parsed.search || ''),
        method:             'GET',
        rejectUnauthorized: false,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept':        'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection':    'keep-alive',
        },
      };

      this.sseRequest = https.request(opts, (res) => {
        if (res.statusCode !== 200) {
          console.error(`[Fortify] SSE retornou status ${res.statusCode} — reconectando em 10s`);
          res.resume();
          this.token = null; // força novo login
          setTimeout(() => this._connectSSE(), 10000);
          return;
        }

        console.log(`[Fortify] SSE ativo — status ${res.statusCode}`);
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();
          let eventData = null;
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try { eventData = JSON.parse(line.slice(5).trim()); } catch (_) {}
            } else if (line.trim() === '' && eventData) {
              this._processSSEEvent(eventData);
              eventData = null;
            }
          }
        });

        res.on('end', () => {
          console.log('[Fortify] SSE encerrado — reconectando em 5s...');
          setTimeout(() => this._connectSSE(), 5000);
        });

        res.on('error', (err) => {
          console.error('[Fortify] Erro no stream SSE:', err.message);
          setTimeout(() => this._connectSSE(), 5000);
        });
      });

      this.sseRequest.on('error', (err) => {
        console.error('[Fortify] Erro na conexão SSE:', err.message);
        setTimeout(() => this._connectSSE(), 5000);
      });

      // Timeout de conexão
      this.sseRequest.setTimeout(30000, () => {
        console.error('[Fortify] Timeout na conexão SSE');
        this.sseRequest.destroy();
        setTimeout(() => this._connectSSE(), 5000);
      });

      this.sseRequest.end();

    } catch (err) {
      console.error('[Fortify] Falha ao conectar SSE:', err.message);
      setTimeout(() => this._connectSSE(), 10000);
    }
  }

  async _resolveSSEUrl(token) {
    return new Promise((resolve) => {
      const url  = new URL('/events_service/events/', this.baseUrl);
      const opts = {
        hostname:           url.hostname,
        port:               parseInt(url.port) || 443,
        path:               url.pathname,
        method:             'GET',
        rejectUnauthorized: false,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept':        'text/event-stream',
        },
      };

      const req = https.request(opts, (res) => {
        if (res.statusCode === 307 && res.headers.location) {
          let sseLocation = res.headers.location;
          // No Docker, substitui 127.0.0.1 pelo host para SSE dinâmico
          if (process.env.FORTIFY_API_URL && process.env.FORTIFY_API_URL.includes('host.docker.internal')) {
            sseLocation = sseLocation.replace('127.0.0.1', 'host.docker.internal');
          }
          console.log(`[Fortify] SSE redirect → ${sseLocation}`);
          resolve(sseLocation);
        } else {
          console.error(`[Fortify] Redirect esperado 307, recebeu ${res.statusCode}`);
          resolve(null);
        }
        res.resume();
      });

      req.setTimeout(10000, () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.end();
    });
  }

  _processSSEEvent(eventData) {
    try {
      const appearances = eventData?.data?.appearances || [];
      for (const app of appearances) {
        if (!app.poi_id && !app.best_poi_id) continue;
        const evt = {
          fortifyEventId: app.appearance_id,
          poiId:           app.poi_id || app.best_poi_id,
          cameraId:        app.camera_id,
          detectedAt:      new Date((app.last_detection_time_utc || app.start_time_utc) * 1000),
          confidence:      app.score || app.best_poi_confidence || 0,
          frameImageUrl:   app.frame_url || app.crop_data?.face_crop_img || null,
          rawPayload:      app,
        };
        console.log(`[Fortify] Evento recebido: POI=${evt.poiId?.slice(0,8)} CAM=${evt.cameraId?.slice(0,8)}`);
        if (this.onEvent) this.onEvent(evt);
      }
    } catch (err) {
      console.error('[Fortify] Erro ao processar evento SSE:', err.message);
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  stopEventStream() {
    if (this.sseRequest) { this.sseRequest.destroy(); this.sseRequest = null; }
  }
}

module.exports = new FortifyService();
