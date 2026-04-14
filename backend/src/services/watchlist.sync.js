const { query }  = require('../db')
const fortify   = require('./fortify.service')

class WatchlistSync {
  constructor() {
    this.timer       = null
    this.running     = false
    this.intervalSec = 30
  }

  async start() {
    await this._loadInterval()
    console.log(`[WatchlistSync] Iniciando — intervalo: ${this.intervalSec}s`)
    await this._sync()
    this._scheduleNext()
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  _scheduleNext() {
    this.timer = setTimeout(async () => {
      await this._loadInterval()
      await this._sync()
      this._scheduleNext()
    }, this.intervalSec * 1000)
  }

  async _loadInterval() {
    try {
      const { rows } = await query("SELECT value FROM system_config WHERE key = 'watchlist_sync_interval'")
      this.intervalSec = parseFloat(rows[0]?.value) || 30
    } catch(_) {}
  }

  async _sync() {
    if (this.running) return
    this.running = true
    try {
      const { rows: cfg } = await query("SELECT value FROM system_config WHERE key = 'guards_watchlist_id'")
      const watchlistId = cfg[0]?.value
      if (!watchlistId) {
        console.log('[WatchlistSync] Nenhuma watchlist configurada — pulando')
        return
      }

      const token = await fortify.getToken()
      const BATCH = 30

      // 1. Busca todos os POIs
      const listResp = await fortify.client.get('/poi_service/poi_db/poi/', {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 500 },
      })
      const allPois = listResp.data.data?.pois || []
      if (allPois.length === 0) {
        console.log('[WatchlistSync] Nenhum POI encontrado no Fortify')
        return
      }

      // 2. Filtra POIs da watchlist em batch (sem foto)
      const allIds = allPois.map(p => p.poi_id)
      const filtered = []
      for (let i = 0; i < allIds.length; i += BATCH) {
        const batch = allIds.slice(i, i + BATCH)
        try {
          const detailResp = await fortify.client.post(
            '/poi_service/poi_db/poi/get/',
            { get_crops: false, get_faces: false, pois: batch },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const batchPois = detailResp.data.data?.pois || []
          const inWatchlist = batchPois.filter(p =>
            p && p.poi_watchlists?.includes(watchlistId)
          )
          filtered.push(...inWatchlist)
        } catch(e) {
          console.error('[WatchlistSync] Erro ao filtrar batch:', e.message)
        }
      }

      if (filtered.length === 0) {
        console.log('[WatchlistSync] Nenhum POI encontrado na watchlist')
        return
      }

      // 3. Busca com fotos
      const filteredIds = filtered.map(p => p.poi_id)
      const withPhotos = []
      for (let i = 0; i < filteredIds.length; i += BATCH) {
        const batch = filteredIds.slice(i, i + BATCH)
        try {
          const photoResp = await fortify.client.post(
            '/poi_service/poi_db/poi/get/',
            { get_crops: true, get_faces: false, pois: batch },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const batchPois = photoResp.data.data?.pois || []
          withPhotos.push(...batchPois.filter(Boolean))
        } catch(e) {
          batch.forEach(id => {
            const p = filtered.find(f => f.poi_id === id)
            if (p) withPhotos.push(p)
          })
        }
      }

      // 4. Upsert no banco
      let created = 0, updated = 0, deactivated = 0
      const poiIds = withPhotos.map(p => p.poi_id)

      for (const poi of withPhotos) {
        const photoUrl = poi.display_img ? `data:image/jpeg;base64,${poi.display_img}` : null
        const { rows } = await query(`
          INSERT INTO guards (fortify_poi_id, name, photo_url, is_active)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (fortify_poi_id) DO UPDATE SET
            name       = EXCLUDED.name,
            photo_url  = COALESCE(EXCLUDED.photo_url, guards.photo_url),
            is_active  = TRUE,
            updated_at = NOW()
          RETURNING id, (xmax = 0) AS inserted
        `, [poi.poi_id, poi.display_name, photoUrl])
        if (rows[0]?.inserted) created++
        else updated++
      }

      // 5. Desativa removidos da watchlist
      if (poiIds.length > 0) {
        const placeholders = poiIds.map((_, i) => `$${i+1}`).join(',')
        const { rowCount } = await query(`
          UPDATE guards SET is_active = FALSE, updated_at = NOW()
          WHERE fortify_poi_id NOT IN (${placeholders}) AND is_active = TRUE
        `, poiIds)
        deactivated = rowCount
      }

      console.log(`[WatchlistSync] ✓ ${filtered.length} POIs na watchlist | Criados: ${created} | Atualizados: ${updated} | Desativados: ${deactivated}`)

    } catch (err) {
      console.error('[WatchlistSync] Erro:', err.message)
    } finally {
      this.running = false
    }
  }
}

module.exports = new WatchlistSync()
