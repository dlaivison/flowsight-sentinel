import { create } from 'zustand'

const WS_URL = (() => {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  return base.replace(/^http/, 'ws') + '/ws'
})()

// Som de alarme + notificação do sistema
function playAlarmSound(postName) {
  // 1. Toca o MP3
  try {
    const audio = new Audio('/alarm.mp3')
    audio.volume = 0.8
    audio.play().catch(() => {
      // Se bloqueado, tenta via AudioContext
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctx.resume().then(() => {
          const audio2 = new Audio('/alarm.mp3')
          audio2.volume = 0.8
          audio2.play().catch(() => {})
        })
      } catch(_) {}
    })
  } catch(e) {
    console.warn('Audio não disponível:', e.message)
  }

  // 2. Notificação do sistema (funciona mesmo com aba em background)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('⚠ FlowSight Sentinel — Alarme', {
        body: postName ? `Posto descoberto: ${postName}` : 'Posto sem vigilante além do limite!',
        icon: '/favicon.ico',
        requireInteraction: true,  // Não fecha automaticamente
        silent: false,
      })
    } catch(_) {}
  }
}

export const useFlowStore = create((set, get) => ({
  guards:       [],
  activeAlarms: [],
  summary:      { alarm:0, warning:0, present:0, total:0 },
  connected:    false,
  lastUpdate:   null,
  token:        localStorage.getItem('fs_token') || null,
  user:         JSON.parse(localStorage.getItem('fs_user') || 'null'),
  alarmModal:   null,
  ws:           null,

  connectWS() {
    const token = get().token
    if (!token) return
    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    ws.onopen = () => {
      set({ connected: true, ws })
      ws._ping = setInterval(() => ws.readyState===1 && ws.send(JSON.stringify({type:'PING'})), 30000)
    }
    ws.onmessage = (e) => {
      try { get()._handle(JSON.parse(e.data)) } catch(_) {}
    }
    ws.onclose = () => {
      clearInterval(ws._ping)
      set({ connected: false, ws: null })
      setTimeout(() => get().connectWS(), 5000)
    }
    ws.onerror = () => ws.close()
  },

  _handle(msg) {
    switch(msg.type) {
      case 'INITIAL_STATE':
        set({
          guards:       msg.payload.snapshot,
          activeAlarms: msg.payload.activeAlarms,
          summary:      _sum(msg.payload.snapshot),
          lastUpdate:   new Date(),
        })
        if (msg.payload.activeAlarms.length > 0 && !get().alarmModal) {
          set({ alarmModal: msg.payload.activeAlarms[0] })
          playAlarmSound(msg.payload.activeAlarms[0]?.post_name)
        }
        break
      case 'SNAPSHOT_UPDATE':
        set({ guards: msg.payload, summary: _sum(msg.payload), lastUpdate: new Date() })
        break
      case 'ALARM_TRIGGERED':
        set(s => ({ activeAlarms: [msg.payload, ...s.activeAlarms] }))
        if (!get().alarmModal) {
          set({ alarmModal: msg.payload })
          playAlarmSound(msg.payload?.post_name)
        }
        break
      case 'ALARM_ACKNOWLEDGED':
      case 'ALARM_SNOOZED':
        set(s => ({
          activeAlarms: s.activeAlarms.filter(a => a.id !== msg.payload.alarmId),
          alarmModal: s.alarmModal?.id === msg.payload.alarmId ? null : s.alarmModal,
        }))
        break
    }
  },

  login(token, user) {
    localStorage.setItem('fs_token', token)
    localStorage.setItem('fs_user', JSON.stringify(user))
    set({ token, user })
    get().connectWS()
  },

  logout() {
    localStorage.removeItem('fs_token')
    localStorage.removeItem('fs_user')
    get().ws?.close()
    set({ token:null, user:null, ws:null, guards:[], activeAlarms:[], alarmModal:null })
  },

  closeAlarmModal: () => set({ alarmModal: null }),
  openAlarmModal:  (a) => { set({ alarmModal: a }); playAlarmSound(a?.post_name) },
}))

function _sum(posts) {
  // Suporta tanto formato antigo (vigilantes) quanto novo (postos)
  const isPostFormat = posts.length > 0 && posts[0].post_id !== undefined
  if (isPostFormat) {
    return {
      alarm:   posts.filter(p => p.status==='alarm').length,
      warning: posts.filter(p => p.status==='warning').length,
      present: posts.filter(p => p.status==='covered').length,
      total:   posts.length,
    }
  }
  return {
    alarm:   posts.filter(g => g.status==='alarm').length,
    warning: posts.filter(g => g.status==='warning').length,
    present: posts.filter(g => g.status==='present').length,
    total:   posts.length,
  }
}
