import { useState, useEffect } from 'react'
import { getAbsenceReasons, createJustification } from '../api'

export default function JustifyModal({ post, onClose, onSave }) {
  const [reasons,   setReasons]   = useState([])
  const [reasonId,  setReasonId]  = useState('')
  const [duration,  setDuration]  = useState(15)
  const [custom,    setCustom]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    getAbsenceReasons().then((res) => {
      const data = res.data || res || []
      setReasons(data)
      if (data?.length) {
        setReasonId(data[0].id)
        setDuration(data[0].default_minutes)
      }
    })
  }, [])

  const selectedReason = reasons.find(r => r.id === reasonId)

  const handleReasonChange = (id) => {
    setReasonId(id)
    const r = reasons.find(r => r.id === id)
    if (r) setDuration(r.default_minutes)
  }

  const save = async () => {
    if (!reasonId) { setError('Selecione um motivo'); return }
    setSaving(true)
    try {
      await createJustification({
        post_id:          post.post_id,
        reason_id:        reasonId,
        custom_reason:    selectedReason?.name === 'Outro' ? custom : null,
        duration_minutes: duration,
      })
      onSave()
    } catch(e) { setError(e.response?.data?.error || 'Erro ao registrar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:420, overflow:'hidden', boxShadow:'0 24px 48px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(88,166,255,0.05)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(88,166,255,0.15)', border:'1px solid rgba(88,166,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⏸</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Justificar Ausência</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{post.post_name} · {post.floor||'—'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Motivo */}
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:8 }}>Motivo</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {reasons.map(r => (
                <label key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                  border:`1px solid ${reasonId===r.id ? 'rgba(88,166,255,0.4)' : 'var(--border-subtle)'}`,
                  background: reasonId===r.id ? 'rgba(88,166,255,0.08)' : 'var(--bg-card)' }}>
                  <input type="radio" name="reason" value={r.id} checked={reasonId===r.id} onChange={()=>handleReasonChange(r.id)} style={{ accentColor:'#58A6FF' }}/>
                  <span style={{ flex:1, fontSize:13, color:reasonId===r.id?'var(--text-primary)':'var(--text-secondary)', fontWeight:reasonId===r.id?600:400 }}>{r.name}</span>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{r.default_minutes}min</span>
                </label>
              ))}
            </div>
          </div>
          {/* Campo livre se motivo = Outro */}
          {selectedReason?.name === 'Outro' && (
            <div>
              <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Descreva o motivo</label>
              <input style={{ width:'100%', padding:'8px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}
                value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Descreva o motivo..."/>
            </div>
          )}
          {/* Duração */}
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>
              Duração — {duration} minutos
            </label>
            <input type="range" min="5" max="120" step="5" value={duration}
              onChange={e=>setDuration(parseInt(e.target.value))}
              style={{ width:'100%', accentColor:'#58A6FF' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
              <span>5min</span><span>2h</span>
            </div>
          </div>
          {/* Info */}
          <div style={{ background:'rgba(88,166,255,0.08)', border:'1px solid rgba(88,166,255,0.2)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:11, color:'#58A6FF', display:'flex', alignItems:'center', gap:8 }}>
            <span>ℹ</span>
            <span>O posto ficará em status <strong>Justificado</strong> por {duration} minutos. Após esse período, o sistema retomará o monitoramento normal.</span>
          </div>
          {error && <div style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'#FF4444' }}>{error}</div>}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#58A6FF,#2D7DD2)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {saving ? 'Registrando...' : '⏸ Justificar ausência'}
          </button>
        </div>
      </div>
    </div>
  )
}
