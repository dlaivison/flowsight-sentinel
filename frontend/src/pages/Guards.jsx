import { useState, useEffect, useCallback } from 'react'
import { getGuards, createGuard, updateGuard, getGuardHistory,
         getWatchlistPois, getPosts, assignGuardToPost, getPoisGallery,
         getShiftSchedule, getActiveShift } from '../api'

const STATUS_COLORS = {
  present:  { color:'#00D084', bg:'rgba(0,208,132,0.1)',  label:'Presente'  },
  warning:  { color:'#F0A500', bg:'rgba(240,165,0,0.1)',  label:'Atenção'   },
  alarm:    { color:'#FF4444', bg:'rgba(255,68,68,0.1)',  label:'Ausente'   },
  active:   { color:'#00D084', bg:'rgba(0,208,132,0.1)',  label:'Ativo'     },
  day_off:  { color:'#8B949E', bg:'rgba(139,148,158,0.1)',label:'Folga'     },
  vacation: { color:'#58A6FF', bg:'rgba(88,166,255,0.1)', label:'Férias'    },
  sick:     { color:'#F0A500', bg:'rgba(240,165,0,0.1)',  label:'Afastado'  },
  absent:   { color:'#FF4444', bg:'rgba(255,68,68,0.1)',  label:'Falta'     },
  off:      { color:'#8B949E', bg:'rgba(139,148,158,0.1)',label:'Fora'      },
}

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

// ─── PAINEL DE VIGILANTES ────────────────────────────────────────────────────
function GuardPanel() {
  const [guards,    setGuards]    = useState([])
  const [schedule,  setSchedule]  = useState(null)
  const [activeShift, setActiveShift] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPost,   setFilterPost]   = useState('all')
  const [posts,     setPosts]     = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [guardsData, schedData, shiftData, postsData] = await Promise.all([
        getGuards(),
        getShiftSchedule(),
        getActiveShift(),
        getPosts(),
      ])
      setGuards(guardsData)
      setSchedule(schedData.data || schedData)
      setActiveShift(shiftData.data || shiftData)
      setPosts(postsData)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Monta mapa de status do turno por guard_id
  const scheduleMap = {}
  if (schedule?.shifts) {
    schedule.shifts.forEach(shift => {
      shift.scheduled?.forEach(s => {
        scheduleMap[s.guard_id] = {
          status:    s.status,
          post_id:   s.post_id,
          post_name: s.post_name,
          shift_name: shift.name,
          is_current: shift.is_current,
        }
      })
    })
  }

  // Enriquece guards com dados do turno
  const enriched = guards.map(g => {
    const sched = scheduleMap[g.id]
    return {
      ...g,
      shift_status: sched?.status || null,
      shift_name:   sched?.shift_name || null,
      post_name:    sched?.post_name || g.post_name || null,
      is_current:   sched?.is_current || false,
    }
  })

  // Filtros
  const allPosts = ['all', ...new Set(enriched.map(g => g.post_name).filter(Boolean))]
  const allStatuses = ['all', 'active', 'day_off', 'vacation', 'sick', 'absent']

  const filtered = enriched.filter(g => {
    if (filterStatus !== 'all' && g.shift_status !== filterStatus) return false
    if (filterPost !== 'all' && g.post_name !== filterPost) return false
    return true
  })

  // KPIs
  const kpis = {
    total:    enriched.length,
    active:   enriched.filter(g => g.shift_status === 'active').length,
    off:      enriched.filter(g => ['day_off','vacation','sick','absent'].includes(g.shift_status)).length,
    no_shift: enriched.filter(g => !g.shift_status).length,
  }

  if (loading) return <div style={{ padding:40, color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Turno ativo */}
      {activeShift && (
        <div style={{ background:'var(--bg-card)', border:'1px solid rgba(0,208,132,0.2)', borderRadius:'var(--radius-md)', padding:'10px 16px', display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#00D084', animation:'pulse-green 1.5s infinite' }}/>
          <span style={{ fontWeight:600, color:'var(--green)' }}>Turno ativo:</span>
          <span style={{ color:'var(--text-secondary)' }}>{activeShift.name} · {activeShift.start_time?.slice(0,5)} → {activeShift.end_time?.slice(0,5)}</span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Total',        value:kpis.total,    color:'#58A6FF' },
          { label:'Ativos',       value:kpis.active,   color:'#00D084' },
          { label:'Ausentes',     value:kpis.off,      color:'#8B949E' },
          { label:'Sem escala',   value:kpis.no_shift, color:'#F0A500' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--bg-secondary)', border:`1px solid ${k.color}33`, borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
            <div style={{ fontSize:26, fontWeight:700, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Status:</span>
          {[['all','Todos'],['active','Ativo'],['day_off','Folga'],['vacation','Férias'],['sick','Afastado'],['absent','Falta']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)} style={{
              padding:'4px 10px', borderRadius:12, fontSize:11, fontWeight:600,
              border:'1px solid', cursor:'pointer',
              borderColor: filterStatus===v ? 'var(--green)' : 'var(--border)',
              background:  filterStatus===v ? 'rgba(0,208,132,0.1)' : 'transparent',
              color:       filterStatus===v ? 'var(--green)' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
        </div>
        {posts.length > 0 && (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Posto:</span>
            <select value={filterPost} onChange={e=>setFilterPost(e.target.value)} style={{ padding:'4px 8px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-secondary)', fontSize:11, outline:'none' }}>
              <option value="all">Todos os postos</option>
              {posts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="">Sem posto</option>
            </select>
          </div>
        )}
        <button onClick={load} style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}>↺ Atualizar</button>
      </div>

      {/* Tabela */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr', padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-card)' }}>
          {['Vigilante','Posto','Turno','Status','Última det.'].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding:32, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>Nenhum vigilante encontrado</div>
        )}

        {filtered.map((g, i) => {
          const st = STATUS_COLORS[g.shift_status] || STATUS_COLORS.off
          const absence = STATUS_COLORS[g.status] || STATUS_COLORS.present
          return (
            <div key={g.id} style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr', padding:'12px 16px', borderBottom: i < filtered.length-1 ? '1px solid var(--border-subtle)' : 'none', alignItems:'center', transition:'background .15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

              {/* Vigilante */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:`${absence.color}22`, border:`1.5px solid ${absence.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:absence.color, overflow:'hidden' }}>
                  {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(g.name)}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{g.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {g.badge_number||'—'}</div>
                </div>
              </div>

              {/* Posto */}
              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                {g.post_name || <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Sem posto</span>}
              </div>

              {/* Turno */}
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                {g.shift_name || <span style={{ fontStyle:'italic' }}>—</span>}
                {g.is_current && <span style={{ marginLeft:4, color:'#00D084', fontSize:9 }}>●</span>}
              </div>

              {/* Status */}
              <div>
                {g.shift_status ? (
                  <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12, background:st.bg, color:st.color, border:`1px solid ${st.color}33` }}>
                    {st.label}
                  </span>
                ) : (
                  <span style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>Sem escala</span>
                )}
              </div>

              {/* Última detecção */}
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                {fmt(g.last_detected_at)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── GALERIA DE POIs (cadastro) ──────────────────────────────────────────────
const inp = { padding:'8px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  )
}

function EditModal({ guard, onClose, onSave }) {
  const [form, setForm] = useState({ name:guard.name||'', badge_number:guard.badge_number||'', group_name:guard.group_name||'' })
  const [posts,   setPosts]   = useState([])
  const [postId,  setPostId]  = useState(guard.post_id||'')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { getPosts().then(setPosts).catch(() => {}) }, [])

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      await updateGuard(guard.id, form)
      if (postId && postId !== guard.post_id) await assignGuardToPost(postId, guard.id)
      onSave()
    } catch(e) { setError(e.response?.data?.error||'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:440, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#58A6FF', overflow:'hidden', flexShrink:0 }}>
            {guard.photo_url ? <img src={guard.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(guard.name)}
          </div>
          <span style={{ fontSize:15, fontWeight:700, flex:1 }}>Editar vigilante</span>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <Field label="Nome *"><input style={{ ...inp, width:'100%' }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Matrícula"><input style={inp} value={form.badge_number} onChange={e=>setForm(f=>({...f,badge_number:e.target.value}))} placeholder="VIG-001"/></Field>
            <Field label="Grupo"><input style={inp} value={form.group_name} onChange={e=>setForm(f=>({...f,group_name:e.target.value}))}/></Field>
          </div>
          <Field label="Posto atual">
            <select style={{ ...inp, width:'100%' }} value={postId} onChange={e=>setPostId(e.target.value)}>
              <option value="">Sem posto</option>
              {posts.map(p => <option key={p.id} value={p.id}>{p.name} — {p.floor||'s/andar'}</option>)}
            </select>
          </Field>
          {error && <div style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'#FF4444' }}>{error}</div>}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function RegisterModal({ onClose, onSave }) {
  const [pois,     setPois]     = useState([])
  const [posts,    setPosts]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [selected, setSelected] = useState(null)
  const [form,     setForm]     = useState({ name:'', badge_number:'', group_name:'', post_id:'' })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    Promise.all([getWatchlistPois(), getPosts()])
      .then(([wlRes, postsData]) => {
        const wlData = wlRes.data || wlRes
        if (wlData.configured) setPois(wlData.pois || [])
        else setError('Watchlist não configurada. Configure em Parâmetros.')
        setPosts(postsData)
      })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = pois.filter(p => {
    if (filter === 'available' && p.registered) return false
    if (filter === 'registered' && !p.registered) return false
    return !search || p.display_name.toLowerCase().includes(search.toLowerCase())
  })

  const save = async () => {
    if (!selected) { setError('Selecione um POI'); return }
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const res = await createGuard({
        forsight_poi_id: selected.poi_id,
        name:            form.name,
        badge_number:    form.badge_number,
        group_name:      form.group_name,
        photo_url:       selected.display_img ? `data:image/jpeg;base64,${selected.display_img}` : null,
      })
      const guard = res.data || res
      if (form.post_id && guard?.id) await assignGuardToPost(form.post_id, guard.id)
      onSave()
    } catch(e) { setError(e.response?.data?.error||'Erro ao cadastrar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:720, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>Selecionar POI do Forsight</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Clique na foto do vigilante para cadastrá-lo no Sentinel</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>Carregando POIs...</div>
        ) : error && pois.length === 0 ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#FF4444', fontSize:13 }}>{error}</div>
        ) : (
          <>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:8, alignItems:'center' }}>
              <input style={{ ...inp, flex:1 }} placeholder="Buscar por nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
              {[['all',`Todos ${pois.length}`],['available',`Disponíveis ${pois.filter(p=>!p.registered).length}`],['registered',`Cadastrados ${pois.filter(p=>p.registered).length}`]].map(([v,l]) => (
                <button key={v} onClick={()=>setFilter(v)} style={{ padding:'7px 14px', borderRadius:'var(--radius-sm)', border:`1px solid ${filter===v?'var(--green)':'var(--border)'}`, background:filter===v?'rgba(0,208,132,0.1)':'transparent', color:filter===v?'var(--green)':'var(--text-secondary)', fontSize:12, fontWeight:filter===v?700:400, cursor:'pointer', whiteSpace:'nowrap' }}>{l}</button>
              ))}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:10, alignContent:'start' }}>
              {filtered.map(poi => (
                <div key={poi.poi_id} onClick={() => { if (!poi.registered) { setSelected(poi); setForm(f=>({...f,name:poi.display_name})) }}}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:10, borderRadius:'var(--radius-md)', cursor:poi.registered?'default':'pointer', border:`2px solid ${selected?.poi_id===poi.poi_id?'#00D084':poi.registered?'rgba(88,166,255,0.2)':'var(--border-subtle)'}`, background:selected?.poi_id===poi.poi_id?'rgba(0,208,132,0.08)':poi.registered?'rgba(88,166,255,0.04)':'var(--bg-card)', position:'relative', transition:'all .15s', opacity:poi.registered?0.7:1 }}>
                  {selected?.poi_id===poi.poi_id && <div style={{ position:'absolute', top:4, right:4, width:16, height:16, borderRadius:'50%', background:'#00D084', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>✓</div>}
                  {poi.registered && <div style={{ position:'absolute', top:4, left:4, fontSize:9, background:'rgba(88,166,255,0.8)', color:'#fff', padding:'1px 5px', borderRadius:3, fontWeight:600 }}>Cadastrado</div>}
                  <div style={{ width:60, height:60, borderRadius:'50%', overflow:'hidden', background:'var(--bg-hover)', flexShrink:0 }}>
                    {poi.display_img ? <img src={`data:image/jpeg;base64,${poi.display_img}`} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'var(--text-muted)'}}>{initials(poi.display_name)}</div>}
                  </div>
                  <div style={{ fontSize:10, fontWeight:500, textAlign:'center', color:'var(--text-secondary)', lineHeight:1.3 }}>{poi.display_name}</div>
                  <div style={{ fontSize:9, color:'var(--text-muted)', fontFamily:'monospace' }}>{poi.poi_id.slice(0,8)}...</div>
                </div>
              ))}
            </div>

            {selected && (
              <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-card)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
                    {selected.display_img ? <img src={`data:image/jpeg;base64,${selected.display_img}`} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : <div style={{width:'100%',height:'100%',background:'var(--bg-hover)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'var(--text-muted)'}}>{initials(selected.display_name)}</div>}
                  </div>
                  <div style={{ flex:'1 1 140px', minWidth:0 }}>
                    <label style={{ display:'block', fontSize:9, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:4 }}>Nome *</label>
                    <input style={{ ...inp, width:'100%' }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
                  </div>
                  <div style={{ flex:'0 0 90px' }}>
                    <label style={{ display:'block', fontSize:9, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:4 }}>Matrícula</label>
                    <input style={inp} value={form.badge_number} onChange={e=>setForm(f=>({...f,badge_number:e.target.value}))} placeholder="VIG-001"/>
                  </div>
                  <div style={{ flex:'0 0 110px' }}>
                    <label style={{ display:'block', fontSize:9, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:4 }}>Grupo</label>
                    <input style={inp} value={form.group_name} onChange={e=>setForm(f=>({...f,group_name:e.target.value}))} placeholder="Ex: Vigilantes Piso 1"/>
                  </div>
                  <div style={{ flex:'0 0 160px' }}>
                    <label style={{ display:'block', fontSize:9, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:4 }}>Atribuir ao posto</label>
                    <select style={{ ...inp, width:'100%' }} value={form.post_id} onChange={e=>setForm(f=>({...f,post_id:e.target.value}))}>
                      <option value="">Sem posto</option>
                      {posts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                {error && <div style={{ marginTop:8, fontSize:11, color:'#FF4444' }}>{error}</div>}
              </div>
            )}
          </>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
            {selected ? `POI selecionado: ${selected.display_name}` : 'Clique em um POI para selecionar'}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
            <button onClick={save} disabled={saving||!selected} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:selected?'linear-gradient(135deg,#00D084,#00A86B)':'var(--bg-hover)', color:selected?'#000':'var(--text-muted)', fontSize:13, fontWeight:700, cursor:selected?'pointer':'not-allowed' }}>{saving?'Cadastrando...':'Cadastrar vigilante'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── LISTA DE VIGILANTES CADASTRADOS ────────────────────────────────────────
function GuardList({ onEdit }) {
  const [guards,  setGuards]  = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGuards(await getGuards()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>

  return (
    <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      {guards.length === 0 && (
        <div style={{ padding:32, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>Nenhum vigilante cadastrado</div>
      )}
      {guards.map((g, i) => (
        <div key={g.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i < guards.length-1 ? '1px solid var(--border-subtle)' : 'none', transition:'background .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#58A6FF', overflow:'hidden', flexShrink:0 }}>
            {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(g.name)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{g.name}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Mat: {g.badge_number||'—'} · {g.group_name||'Sem grupo'}</div>
          </div>
          <button onClick={() => onEdit(g)} style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Editar</button>
        </div>
      ))}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function Guards() {
  const [tab,          setTab]          = useState('panel')
  const [showRegister, setShowRegister] = useState(false)
  const [editGuard,    setEditGuard]    = useState(null)
  const [refreshKey,   setRefreshKey]   = useState(0)

  const reload = () => setRefreshKey(k => k+1)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Vigilantes</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Painel operacional e cadastro de vigilantes</div>
        </div>
        {tab === 'register' && (
          <button onClick={() => setShowRegister(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <span style={{ fontSize:16 }}>+</span> Novo vigilante
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', padding:'0 24px' }}>
        {[['panel','📊 Painel'],['register','👤 Cadastro']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'10px 20px', border:'none', background:'transparent',
            color: tab===key ? 'var(--green)' : 'var(--text-muted)',
            fontSize:13, fontWeight: tab===key ? 700 : 400, cursor:'pointer',
            borderBottom: tab===key ? '2px solid var(--green)' : '2px solid transparent',
            marginBottom:-1,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {tab === 'panel' && <GuardPanel key={refreshKey}/>}
        {tab === 'register' && <GuardList key={refreshKey} onEdit={setEditGuard}/>}
      </div>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSave={() => { setShowRegister(false); reload() }}/>}
      {editGuard && <EditModal guard={editGuard} onClose={() => setEditGuard(null)} onSave={() => { setEditGuard(null); reload() }}/>}
    </div>
  )
}
