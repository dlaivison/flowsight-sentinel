const axios  = require('axios')
const https  = require('https')
const { query } = require('../db')

class FortifyService {
  constructor() {
    this.baseUrl     = 'https://127.0.0.1'
    this.username    = ''
    this.password    = ''
    this.token       = null
    this.tokenExpiry = null
    this.onEvent     = null
    this.pollTimer   = null
    this.lastPollMs  = Date.now() - 60000 // começa 1 min atrás
    this.running     = false
    this.pollInterval = 10000 // 10 segundos padrão

    this.client = axios.create({
      baseURL:    this.baseUrl,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 15000,
    })
  }

  async _loadConfigFromDb() {
    try {
      const { rows } = await query(`
        SELECT key, value FROM system_config
        WHERE key IN ('fortify_api_url','fortify_username','fortify_password','polling_interval_seconds')
      `)
      rows.forEach(r => {
        if (r.key === 'fortify_api_url'           && r.value) {
          this.baseUrl = r.value
          this.client.defaults.baseURL = r.value
        }
        if (r.key === 'fortify_username'           && r.value) this.username = r.value
        if (r.key === 'fortify_password'           && r.value) this.password = r.value
        if (r.key === 'polling_interval_seconds'   && r.value) this.pollInterval = parseInt(r.value) * 1000
      })
    } catch(e) {
      console.error('[Fortify] Erro ao carregar config:', e.message)
    }
  }

  async login() {
    const params = new URLSearchParams()
    params.append('username', this.username)
    params.append('password', this.password)
    params.append('session_time', '999999999999')
    const { data } = await this.client.post(
      `${this.baseUrl}/users_service/auth/login/`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    this.token       = data.data?.token
    this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000
    console.log('[Fortify] Login OK — token obtido')
    return this.token
  }

  async getToken() {
    await this._loadConfigFromDb()
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        return await this.login()
      } catch (err) {
        console.log(`[Fortify] Login falhou (tentativa ${attempt}/5): ${err.message}`)
        if (attempt < 5) await this._sleep(3000)
      }
    }
    console.log('[Fortify] Não foi possível fazer login após 5 tentativas.')
    throw new Error('Fortify login failed')
  }

  async fetchCameras() {
    try {
      const token = await this.getToken()
      const { data } = await this.client.get(`${this.baseUrl}/cameras_service/cameras/`, {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 500 },
      })
      return (data.data?.cameras || []).map(c => ({
        fortifyId: c.camera_id,
        name:      c.display_name || c.camera_id,
        status:    c.status,
      }))
    } catch (err) {
      console.error('[Fortify] Erro ao buscar câmeras:', err.message)
      return []
    }
  }

  async syncCameras() {
    const cameras = await this.fetchCameras()
    let synced = 0
    for (const cam of cameras) {
      await query(`
        INSERT INTO cameras (fortify_id, name, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (fortify_id) DO UPDATE SET
          name = EXCLUDED.name, status = EXCLUDED.status, updated_at = NOW()
      `, [cam.fortifyId, cam.name, cam.status]).catch(() => {})
      synced++
    }
    console.log(`[Fortify] ${synced} câmeras sincronizadas`)
    return synced
  }

  async fetchPOIs() {
    try {
      const token = await this.getToken()
      const { data } = await this.client.get(`${this.baseUrl}/poi_service/poi_db/poi/`, {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 500 },
      })
      return (data.data?.pois || []).map(poi => ({
        fortifyPoiId: poi.poi_id,
        name:         poi.display_name,
        photoUrl:     null,
        groupName:    null,
      }))
    } catch (err) {
      console.error('[Fortify] Erro ao buscar POIs:', err.message)
      return []
    }
  }

  // ─── POLLING (substitui SSE) ───────────────────────────────────────────────

  async startEventStream(onEventCallback) {
    this.onEvent = onEventCallback
    await this._loadConfigFromDb()
    console.log(`[Fortify] Iniciando polling — intervalo: ${this.pollInterval/1000}s`)
    this.running = true
    this.lastPollMs = Date.now() - this.pollInterval
    await this._poll()
  }

  stopEventStream() {
    this.running = false
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null }
    console.log('[Fortify] Polling parado')
  }

  _scheduleNextPoll() {
    if (!this.running) return
    this.pollTimer = setTimeout(async () => {
      await this._poll()
    }, this.pollInterval)
  }

  async _poll() {
    if (!this.running) return
    try {
      const token = await this.getToken()
      const now   = Date.now()
      const from  = this.lastPollMs
      const till  = now

      // Busca aparições no history_db (aparições que terminaram)
      const histResp = await this.client.post(
        `${this.baseUrl}/history_service/history/`,
        { from, till },
        {
          headers: { Authorization: `Bearer ${token}` },
          params:  { query_db: 'history_db', limit: 300 },
        }
      ).catch(e => { console.error('[Fortify] Erro history_db:', e.message); return null })

      // Busca aparições no live_db (aparições ainda ativas)
      const liveResp = await this.client.post(
        `${this.baseUrl}/history_service/history/`,
        { from },
        {
          headers: { Authorization: `Bearer ${token}` },
          params:  { query_db: 'live_db', limit: 300 },
        }
      ).catch(e => { console.error('[Fortify] Erro live_db:', e.message); return null })

      const histMatches = histResp?.data?.data?.matches || []
      const liveMatches = liveResp?.data?.data?.matches || []

      // Deduplica por appearance_id
      const seen = new Set()
      const allMatches = [...histMatches, ...liveMatches].filter(m => {
        if (!m || !m.appearance_id) return false
        if (seen.has(m.appearance_id)) return false
        seen.add(m.appearance_id)
        return true
      })

      if (allMatches.length > 0) {
        console.log(`[Fortify] Polling: ${allMatches.length} aparições encontradas`)
        this._processMatches(allMatches)
      }

      this.lastPollMs = till

    } catch (err) {
      console.error('[Fortify] Erro no polling:', err.message)
      // Se token expirou, invalida
      if (err.response?.status === 401) {
        this.token = null
      }
    } finally {
      this._scheduleNextPoll()
    }
  }

  _processMatches(matches) {
    for (const match of matches) {
      try {
        // Estrutura do history service: dados aninhados em sub-objetos
        const appearanceData = match.appearance_data || {}
        const cameraData     = match.camera_data     || {}
        const matchData      = match.match_data      || {}
        const cropData       = match.crop_data       || {}

        // POI pode estar em match_data ou diretamente
        const poiId = matchData.poi_id
          || matchData.best_poi_id
          || match.poi_id
          || match.best_poi_id

        if (!poiId) continue // ignora sem POI identificado

        const cameraId     = cameraData.camera_id     || match.camera_id
        const appearanceId = appearanceData.appearance_id || match.appearance_id || match.event_id

        // Timestamp: utc_time_started em segundos Unix
        const ts = appearanceData.utc_time_started
          || appearanceData.utc_time_ended
          || match.utc_time_recorded
        const detectedAt = ts ? new Date(ts * 1000) : new Date()

        const confidence = matchData.score
          || matchData.best_poi_confidence
          || match.score
          || 0

        const frameImageUrl = cropData.face_crop_img
          ? `data:image/jpeg;base64,${cropData.face_crop_img}`
          : null

        const evt = {
          fortifyEventId: appearanceId,
          poiId:          poiId,
          cameraId:       cameraId,
          detectedAt,
          confidence,
          frameImageUrl,
          rawPayload:     match,
        }

        console.log(`[Fortify] Evento: POI=${evt.poiId?.slice(0,8)} CAM=${evt.cameraId?.slice(0,8)} ts=${detectedAt.toISOString()}`)

        if (this.onEvent) this.onEvent(evt)

      } catch (err) {
        console.error('[Fortify] Erro ao processar match:', err.message)
      }
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
}

module.exports = new FortifyService()
