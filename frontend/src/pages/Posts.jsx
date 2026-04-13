import { useState, useEffect, useCallback } from 'react'
import { getPosts, createPost, updatePost, getCameras, syncCameras, getGuards, assignGuardToPost } from '../api'

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'
const STATUS_COLOR = { present:'#00D084', warning:'#F0A500', alarm:'#FF4444' }

const inp = { width:'100%', padding:'9px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:13, outline:'none' }

function Field({ label, children }) {
  return <div><label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>{label}</label>{children}</div>
}

function Modal({ title, onClose, children, maxWidth=500 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, overflow:'hidden', boxShadow:'0 24px 48px rgba(0,0,0,0.5)', animation:'fadeIn .2s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <span style={{ fontSize:15, fontWeight:700 }}>{title}</span>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PostModal({ post, cameras, onClose, onSave }) {
  const isEdit = !!post?.id
  const [form, setForm] = useState({
    name:                      post?.name || '',
    floor:                     post?.floor || '',
    absence_threshold_minutes: post?.absence_threshold_minutes || 30,
    warning_threshold_minutes: post?.warning_threshold_minutes || 20,
    camera_ids:                (post?.cameras||[]).map(c=>c.id),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleCam = id => set('camera_ids', form.camera_ids.includes(id)?form.camera_ids.filter(c=>c!==id):[...form.camera_ids,id])

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (!form.camera_ids.length) { setError('Selecione ao menos uma câmera'); return }
    setSaving(true)
    try { if (isEdit) await updatePost(post.id,form); else await createPost(form); onSave() }
    catch(e) { setError(e.response?.data?.error||'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit?'Editar posto':'Novo posto de vigilância'} onClose={onClose} maxWidth={520}>
      <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14, maxHeight:'60vh', overflowY:'auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:12 }}>
          <Field label="Nome do posto *"><input style={inp} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Entrada Principal"/></Field>
          <Field label="Andar / Área"><input style={inp} value={form.floor} onChange={e=>set('floor',e.target.value)} placeholder="Ex: Piso 1"/></Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label={`Aviso após — ${form.warning_threshold_minutes} min`}>
            <input type="range" min="5" max="60" step="5" value={form.warning_threshold_minutes} onChange={e=>set('warning_threshold_minutes',parseInt(e.target.value))} style={{ width:'100%', accentColor:'#F0A500' }}/>
          </Field>
          <Field label={`Alarme após — ${form.absence_threshold_minutes} min`}>
            <input type="range" min="10" max="120" step="5" value={form.absence_threshold_minutes} onChange={e=>set('absence_threshold_minutes',parseInt(e.target.value))} style={{ width:'100%', accentColor:'#FF4444' }}/>
          </Field>
        </div>
        <Field label={`Câmeras * — ${form.camera_ids.length} selecionada(s)`}>
          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', maxHeight:160, overflowY:'auto', background:'var(--bg-card)' }}>
            {cameras.length===0 && <div style={{ padding:12, fontSize:12, color:'var(--text-muted)' }}>Nenhuma câmera — sincronize primeiro</div>}
            {cameras.map(cam=>(
              <label key={cam.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid var(--border-subtle)', background:form.camera_ids.includes(cam.id)?'rgba(0,208,132,0.05)':'transparent' }}>
                <input type="checkbox" checked={form.camera_ids.includes(cam.id)} onChange={()=>toggleCam(cam.id)} style={{ accentColor:'#00D084' }}/>
                <span style={{ fontSize:13, flex:1 }}>{cam.name}</span>
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>{cam.location||''}</span>
                <span style={{ width:7, height:7, borderRadius:'50%', background:cam.is_online?'#00D084':'#FF4444', flexShrink:0 }}/>
              </label>
            ))}
          </div>
        </Field>
        {error && <div style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'#FF4444' }}>{error}</div>}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
        <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
        <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>{saving?'Salvando...':isEdit?'Salvar':'Criar posto'}</button>
      </div>
    </Modal>
  )
}

function AssignModal({ post, guards, onClose, onSave }) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Vigilantes já no posto
  const currentIds = new Set((post.guards||[]).map(g=>g.id))
  // Só mostra quem ainda não está neste posto
  const available = guards.filter(g => !currentIds.has(g.id))

  const save = async () => {
    if (!selected) { setError('Selecione um vigilante'); return }
    setSaving(true)
    try { await assignGuardToPost(post.id, selected); onSave() }
    catch(e) { setError(e.response?.data?.error||'Erro ao atribuir') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Adicionar vigilante — ${post.name}`} onClose={onClose} maxWidth={400}>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
        {/* Vigilantes já no posto */}
        {post.guards?.length > 0 && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
              Já neste posto ({post.guards.length})
            </div>
            {post.guards.map(g => (
              <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:6, opacity:0.7 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,208,132,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#00D084', overflow:'hidden', flexShrink:0 }}>
                  {g.photo_url?<img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials(g.name)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{g.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {g.badge_number||'—'}</div>
                </div>
                <span style={{ fontSize:10, color:'#00D084', fontWeight:600 }}>ATIVO</span>
              </div>
            ))}
          </div>
        )}

        {/* Vigilantes disponíveis para adicionar */}
        {available.length === 0 ? (
          <div style={{ padding:16, textAlign:'center', fontSize:12, color:'var(--text-muted)', background:'var(--bg-card)', borderRadius:'var(--radius-md)' }}>
            Todos os vigilantes cadastrados já estão neste posto.
          </div>
        ) : (
          <>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>
              Adicionar ao posto
            </div>
            {available.map(g=>(
              <label key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius-md)', cursor:'pointer', border:`1px solid ${selected===g.id?'rgba(0,208,132,0.4)':'var(--border-subtle)'}`, background:selected===g.id?'rgba(0,208,132,0.08)':'var(--bg-card)', transition:'all .15s', marginBottom:4 }}>
                <input type="radio" name="guard" value={g.id} checked={selected===g.id} onChange={()=>setSelected(g.id)} style={{ accentColor:'#00D084' }}/>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#58A6FF', flexShrink:0, overflow:'hidden' }}>
                  {g.photo_url?<img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials(g.name)}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{g.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {g.badge_number||'—'} · {g.post_name?`Também em: ${g.post_name}`:'Sem posto'}</div>
                </div>
              </label>
            ))}
          </>
        )}
        {error && <div style={{ fontSize:12, color:'#FF4444', background:'rgba(255,68,68,0.1)', borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>{error}</div>}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:'1px solid var(--border-subtle)' }}>
        <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
        <button onClick={save} disabled={saving||!selected||available.length===0} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background: selected?'linear-gradient(135deg,#00D084,#00A86B)':'var(--bg-hover)', color: selected?'#000':'var(--text-muted)', fontSize:13, fontWeight:700, cursor: selected?'pointer':'not-allowed' }}>{saving?'Adicionando...':'Confirmar'}</button>
      </div>
    </Modal>
  )
}

function GuardChip({ guard }) {
  const sc = STATUS_COLOR[guard.status] || '#484F58'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--bg-card)', border:`1px solid ${sc}22`, borderRadius:'var(--radius-sm)' }}>
      <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:`${sc}22`, border:`1.5px solid ${sc}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:sc, overflow:'hidden' }}>
        {guard.photo_url?<img src={guard.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials(guard.name)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{guard.name}</div>
        <div style={{ fontSize:10, color:'var(--text-muted)' }}>{guard.badge_number||'—'}</div>
      </div>
      <div style={{ width:7, height:7, borderRadius:'50%', background:sc, flexShrink:0 }}/>
    </div>
  )
}

function PostCard({ post, onEdit, onAssign }) {
  return (
    <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>{post.name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{post.floor||'—'}</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button title="Adicionar vigilante" onClick={()=>onAssign(post)} style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.color='var(--green)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </button>
          <button title="Editar posto" onClick={()=>onEdit(post)} style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.color='var(--text-primary)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>

      {/* Vigilantes */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)' }}>
        <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
          Vigilantes · {post.guards?.length || 0}
        </div>
        {post.guards?.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {post.guards.map(g => <GuardChip key={g.id} guard={g}/>)}
          </div>
        ) : (
          <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', padding:'6px 0' }}>
            Nenhum vigilante atribuído
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
          {post.cameras?.length||post.camera_count||0} câmera(s)
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <span style={{ padding:'2px 8px', borderRadius:4, background:'rgba(240,165,0,0.1)', color:'#F0A500', border:'1px solid rgba(240,165,0,0.2)', fontSize:10, fontWeight:600 }}>{post.warning_threshold_minutes}min aviso</span>
          <span style={{ padding:'2px 8px', borderRadius:4, background:'rgba(255,68,68,0.1)', color:'#FF4444', border:'1px solid rgba(255,68,68,0.2)', fontSize:10, fontWeight:600 }}>{post.absence_threshold_minutes}min alarme</span>
        </div>
      </div>
    </div>
  )
}

export default function Posts() {
  const [posts,   setPosts]   = useState([])
  const [cameras, setCameras] = useState([])
  const [guards,  setGuards]  = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showPost,   setShowPost]   = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [editPost,   setEditPost]   = useState(null)
  const [assignPost, setAssignPost] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const [p,c,g] = await Promise.all([getPosts(),getCameras(),getGuards()]); setPosts(p);setCameras(c);setGuards(g) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleSync = async () => { setSyncing(true); try { await syncCameras(); setCameras(await getCameras()) } finally { setSyncing(false) } }
  const closeAndReload = () => { setShowPost(false);setShowAssign(false);setEditPost(null);setAssignPost(null);load() }
  const byFloor = posts.reduce((a,p)=>{ const f=p.floor||'Sem andar'; if(!a[f])a[f]=[]; a[f].push(p); return a },{})

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Postos</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Gerenciamento de postos e câmeras de vigilância</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleSync} disabled={syncing} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:syncing?'spin 1s linear infinite':'none' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            {syncing?'Sincronizando...':'↺ Sincronizar câmeras'}
          </button>
          <button onClick={()=>{setEditPost(null);setShowPost(true)}} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <span style={{ fontSize:16 }}>+</span> Novo posto
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        {loading && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>}
        {!loading && posts.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Nenhum posto cadastrado</div>
            <button onClick={handleSync} style={{ padding:'9px 18px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, cursor:'pointer' }}>↺ Sincronizar câmeras do Fortify</button>
          </div>
        )}
        {Object.entries(byFloor).map(([floor,fps])=>(
          <div key={floor}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase' }}>{floor}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fps.length} posto(s)</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
              {fps.map(p=><PostCard key={p.id} post={p} onEdit={p=>{setEditPost(p);setShowPost(true)}} onAssign={p=>{setAssignPost(p);setShowAssign(true)}}/>)}
            </div>
          </div>
        ))}
      </div>
      {showPost && <PostModal post={editPost} cameras={cameras} onClose={()=>{setShowPost(false);setEditPost(null)}} onSave={closeAndReload}/>}
      {showAssign && assignPost && <AssignModal post={assignPost} guards={guards} onClose={()=>{setShowAssign(false);setAssignPost(null)}} onSave={closeAndReload}/>}
    </div>
  )
}
