const router   = require('express').Router()
const { authenticate } = require('./auth.middleware')
const { query } = require('../db')
const forsight = require('../services/forsight.service')

router.use(authenticate)

// Lista todas as watchlists do Corsight
router.get('/watchlists', async (req, res, next) => {
  try {
    const token = await forsight.getToken()
    const { data } = await forsight.client.get('/poi_service/poi_db/watchlist/', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const watchlists = (data.data?.watchlists || []).map(w => ({
      id:    w.watchlist_id,
      name:  w.display_name,
      type:  w.watchlist_type,
      notes: w.watchlist_notes?.free_notes || '',
    }))
    res.json(watchlists)
  } catch (err) { next(err) }
})

// Lista POIs da watchlist configurada como "vigilantes" com fotos
router.get('/watchlist-pois', async (req, res, next) => {
  try {
    // Busca qual watchlist está configurada
    const { rows } = await query(
      `SELECT value FROM system_config WHERE key = 'guards_watchlist_id'`
    )
    const watchlistId = rows[0]?.value

    if (!watchlistId) {
      return res.json({ configured: false, pois: [], message: 'Nenhuma watchlist configurada. Configure em Parâmetros.' })
    }

    const token = await forsight.getToken()

    // 1. Busca todos os POI IDs
    const listResp = await forsight.client.get('/poi_service/poi_db/poi/', {
      headers: { Authorization: `Bearer ${token}` },
      params:  { limit: 500 },
    })
    const allPois = listResp.data.data?.pois || []
    if (allPois.length === 0) return res.json({ configured: true, pois: [] })

    // 2. Busca detalhes SEM foto para filtrar pela watchlist
    const allIds = allPois.map(p => p.poi_id)
    const BATCH = 30
    const filtered = []

    for (let i = 0; i < allIds.length; i += BATCH) {
      const batch = allIds.slice(i, i + BATCH)
      try {
        const detailResp = await forsight.client.post(
          '/poi_service/poi_db/poi/get/',
          { get_crops: false, get_faces: false, pois: batch },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const batchPois = detailResp.data.data?.pois || []
        // Filtra apenas os que pertencem à watchlist configurada
        const inWatchlist = batchPois.filter(p =>
          p && p.poi_watchlists?.includes(watchlistId)
        )
        filtered.push(...inWatchlist)
      } catch (err) {
        console.error('[Forsight] Erro ao buscar POIs:', err.message)
      }
    }

    if (filtered.length === 0) {
      return res.json({ configured: true, pois: [], message: 'Nenhum POI encontrado nesta watchlist.' })
    }

    // 3. Busca fotos apenas dos POIs filtrados em lotes
    const filteredIds = filtered.map(p => p.poi_id)
    const withPhotos = []

    for (let i = 0; i < filteredIds.length; i += BATCH) {
      const batch = filteredIds.slice(i, i + BATCH)
      try {
        const photoResp = await forsight.client.post(
          '/poi_service/poi_db/poi/get/',
          { get_crops: true, get_faces: false, pois: batch },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const batchPois = photoResp.data.data?.pois || []
        withPhotos.push(...batchPois.filter(Boolean))
      } catch (err) {
        console.error('[Forsight] Erro ao buscar fotos:', err.message)
        // Adiciona sem foto
        batch.forEach(id => {
          const p = filtered.find(f => f.poi_id === id)
          if (p) withPhotos.push(p)
        })
      }
    }

    // 4. Marca quais já estão cadastrados no Sentinel
    const { rows: registered } = await query(
      `SELECT forsight_poi_id FROM guards WHERE is_active = TRUE`
    )
    const registeredSet = new Set(registered.map(r => r.forsight_poi_id))

    const pois = withPhotos.map(p => ({
      poi_id:       p.poi_id,
      display_name: p.display_name,
      display_img:  p.display_img || null,
      registered:   registeredSet.has(p.poi_id),
    }))

    res.json({ configured: true, pois })
  } catch (err) { next(err) }
})

// Galeria completa (todos os POIs — mantida para compatibilidade)
router.get('/pois-gallery', async (req, res, next) => {
  try {
    const token = await forsight.getToken()

    const listResp = await forsight.client.get('/poi_service/poi_db/poi/', {
      headers: { Authorization: `Bearer ${token}` },
      params:  { limit: 500 },
    })
    const allPois = listResp.data.data?.pois || []
    if (allPois.length === 0) return res.json([])

    const BATCH = 30
    const results = []
    for (let i = 0; i < allPois.length; i += BATCH) {
      const batch    = allPois.slice(i, i + BATCH)
      const batchIds = batch.map(p => p.poi_id)
      try {
        const getResp = await forsight.client.post(
          '/poi_service/poi_db/poi/get/',
          { get_crops: true, get_faces: false, pois: batchIds },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        results.push(...(getResp.data.data?.pois || []).filter(Boolean))
      } catch (err) {
        results.push(...batch.map(p => ({ poi_id: p.poi_id, display_name: p.display_name })))
      }
    }

    const { rows: registered } = await query(
      `SELECT forsight_poi_id FROM guards WHERE is_active = TRUE`
    )
    const registeredSet = new Set(registered.map(r => r.forsight_poi_id))

    res.json(results.map(poi => ({
      poi_id:       poi.poi_id,
      display_name: poi.display_name,
      display_img:  poi.display_img || null,
      registered:   registeredSet.has(poi.poi_id),
    })))
  } catch (err) { next(err) }
})

module.exports = router
