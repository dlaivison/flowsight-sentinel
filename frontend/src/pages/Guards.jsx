import { useState, useEffect, useCallback } from 'react'
import { getGuards, createGuard, updateGuard, getGuardHistory, getPoisGallery, getWatchlistPois, getPosts, assignGuardToPost } from '../api'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format } from 'date-fns'

const STATUS = {
  present: { color:'#00D084', label:'PRESENTE' },
  warning: { color:'#F0A500', label:'ATENÇÃO'  },
  alarm:   { color:'#FF4444', label:'ALARME'   },
}
const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

const inp = { width:'100%', padding:'9px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:13, outline:'none' }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, subtitle, onClose, children, maxWidth=460 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, overflow:'hidden', boxShadow:'0 24px 48px rgba(0,0,0,0.5)', animation:'fadeIn .2s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Galeria de POIs do Forsight ───────────────────────────────
function POIGallery({ onClose, onSave }) {
  const [pois,     setPois]     = useState([])
  const [posts,    setPosts]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all') // all | available | registered
  const [selected, setSelected] = useState(null)
  const [form,     setForm]     = useState({ name:'', badge_number:'', group_name:'', post_id:'' })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    Promise.all([getWatchlistPois(), getPosts()])
      .then(([wlData, postsData]) => {
        // Se watchlist configurada, usa os POIs dela; senão cai no fallback geral
        if (wlData.configured) {
          if (wlData.pois.length === 0) {
            setError(wlData.message || 'Nenhum POI encontrado na watchlist configurada.')
          }
          setPois(wlData.pois)
        } else {
          // Sem watchlist configurada — avisa o operador
          setError('Watchlist não configurada. Configure em Parâmetros → Watchlist de Vigilantes.')
          setPois([])
        }
        setPosts(postsData)
      })
      .catch(() => setError('Erro ao carregar dados do Forsight'))
      .finally(() => setLoading(false))
  }, [])

  const selectPOI = (poi) => {
    if (poi.registered) return
    setSelected(poi)
    setForm(f => ({ ...f, name: poi.display_name }))
    setError('')
  }

  const save = async () => {
    if (!selected) { setError('Selecione um POI'); return }
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const guard = await createGuard({
        forsight_poi_id: selected.poi_id,
        name:            form.name,
        badge_number:    form.badge_number,
        group_name:      form.group_name,
        photo_url:       selected.display_img ? `data:image/jpeg;base64,${selected.display_img}` : null,
      })
      // Se selecionou um posto, atribui automaticamente
      if (form.post_id && guard?.id) {
        await assignGuardToPost(form.post_id, guard.id)
      }
      onSave()
    } catch(e) { setError(e.response?.data?.error || 'Erro ao cadastrar') }
    finally { setSaving(false) }
  }

  const filtered = pois.filter(p => {
    const matchSearch = p.display_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ? true : filter === 'available' ? !p.registered : p.registered
    return matchSearch && matchFilter
  })

  const available   = pois.filter(p => !p.registered).length
  const registered  = pois.filter(p =>  p.registered).length

  return (
    <Modal title="Selecionar POI do Forsight" subtitle="Clique na foto do vigilante para cadastrá-lo no Sentinel" onClose={onClose} maxWidth={680}>
      {/* Search + filtros */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={{ ...inp, paddingLeft:32, background:'var(--bg-card)' }} placeholder="Buscar por nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {[['all','Todos',pois.length],['available','Disponíveis',available],['registered','Cadastrados',registered]].map(([v,l,c]) => (
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'7px 12px', borderRadius:'var(--radius-sm)', fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: filter===v?'rgba(0,208,132,0.4)':'var(--border)', background: filter===v?'rgba(0,208,132,0.1)':'transparent', color: filter===v?'var(--green)':'var(--text-muted)', whiteSpace:'nowrap' }}>
            {l} <span style={{ background:'var(--bg-hover)', borderRadius:10, padding:'1px 6px', marginLeft:4 }}>{c}</span>
          </button>
        ))}
      </div>

      {/* Galeria */}
      <div style={{ maxHeight:320, overflowY:'auto', padding:'14px 20px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
            <div style={{ width:28, height:28, border:'2px solid var(--green)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
            Carregando {pois.length > 0 ? pois.length : ''} POIs do Forsight...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:12 }}>Nenhum POI encontrado</div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:10 }}>
          {filtered.map(poi => {
            const isSel  = selected?.poi_id === poi.poi_id
            const isReg  = poi.registered
            return (
              <div key={poi.poi_id}
                onClick={() => selectPOI(poi)}
                style={{
                  background: isSel ? 'rgba(0,208,132,0.1)' : isReg ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
                  border: `1px solid ${isSel ? '#00D084' : isReg ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)', padding:'12px 8px', textAlign:'center',
                  cursor: isReg ? 'not-allowed' : 'pointer', opacity: isReg ? 0.45 : 1,
                  transition:'all .15s', position:'relative',
                  boxShadow: isSel ? '0 0 12px rgba(0,208,132,0.25)' : 'none',
                }}
                onMouseEnter={e => { if (!isReg && !isSel) e.currentTarget.style.borderColor='rgba(0,208,132,0.3)' }}
                onMouseLeave={e => { if (!isReg && !isSel) e.currentTarget.style.borderColor='var(--border-subtle)' }}
              >
                {isSel && (
                  <div style={{ position:'absolute', top:6, right:6, width:18, height:18, borderRadius:'50%', background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#000', fontWeight:700 }}>✓</div>
                )}
                {isReg && (
                  <div style={{ position:'absolute', top:4, left:0, right:0, fontSize:8, color:'var(--text-muted)', textAlign:'center' }}>Cadastrado</div>
                )}

                {/* Foto ou iniciais */}
                <div style={{ width:56, height:56, borderRadius:'50%', margin:'0 auto 8px', overflow:'hidden', background: isSel?'rgba(0,208,132,0.2)':'rgba(88,166,255,0.1)', border:`2px solid ${isSel?'#00D084':'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {poi.display_img
                    ? <img src={`data:image/jpeg;base64,${poi.display_img}`} alt={poi.display_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <span style={{ fontSize:16, fontWeight:700, color: isSel?'#00D084':'#58A6FF' }}>{initials(poi.display_name)}</span>
                  }
                </div>

                <div style={{ fontSize:11, fontWeight:600, color: isReg?'var(--text-muted)':'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{poi.display_name}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)', fontFamily:'monospace', marginTop:2 }}>{poi.poi_id.slice(0,8)}...</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ padding:'8px 20px', borderTop:'1px solid var(--border-subtle)', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:16, fontSize:10, color:'var(--text-muted)' }}>
        {[['#00D084','Selecionado'],['#1C2128','Disponível'],['#21262D','Já cadastrado']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:c, border:'1px solid var(--border)' }}/>
            {l}
          </div>
        ))}
      </div>

      {/* Formulário de complemento (aparece ao selecionar) */}
      {selected && (
        <div style={{ padding:'14px 20px', background:'rgba(0,208,132,0.04)', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:14, alignItems:'flex-start' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', flexShrink:0, border:'2px solid var(--green)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,208,132,0.15)' }}>
            {selected.display_img
              ? <img src={`data:image/jpeg;base64,${selected.display_img}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:16, fontWeight:700, color:'var(--green)' }}>{initials(selected.display_name)}</span>
            }
          </div>
          <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:10 }}>
            <Field label="Nome *">
              <input style={{ ...inp, fontSize:12, minWidth:140 }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
            </Field>
            <Field label="Matrícula">
              <input style={{ ...inp, fontSize:12, width:100 }} value={form.badge_number} onChange={e=>setForm(f=>({...f,badge_number:e.target.value}))} placeholder="VIG-001"/>
            </Field>
            <Field label="Grupo">
              <input style={{ ...inp, fontSize:12, minWidth:120 }} value={form.group_name} onChange={e=>setForm(f=>({...f,group_name:e.target.value}))} placeholder="Ex: Vigilantes Piso 1"/>
            </Field>
            <Field label="Atribuir ao posto">
              <select style={{ ...inp, fontSize:12, width:180 }} value={form.post_id} onChange={e=>setForm(f=>({...f,post_id:e.target.value}))}>
                <option value="">Sem posto (atribuir depois)</option>
                {posts.map(p => <option key={p.id} value={p.id}>{p.name} — {p.floor||'s/andar'}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}

      {error && <div style={{ padding:'8px 20px', fontSize:12, color:'#FF4444', background:'rgba(255,68,68,0.08)', borderBottom:'1px solid rgba(255,68,68,0.2)' }}>{error}</div>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px' }}>
        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
          {selected ? `POI selecionado: ${selected.display_name}` : 'Clique em um POI para selecionar'}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={!selected||saving} style={{ padding:'9px 20px', borderRadius:'var(--radius-sm)', border:'none', background: selected?'linear-gradient(135deg,#00D084,#00A86B)':'var(--bg-hover)', color: selected?'#000':'var(--text-muted)', fontSize:13, fontWeight:700, cursor: selected?'pointer':'not-allowed' }}>
            {saving ? 'Cadastrando...' : 'Cadastrar vigilante'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal de edição simples ───────────────────────────────────
function EditModal({ guard, onClose, onSave }) {
  const [form, setForm] = useState({ name:guard.name||'', badge_number:guard.badge_number||'', group_name:guard.group_name||'' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try { await updateGuard(guard.id, form); onSave() }
    catch(e) { setError(e.response?.data?.error||'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Editar vigilante" onClose={onClose} maxWidth={420}>
      <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:'var(--bg-card)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)' }}>
          <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#58A6FF' }}>
            {guard.photo_url ? <img src={guard.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(guard.name)}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>{guard.name}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', marginTop:2 }}>{guard.forsight_poi_id}</div>
          </div>
        </div>
        <Field label="Nome completo *"><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Matrícula"><input style={inp} value={form.badge_number} onChange={e=>setForm(f=>({...f,badge_number:e.target.value}))} placeholder="VIG-001"/></Field>
          <Field label="Grupo"><input style={inp} value={form.group_name} onChange={e=>setForm(f=>({...f,group_name:e.target.value}))}/></Field>
        </div>
        {error && <div style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'#FF4444' }}>{error}</div>}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
        <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
        <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>{saving?'Salvando...':'Salvar'}</button>
      </div>
    </Modal>
  )
}

// ── Modal de histórico ────────────────────────────────────────
function HistoryModal({ guard, onClose }) {
  const [dayData,   setDayData]   = useState([])
  const [monthData, setMonthData] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([getGuardHistory(guard.id,'day'),getGuardHistory(guard.id,'month')])
      .then(([d,m]) => {
        setDayData(d.map(r=>({label:format(new Date(r.period),'HH')+'h',value:parseInt(r.max_absence_minutes)||0})))
        setMonthData(m.map(r=>({label:format(new Date(r.period),'dd/MM'),value:parseInt(r.alarm_count)||0})))
      }).finally(()=>setLoading(false))
  }, [guard.id])

  const sc = STATUS[guard.status] || STATUS.present
  const getColor = v => v>=30?'#FF4444':v>=20?'#F0A500':'#00D084'

  return (
    <Modal title={`Histórico — ${guard.name}`} onClose={onClose} maxWidth={520}>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        {loading ? <div style={{ textAlign:'center', color:'var(--text-muted)', padding:20 }}>Carregando...</div> : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {[
                { label:'Alarmes/mês', value:monthData.reduce((a,b)=>a+b.value,0) },
                { label:'Máx. hoje', value:`${dayData.reduce((a,b)=>Math.max(a,b.value),0)} min` },
                { label:'Posto', value:guard.post_name||'—' },
              ].map(s=>(
                <div key={s.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'12px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>Ausência hoje por hora (min)</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={dayData} margin={{top:0,right:0,left:-30,bottom:0}}>
                  <XAxis dataKey="label" tick={{fontSize:8,fill:'#484F58'}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:'#1C2128',border:'1px solid #30363D',borderRadius:6,fontSize:11}}/>
                  <Bar dataKey="value" radius={[2,2,0,0]}>{dayData.map((e,i)=><Cell key={i} fill={getColor(e.value)}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>Alarmes por dia — mês atual</div>
              <ResponsiveContainer width="100%" height={70}>
                <BarChart data={monthData} margin={{top:0,right:0,left:-30,bottom:0}}>
                  <XAxis dataKey="label" tick={{fontSize:8,fill:'#484F58'}} tickLine={false} axisLine={false} interval={3}/>
                  <Tooltip contentStyle={{background:'#1C2128',border:'1px solid #30363D',borderRadius:6,fontSize:11}}/>
                  <Bar dataKey="value" fill="#00D084" radius={[2,2,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:'var(--bg-card)', border:`1px solid ${sc.color}33`, borderRadius:'var(--radius-md)', padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600 }}>Status atual</div>
                <div style={{ fontSize:11, color:sc.color, marginTop:2 }}>{sc.label} {guard.absence_minutes!=null?`· ${guard.absence_minutes} min`:''}</div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Mat: {guard.badge_number||'—'}</div>
            </div>
          </>
        )}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
        <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'var(--bg-hover)', color:'var(--text-primary)', fontSize:13, cursor:'pointer' }}>Fechar</button>
      </div>
    </Modal>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function Guards() {
  const [guards,    setGuards]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [showHist,    setShowHist]    = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [histGuard,   setHistGuard]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGuards(await getGuards()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = guards.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.badge_number||'').includes(search)
  )

  const SC_MAP = { alarm:0, warning:1, present:2 }
  const sorted = [...filtered].sort((a,b) => (SC_MAP[a.status]??3)-(SC_MAP[b.status]??3))

  const closeGallery = () => { setShowGallery(false); load() }
  const closeEdit    = () => { setShowEdit(false); setEditing(null); load() }

  const ActionBtn = ({ title, onClick, children }) => (
    <button onClick={onClick} title={title} style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s' }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.color='var(--text-primary)'}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)'}}>
      {children}
    </button>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Vigilantes</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Gestão de vigilantes e monitoramento individual</div>
        </div>
        <button onClick={() => setShowGallery(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <span style={{ fontSize:16 }}>+</span> Novo Vigilante
        </button>
      </div>

      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
        <div style={{ position:'relative', maxWidth:400 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={{ ...inp, paddingLeft:32, background:'var(--bg-card)' }} placeholder="Buscar por nome ou matrícula..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 24px 24px' }}>
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden', marginTop:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 180px 1fr 100px 80px', padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            <span>Nome</span><span>Matrícula</span><span>POI ID</span><span>Posto</span><span>Status</span><span>Ações</span>
          </div>

          {loading && <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Carregando...</div>}

          {sorted.map((g, i) => {
            const sc = STATUS[g.status] || { color:'#484F58', label:'OFFLINE' }
            return (
              <div key={g.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 180px 1fr 100px 80px', padding:'12px 16px', borderBottom: i<sorted.length-1?'1px solid var(--border-subtle)':'none', fontSize:12, alignItems:'center', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`${sc.color}22`, border:`1.5px solid ${sc.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:sc.color, flexShrink:0, overflow:'hidden' }}>
                    {g.photo_url?<img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials(g.name)}
                  </div>
                  <span style={{ fontWeight:600 }}>{g.name}</span>
                </div>
                <span style={{ color:'var(--text-secondary)', fontFamily:'monospace', fontSize:12 }}>{g.badge_number||'—'}</span>
                <span style={{ color:'var(--text-muted)', fontFamily:'monospace', fontSize:11 }}>{g.forsight_poi_id?.slice(0,20)}...</span>
                <span style={{ color:'var(--text-secondary)' }}>{g.post_name||'—'}</span>
                <span style={{ padding:'3px 8px', borderRadius:4, background:`${sc.color}18`, color:sc.color, fontSize:10, fontWeight:700, letterSpacing:'0.3px', display:'inline-block' }}>{sc.label}</span>
                <div style={{ display:'flex', gap:6 }}>
                  <ActionBtn title="Histórico" onClick={()=>{setHistGuard(g);setShowHist(true)}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </ActionBtn>
                  <ActionBtn title="Editar" onClick={()=>{setEditing(g);setShowEdit(true)}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </ActionBtn>
                </div>
              </div>
            )
          })}

          {!loading && sorted.length === 0 && (
            <div style={{ padding:'40px 24px', textAlign:'center', color:'var(--text-muted)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Nenhum vigilante cadastrado</div>
              <div style={{ fontSize:12, marginBottom:16 }}>Clique em "+ Novo Vigilante" para selecionar da galeria de POIs do Forsight</div>
              <button onClick={()=>setShowGallery(true)} style={{ padding:'9px 18px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, cursor:'pointer' }}>Abrir galeria de POIs</button>
            </div>
          )}
        </div>
      </div>

      {showGallery && <POIGallery onClose={()=>setShowGallery(false)} onSave={closeGallery}/>}
      {showEdit && editing && <EditModal guard={editing} onClose={closeEdit} onSave={closeEdit}/>}
      {showHist && histGuard && <HistoryModal guard={histGuard} onClose={()=>{setShowHist(false);setHistGuard(null)}}/>}
    </div>
  )
}
