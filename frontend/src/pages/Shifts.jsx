import { useState, useEffect, useCallback } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  getShiftTypes, createShiftType, updateShiftType, deleteShiftType,
  getShiftSchedule, saveShiftSchedule, removeShiftSchedule,
  getPosts
} from '../api'

const STATUS_OPTIONS = [
  { value:'active',   label:'Ativo',    color:'#00D084', icon:'●' },
  { value:'day_off',  label:'Folga',    color:'#8B949E', icon:'○' },
  { value:'vacation', label:'Férias',   color:'#58A6FF', icon:'○' },
  { value:'sick',     label:'Afastado', color:'#F0A500', icon:'○' },
  { value:'absent',   label:'Falta',    color:'#FF4444', icon:'○' },
]

const getStatus = v => STATUS_OPTIONS.find(s => s.value === v) || STATUS_OPTIONS[0]

const inp = {
  padding:'8px 12px', background:'var(--bg-primary)',
  border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
  color:'var(--text-primary)', fontSize:12, outline:'none', width:'100%',
}

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

// ─── Modal de tipo de turno ──────────────────────────────────────────────────
function ShiftTypeModal({ shiftType, onClose, onSave }) {
  const isEdit = !!shiftType?.id
  const [form, setForm] = useState({
    name:       shiftType?.name       || '',
    start_time: shiftType?.start_time?.slice(0,5) || '06:00',
    end_time:   shiftType?.end_time?.slice(0,5)   || '18:00',
    color:      shiftType?.color      || '#58A6FF',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      if (isEdit) await updateShiftType(shiftType.id, form)
      else        await createShiftType(form)
      onSave()
    } catch(e) { setError(e.response?.data?.error || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:400, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <span style={{ fontSize:15, fontWeight:700 }}>{isEdit ? 'Editar turno' : 'Novo turno'}</span>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Nome *</label>
            <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Manhã, Tarde, Noite"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Início</label>
              <input type="time" style={inp} value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Fim</label>
              <input type="time" style={inp} value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Cor</label>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{ width:40, height:32, border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', background:'none', padding:2 }}/>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{form.color}</span>
              <div style={{ flex:1, height:8, borderRadius:4, background:form.color, opacity:0.7 }}/>
            </div>
          </div>
          {error && <div style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'#FF4444' }}>{error}</div>}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal para escalar vigilante ────────────────────────────────────────────
function ScheduleModal({ guard, shiftId, date, posts, existing, onClose, onSave }) {
  const [status,  setStatus]  = useState(existing?.status  || 'active')
  const [postId,  setPostId]  = useState(existing?.post_id || '')
  const [notes,   setNotes]   = useState(existing?.notes   || '')
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveShiftSchedule({
        shift_type_id: shiftId,
        guard_id:      guard.id || guard.guard_id,
        post_id:       status === 'active' ? (postId || null) : null,
        date,
        status,
        notes,
      })
      onSave()
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:380, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,208,132,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#00D084', overflow:'hidden', flexShrink:0 }}>
              {guard.photo_url ? <img src={guard.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(guard.name||guard.guard_name)}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>{guard.name||guard.guard_name}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {guard.badge_number||'—'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:8 }}>Status no turno</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {STATUS_OPTIONS.map(s => (
                <label key={s.value} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer', border:`1px solid ${status===s.value ? s.color+'44' : 'var(--border-subtle)'}`, background:status===s.value ? s.color+'11' : 'var(--bg-card)' }}>
                  <input type="radio" name="status" value={s.value} checked={status===s.value} onChange={()=>setStatus(s.value)} style={{ accentColor:s.color }}/>
                  <span style={{ fontSize:13, color:status===s.value ? s.color : 'var(--text-secondary)', fontWeight:status===s.value?600:400 }}>{s.icon} {s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {status === 'active' && (
            <div>
              <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Posto</label>
              <select style={inp} value={postId} onChange={e=>setPostId(e.target.value)}>
                <option value="">Sem posto definido</option>
                {posts.map(p => <option key={p.id} value={p.id}>{p.name} — {p.floor||'s/andar'}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Observações</label>
            <input style={inp} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional"/>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 18px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de vigilante na escala ─────────────────────────────────────────────
function GuardRow({ guard, onEdit }) {
  const st = getStatus(guard.status)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)', cursor:'pointer', transition:'background .15s' }}
      onClick={onEdit}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:`${st.color}22`, border:`1.5px solid ${st.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:st.color, overflow:'hidden', flexShrink:0 }}>
        {guard.photo_url ? <img src={guard.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(guard.guard_name||guard.name)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{guard.guard_name||guard.name}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
          {guard.post_name ? `📍 ${guard.post_name}` : 'Sem posto'}
          {guard.badge_number ? ` · Mat: ${guard.badge_number}` : ''}
        </div>
      </div>
      <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12, background:`${st.color}18`, color:st.color, border:`1px solid ${st.color}33`, flexShrink:0 }}>
        {st.icon} {st.label}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </div>
  )
}

// ─── Bloco de turno na escala ─────────────────────────────────────────────────
// ─── Modal para adicionar vigilante ao turno ─────────────────────────────────
function AddGuardModal({ shift, date, posts, onClose, onSave }) {
  const [selected, setSelected] = useState(null)
  const [postId,   setPostId]   = useState('')
  const [saving,   setSaving]   = useState(false)

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await saveShiftSchedule({
        shift_type_id: shift.id,
        guard_id:      selected.id,
        post_id:       postId || null,
        date,
        status:        'active',
      })
      onSave()
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:440, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)', background:`${shift.color}08` }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>Adicionar ao turno {shift.name}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{date} · {shift.start_time.slice(0,5)} → {shift.end_time.slice(0,5)}</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:8 }}>Selecione o vigilante</label>
            {shift.unscheduled.length === 0 ? (
              <div style={{ padding:'16px', textAlign:'center', fontSize:12, color:'var(--text-muted)', background:'var(--bg-card)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-subtle)' }}>
                Todos os vigilantes já estão escalados neste turno
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                {shift.unscheduled.map(g => (
                  <label key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                    border:`1px solid ${selected?.id===g.id ? 'rgba(0,208,132,0.4)' : 'var(--border-subtle)'}`,
                    background: selected?.id===g.id ? 'rgba(0,208,132,0.08)' : 'var(--bg-card)' }}>
                    <input type="radio" name="guard" checked={selected?.id===g.id} onChange={()=>setSelected(g)} style={{ accentColor:'#00D084' }}/>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#58A6FF', overflow:'hidden', flexShrink:0 }}>
                      {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : g.name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{g.name}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {g.badge_number||'—'}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selected && (
            <div>
              <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Posto (opcional)</label>
              <select value={postId} onChange={e=>setPostId(e.target.value)} style={{ width:'100%', padding:'8px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                <option value="">Sem posto específico</option>
                {posts.map(p => <option key={p.id} value={p.id}>{p.name} — {p.floor||'s/andar'}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving||!selected} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:selected?'linear-gradient(135deg,#00D084,#00A86B)':'var(--bg-hover)', color:selected?'#000':'var(--text-muted)', fontSize:13, fontWeight:700, cursor:selected?'pointer':'not-allowed' }}>
            {saving ? 'Adicionando...' : '+ Adicionar ao turno'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bloco de turno na escala ─────────────────────────────────────────────────
function ShiftBlock({ shift, date, posts, onRefresh }) {
  const [editModal, setEditModal] = useState(null)
  const [addModal,  setAddModal]  = useState(false)
  const activeCount = shift.scheduled.filter(g => g.status === 'active').length

  const handleRemove = async (scheduleId) => {
    if (!confirm('Remover este vigilante do turno?')) return
    try { await removeShiftSchedule(scheduleId); onRefresh() }
    catch(e) { console.error(e) }
  }

  return (
    <div style={{ background:'var(--bg-secondary)', border:`1px solid ${shift.is_current ? shift.color+'44' : 'var(--border-subtle)'}`, borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow: shift.is_current ? `0 0 20px ${shift.color}15` : 'none' }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:10, background: shift.is_current ? `${shift.color}08` : 'transparent' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:shift.color, flexShrink:0, boxShadow: shift.is_current ? `0 0 8px ${shift.color}` : 'none' }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>{shift.name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{shift.start_time.slice(0,5)} → {shift.end_time.slice(0,5)}</div>
        </div>
        {shift.is_current && (
          <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:12, background:`${shift.color}20`, color:shift.color, border:`1px solid ${shift.color}40` }}>● TURNO ATIVO</span>
        )}
        <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:8 }}>{activeCount} ativo(s) · {shift.scheduled.length} total</span>
        <button onClick={() => setAddModal(true)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:'var(--radius-sm)', border:`1px solid ${shift.color}44`, background:`${shift.color}10`, color:shift.color, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
          + Adicionar
        </button>
      </div>
      <div>
        {shift.scheduled.length === 0 ? (
          <div style={{ padding:'24px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
            Nenhum vigilante escalado —
            <button onClick={() => setAddModal(true)} style={{ marginLeft:6, color:'var(--green)', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600 }}>+ Adicionar</button>
          </div>
        ) : shift.scheduled.map(g => (
          <div key={g.id||g.guard_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom:'1px solid var(--border-subtle)', transition:'background .15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#58A6FF', overflow:'hidden', flexShrink:0 }}>
              {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : g.guard_name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{g.guard_name}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>{g.post_name ? `📍 ${g.post_name}` : 'Sem posto'} · Mat: {g.badge_number||'—'}</div>
            </div>
            {(() => { const st = STATUS_OPTIONS.find(s=>s.value===g.status)||STATUS_OPTIONS[0]; return (
              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12, background:`${st.color}18`, color:st.color, border:`1px solid ${st.color}33`, flexShrink:0 }}>{st.icon} {st.label}</span>
            )})()}
            <button onClick={() => setEditModal(g)} style={{ padding:'4px 10px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:11, cursor:'pointer' }}>Editar</button>
            <button onClick={() => handleRemove(g.id)} style={{ padding:'4px 10px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(255,68,68,0.3)', background:'rgba(255,68,68,0.08)', color:'#FF4444', fontSize:11, cursor:'pointer' }}>Remover</button>
          </div>
        ))}
      </div>
      {addModal  && <AddGuardModal shift={shift} date={date} posts={posts} onClose={() => setAddModal(false)} onSave={() => { setAddModal(false); onRefresh() }}/>}
      {editModal && <ScheduleModal guard={editModal} shiftId={shift.id} date={date} posts={posts} existing={editModal} onClose={() => setEditModal(null)} onSave={() => { setEditModal(null); onRefresh() }}/>}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Shifts() {
  const [tab,         setTab]         = useState('schedule') // schedule | config
  const [shiftTypes,  setShiftTypes]  = useState([])
  const [schedule,    setSchedule]    = useState(null)
  const [posts,       setPosts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [typeModal,   setTypeModal]   = useState(null)  // null | {} | {id,...}
  const [deleting,    setDeleting]    = useState(null)

  const loadTypes = useCallback(async () => {
    const res = await getShiftTypes()
    setShiftTypes(res.data || res || [])
  }, [])

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, postsData] = await Promise.all([
        getShiftSchedule(date),
        getPosts(),
      ])
      setSchedule(schedRes.data || schedRes)
      setPosts(postsData)
    } finally { setLoading(false) }
  }, [date])

  useEffect(() => { loadTypes() }, [loadTypes])
  useEffect(() => { if (tab === 'schedule') loadSchedule() }, [tab, loadSchedule])

  const handleDeleteType = async (id) => {
    if (!confirm('Remover este turno?')) return
    setDeleting(id)
    try { await deleteShiftType(id); await loadTypes() }
    catch(e) { alert(e.response?.data?.error || 'Erro ao remover') }
    finally { setDeleting(null) }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
        <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Turnos</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Gestão de escalas e configuração de turnos</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', padding:'0 24px' }}>
        {[['schedule','📅 Escala do Dia'],['config','⚙ Configurar Turnos']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'10px 20px', border:'none', background:'transparent',
            color: tab===key ? 'var(--green)' : 'var(--text-muted)',
            fontSize:13, fontWeight: tab===key ? 700 : 400, cursor:'pointer',
            borderBottom: tab===key ? '2px solid var(--green)' : '2px solid transparent',
            marginBottom:-1,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* ─── ABA ESCALA ─── */}
        {tab === 'schedule' && (
          <>
            {/* Navegação de datas */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={() => setDate(d => addDays(parseISO(d),-1).toISOString().split('T')[0])}
                style={{ padding:'7px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>← Anterior</button>
              <button onClick={() => setDate(today)}
                style={{ padding:'7px 14px', borderRadius:'var(--radius-sm)', border:`1px solid ${date===today?'var(--green)':'var(--border)'}`, background:date===today?'rgba(0,208,132,0.1)':'transparent', color:date===today?'var(--green)':'var(--text-secondary)', fontSize:12, fontWeight:700, cursor:'pointer' }}>Hoje</button>
              <button onClick={() => setDate(d => addDays(parseISO(d),1).toISOString().split('T')[0])}
                style={{ padding:'7px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Próximo →</button>
              <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginLeft:8 }}>
                {format(parseISO(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale:ptBR })}
              </span>
            </div>

            {loading ? (
              <div style={{ color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>
            ) : schedule?.shifts?.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>
                Nenhum turno configurado. Vá em "Configurar Turnos" para adicionar.
              </div>
            ) : (
              schedule?.shifts?.map(shift => (
                <ShiftBlock
                  key={shift.id}
                  shift={shift}
                  date={date}
                  posts={posts}
                  onRefresh={loadSchedule}
                />
              ))
            )}
          </>
        )}

        {/* ─── ABA CONFIGURAÇÃO ─── */}
        {tab === 'config' && (
          <>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setTypeModal({})} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                <span style={{ fontSize:16 }}>+</span> Novo turno
              </button>
            </div>

            {shiftTypes.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>
                Nenhum turno configurado ainda.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {shiftTypes.map(st => (
                  <div key={st.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)' }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:st.color, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600 }}>{st.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {st.start_time.slice(0,5)} → {st.end_time.slice(0,5)}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setTypeModal(st)} style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Editar</button>
                      <button onClick={() => handleDeleteType(st.id)} disabled={deleting===st.id} style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(255,68,68,0.3)', background:'rgba(255,68,68,0.08)', color:'#FF4444', fontSize:12, cursor:'pointer' }}>
                        {deleting===st.id ? '...' : 'Remover'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'12px 16px', fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
              ℹ Os turnos não podem ter horários sobrepostos. O sistema identifica automaticamente o turno ativo pelo horário atual.
            </div>
          </>
        )}
      </div>

      {typeModal !== null && (
        <ShiftTypeModal
          shiftType={typeModal?.id ? typeModal : null}
          onClose={() => setTypeModal(null)}
          onSave={() => { setTypeModal(null); loadTypes() }}
        />
      )}
    </div>
  )
}
