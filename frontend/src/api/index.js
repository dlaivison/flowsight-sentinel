import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('fs_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fs_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login                = (u, p) => api.post('/api/auth/login', { username: u, password: p })
export const getDashboardSnapshot = ()      => api.get('/api/dashboard/snapshot')
export const getGuardHistory      = (id, p) => api.get(`/api/dashboard/guard/${id}/history?period=${p}`)
export const getActiveAlarms      = ()      => api.get('/api/alarms/active')
export const acknowledgeAlarm     = (id, n) => api.post(`/api/alarms/${id}/acknowledge`, { notes: n })
export const snoozeAlarm          = (id, m) => api.post(`/api/alarms/${id}/snooze`, { minutes: m })
export const getAlarmHistory      = (p)     => api.get('/api/alarms', { params: p })
export const getPosts             = ()      => api.get('/api/posts')
export const createPost           = (d)     => api.post('/api/posts', d)
export const updatePost           = (id, d) => api.put(`/api/posts/${id}`, d)
export const assignGuardToPost    = (pid, gid) => api.post(`/api/posts/${pid}/assign-guard`, { guard_id: gid })
export const getGuards            = ()      => api.get('/api/guards')
export const createGuard          = (d)     => api.post('/api/guards', d)
export const updateGuard          = (id, d) => api.put(`/api/guards/${id}`, d)
export const getCameras           = ()      => api.get('/api/cameras')
export const syncCameras          = ()      => api.post('/api/cameras/sync')
export const getConfig            = ()      => api.get('/api/config')
export const updateConfig         = (k, v)  => api.put(`/api/config/${k}`, { value: v })

export default api

export const getPoisGallery = () => api.get('/api/forsight/pois-gallery')

export const removeGuardFromPost = (postId, guardId) => api.post(`/api/posts/${postId}/remove-guard`, { guard_id: guardId })

export const getWatchlists     = ()     => api.get('/api/forsight/watchlists')
export const getWatchlistPois  = ()     => api.get('/api/forsight/watchlist-pois')

// Shifts
export const getShiftTypes       = ()        => api.get('/api/shifts/types')
export const createShiftType     = (data)    => api.post('/api/shifts/types', data)
export const updateShiftType     = (id,data) => api.put(`/api/shifts/types/${id}`, data)
export const deleteShiftType     = (id)      => api.delete(`/api/shifts/types/${id}`)
export const getActiveShift      = ()        => api.get('/api/shifts/active')
export const getShiftSchedule    = (date)    => api.get('/api/shifts/schedule', { params:{date} })
export const saveShiftSchedule   = (data)    => api.post('/api/shifts/schedule', data)
export const removeShiftSchedule = (id)      => api.delete(`/api/shifts/schedule/${id}`)

// Justificativas
export const getAbsenceReasons      = ()      => api.get('/api/justifications/reasons')
export const createAbsenceReason    = (data)  => api.post('/api/justifications/reasons', data)
export const updateAbsenceReason    = (id,d)  => api.put(`/api/justifications/reasons/${id}`, d)
export const deleteAbsenceReason    = (id)    => api.delete(`/api/justifications/reasons/${id}`)
export const getActiveJustifications= ()      => api.get('/api/justifications/active')
export const getPostJustifications  = (postId)=> api.get(`/api/justifications/post/${postId}`)
export const createJustification    = (data)  => api.post('/api/justifications', data)
export const resolveJustification   = (id)    => api.post(`/api/justifications/${id}/resolve`)
