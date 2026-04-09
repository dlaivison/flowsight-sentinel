import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useFlowStore } from '../../store'
import { acknowledgeAlarm, snoozeAlarm } from '../../api'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1C2128', border:'1px solid #30363D', borderRadius:6, padding:'6px 10px', fontSize:11 }}>
      <div style={{ color:'#8B949E' }}>{label}</div>
      <div style={{ color:'#E6EDF3', fontWeight:600 }}>{payload[0].value} alarmes</div>
    </div>
  )
}

function absTime(seconds) {
  if (!seconds && seconds !== 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`
  return `${Math.floor(m/60)}h ${m%60}min`
}

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

export default function AlarmModal() {
  const { alarmModal, closeAlarmModal } = useFlowStore()
  const [loading, setSaving] = useState(false)

  const handleAck = useCallback(async () => {
    if (!alarmModal) return
    setSaving(true)
    try { await acknowledgeAlarm(alarmModal.id); closeAlarmModal() }
    finally { setSaving(false) }
  }, [alarmModal, closeAlarmModal])

  const handleSnooze = useCallback(async (min) => {
    if (!alarmModal) return
    setSaving(true)
    try { await snoozeAlarm(alarmModal.id, min); closeAlarmModal() }
    finally { setSaving(false) }
  }, [alarmModal, closeAlarmModal])

  if (!alarmModal) return null

  const absenceSec = alarmModal.absence_seconds || (alarmModal.absence_minutes || 0) * 60
  const threshold  = alarmModal.threshold_seconds || (alarmModal.threshold_minutes || 1) * 60
  const ago        = alarmModal.triggered_at
    ? format(new Date(alarmModal.triggered_at), "dd/MM/yyyy 'às' HH:mm:ss")
    : ''
  const guards = alarmModal.guards || []

  return (
    <div style={{
      position:'fixed', inset:0,
      background:'rgba(0,0,0,0.8)',
      backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, padding:16,
    }}>
      <div style={{
        background:'var(--bg-secondary)',
        border:'2px solid rgba(255,68,68,0.5)',
        borderRadius:'var(--radius-lg)',
        width:'100%', maxWidth:560,
        animation:'fadeIn .25s ease, glow-red 2s ease-in-out infinite',
        boxShadow:'0 0 40px rgba(255,68,68,0.2), 0 24px 48px rgba(0,0,0,0.6)',
        overflow:'hidden',
      }}>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px',
          background:'rgba(255,68,68,0.08)',
          borderBottom:'1px solid rgba(255,68,68,0.2)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:38, height:38, borderRadius:10,
              background:'rgba(255,68,68,0.15)',
              border:'1px solid rgba(255,68,68,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18,
            }}>⚠</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
                Posto Descoberto
              </div>
              <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{ago}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:6,
              background:'rgba(255,68,68,0.15)', border:'1px solid rgba(255,68,68,0.3)',
              borderRadius:20, padding:'5px 12px',
              fontSize:13, fontWeight:700, color:'#FF4444',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {absTime(absenceSec)}
            </div>
            <button onClick={closeAlarmModal} style={{
              width:28, height:28, borderRadius:6,
              background:'var(--bg-hover)', border:'1px solid var(--border)',
              color:'var(--text-secondary)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:14, cursor:'pointer',
            }}>✕</button>
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Info do posto */}
          <div style={{
            background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
            borderRadius:'var(--radius-md)', padding:'14px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{
                width:40, height:40, borderRadius:10, flexShrink:0,
                background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>
                  {alarmModal.post_name}
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                  {alarmModal.floor || '—'}
                </div>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Sem vigilante há</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#FF4444', marginTop:2 }}>
                  {absTime(absenceSec)}
                </div>
              </div>
            </div>

            {/* Última detecção */}
            {alarmModal.last_guard_name && (
              <div style={{
                background:'var(--bg-primary)', borderRadius:'var(--radius-sm)',
                padding:'8px 10px', fontSize:11, color:'var(--text-muted)',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Última detecção: <span style={{ color:'var(--text-secondary)', fontWeight:500 }}>
                  {alarmModal.last_guard_name}
                </span>
                {alarmModal.last_detected_at && (
                  <span> às {format(new Date(alarmModal.last_detected_at), 'HH:mm:ss')}</span>
                )}
              </div>
            )}
          </div>

          {/* Vigilantes do posto */}
          {guards.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                Vigilantes deste posto
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {guards.map(g => (
                  <div key={g.guard_id} style={{
                    display:'flex', alignItems:'center', gap:10,
                    background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
                    borderRadius:'var(--radius-sm)', padding:'8px 12px',
                  }}>
                    <div style={{
                      width:30, height:30, borderRadius:'50%', flexShrink:0,
                      background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, color:'#FF4444', overflow:'hidden',
                    }}>
                      {g.photo_url
                        ? <img src={g.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : initials(g.guard_name)
                      }
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{g.guard_name}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {g.badge_number || '—'}</div>
                    </div>
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
                      background:'rgba(255,68,68,0.1)', color:'#FF4444',
                    }}>Ausente</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de progresso */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:5 }}>
              <span>Tempo sem cobertura</span>
              <span>Limite: {absTime(threshold)}</span>
            </div>
            <div style={{ height:4, borderRadius:2, background:'var(--bg-hover)', overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:2, background:'#FF4444',
                width:`${Math.min(100, (absenceSec / threshold) * 100)}%`,
                boxShadow:'0 0 8px rgba(255,68,68,0.6)',
                transition:'width .5s',
              }}/>
            </div>
          </div>

          {/* Botões */}
          <div style={{ display:'flex', gap:8 }}>
            {[['Adiar 10min', 10], ['Adiar 30min', 30]].map(([label, min]) => (
              <button key={min} onClick={() => handleSnooze(min)} disabled={loading} style={{
                flex:1, padding:'11px', borderRadius:'var(--radius-sm)',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:13, fontWeight:500,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                cursor:'pointer', transition:'all .15s',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {label}
              </button>
            ))}
            <button onClick={handleAck} disabled={loading} style={{
              flex:2, padding:'11px', borderRadius:'var(--radius-sm)',
              background: loading ? 'var(--bg-hover)' : 'linear-gradient(135deg,#00D084,#00A86B)',
              border:'none', color: loading ? 'var(--text-muted)' : '#000',
              fontSize:13, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(0,208,132,0.3)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {loading ? 'Aguarde...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
