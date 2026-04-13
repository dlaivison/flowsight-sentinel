import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getGuards, getPosts, getShiftTypes, getShiftSchedule, saveShiftSchedule, removeShiftSchedule } from '../api'

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

export default function DailyOperation() {
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [guards,     setGuards]     = useState([])
  const [posts,      setPosts]      = useState([])
  const [shifts,     setShifts]     = useState([])
  const [schedule,   setSchedule]   = useState(null)
  const [activeShift,setActiveShift]= useState(null)
  const [loading,    setLoading]    = useState(true)
  const [dragGuard,  setDragGuard]  = useState(null)
  const [dragOver,   setDragOver]   = useState(null)
  const [selected,   setSelected]   = useState([]) // IDs selecionados

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, p, st, sched] = await Promise.all([
        getGuards(),
        getPosts(),
        getShiftTypes(),
        getShiftSchedule(date),
      ])
      setGuards(g)
      setPosts(p)
      setShifts(st)
      const schedData = sched.data || sched

      // Pré-popula com alocações permanentes se não houver escala no dia
      const totalScheduled = schedData?.shifts?.reduce((acc, s) => acc + (s.scheduled?.length||0), 0) || 0
      if (totalScheduled === 0 && g.length > 0 && p.length > 0 && st.length > 0) {
        // Busca alocações permanentes
        const guardsByPost = {}
        g.forEach(guard => {
          if (guard.post_id) {
            if (!guardsByPost[guard.post_id]) guardsByPost[guard.post_id] = []
            guardsByPost[guard.post_id].push(guard.id)
          }
        })
        // Verifica se tem alguma alocação permanente
        const hasPermanent = Object.keys(guardsByPost).length > 0
        if (hasPermanent) {
          // Pré-popula para todos os turnos
          const saves = []
          st.forEach(shift => {
            Object.entries(guardsByPost).forEach(([postId, guardIds]) => {
              guardIds.forEach(guardId => {
                saves.push(saveShiftSchedule({
                  shift_type_id: shift.id,
                  guard_id: guardId,
                  post_id: postId,
                  date: new Date().toISOString().split('T')[0],
                  status: 'active',
                }))
              })
            })
          })
          if (saves.length > 0) {
            await Promise.all(saves)
            // Recarrega a escala
            const newSched = await getShiftSchedule(date)
            setSchedule(newSched.data || newSched)
            setGuards(g); setPosts(p); setShifts(st)
            const active2 = st.find(s => {
              const now2 = new Date()
              const hm2 = `${String(now2.getHours()).padStart(2,'0')}:${String(now2.getMinutes()).padStart(2,'0')}`
              const start = s.start_time.slice(0,5)
              const end   = s.end_time.slice(0,5)
              if (start < end) return hm2 >= start && hm2 <= end
              return hm2 >= start || hm2 <= end
            })
            setActiveShift(active2?.id || st[0]?.id)
            setLoading(false)
            return
          }
        }
      }

      setSchedule(schedData)
      // Turno ativo
      const now = new Date()
      const hm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const active = st.find(s => {
        const start = s.start_time.slice(0,5)
        const end   = s.end_time.slice(0,5)
        if (start < end) return hm >= start && hm <= end
        return hm >= start || hm <= end
      })
      setActiveShift(active?.id || st[0]?.id)
    } finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  // Mapa: shift_id → post_id → [guards]
  const allocationMap = {}
  if (schedule?.shifts) {
    schedule.shifts.forEach(shift => {
      allocationMap[shift.id] = {}
      posts.forEach(p => { allocationMap[shift.id][p.id] = [] })
      shift.scheduled?.forEach(s => {
        if (s.post_id && allocationMap[shift.id][s.post_id]) {
          allocationMap[shift.id][s.post_id].push(s)
        } else if (!s.post_id) {
          if (!allocationMap[shift.id]['__nopost__']) allocationMap[shift.id]['__nopost__'] = []
          allocationMap[shift.id]['__nopost__'].push(s)
        }
      })
    })
  }

  // Vigilantes já alocados no turno ativo
  const allocatedInShift = schedule?.shifts
    ?.find(s => s.id === activeShift)
    ?.scheduled?.map(s => s.guard_id) || []

  const availableGuards = guards.filter(g => !allocatedInShift.includes(g.id))

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleDrop = async (postId, shiftId) => {
    setDragOver(null)
    const toAllocate = selected.length > 0 ? selected : (dragGuard ? [dragGuard] : [])
    if (toAllocate.length === 0) return
    try {
      await Promise.all(toAllocate.map(guardId =>
        saveShiftSchedule({ shift_type_id: shiftId, guard_id: guardId, post_id: postId, date, status: 'active' })
      ))
      setSelected([])
      setDragGuard(null)
      await load()
    } catch(e) { console.error(e) }
  }

  const handleRemove = async (scheduleId) => {
    if (!confirm('Remover vigilante deste posto/turno?')) return
    try { await removeShiftSchedule(scheduleId); await load() }
    catch(e) { console.error(e) }
  }

  const activeShiftData = shifts.find(s => s.id === activeShift)

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>Carregando...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>Operação Diária</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Aloque vigilantes nos postos arrastando ou selecionando</div>
        </div>
        {/* Seletor de data */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setDate(subDays(parseISO(date),1).toISOString().split('T')[0])}
            style={{ padding:'6px 10px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>←</button>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', minWidth:160, textAlign:'center' }}>
            {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
            style={{ padding:'5px 10px', borderRadius:12, border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:11, fontWeight:600, cursor:'pointer' }}>Hoje</button>
          <button onClick={() => setDate(addDays(parseISO(date),1).toISOString().split('T')[0])}
            style={{ padding:'6px 10px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>→</button>
        </div>
        {/* Seletor de turno */}
        <div style={{ display:'flex', gap:6 }}>
          {shifts.map(s => (
            <button key={s.id} onClick={() => setActiveShift(s.id)} style={{
              padding:'6px 14px', borderRadius:20, border:`1px solid ${activeShift===s.id ? s.color+'66' : 'var(--border)'}`,
              background: activeShift===s.id ? s.color+'18' : 'transparent',
              color: activeShift===s.id ? s.color : 'var(--text-muted)',
              fontSize:12, fontWeight:activeShift===s.id?700:400, cursor:'pointer',
            }}>
              {s.name} <span style={{ opacity:0.7, fontSize:10 }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Coluna esquerda — Vigilantes disponíveis */}
        <div style={{ width:220, flexShrink:0, borderRight:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Disponíveis</div>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{availableGuards.length}</span>
          </div>
          {selected.length > 0 && (
            <div style={{ padding:'8px 12px', background:'rgba(0,208,132,0.08)', borderBottom:'1px solid rgba(0,208,132,0.2)', fontSize:11, color:'var(--green)', fontWeight:600 }}>
              {selected.length} selecionado(s) — arraste para um posto
            </div>
          )}
          <div style={{ flex:1, overflowY:'auto', padding:8 }}>
            {availableGuards.length === 0 ? (
              <div style={{ padding:16, textAlign:'center', fontSize:11, color:'var(--text-muted)' }}>Todos alocados neste turno</div>
            ) : availableGuards.map(g => (
              <div key={g.id}
                draggable
                onDragStart={() => { setDragGuard(g.id); if (!selected.includes(g.id)) setSelected([]) }}
                onDragEnd={() => setDragGuard(null)}
                onClick={() => toggleSelect(g.id)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:'var(--radius-sm)', cursor:'grab', marginBottom:4, transition:'all .15s',
                  background: selected.includes(g.id) ? 'rgba(0,208,132,0.1)' : 'var(--bg-card)',
                  border: `1px solid ${selected.includes(g.id) ? 'rgba(0,208,132,0.4)' : 'var(--border-subtle)'}`,
                }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: selected.includes(g.id)?'#00D084':'var(--border)', flexShrink:0 }}/>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#58A6FF', overflow:'hidden', flexShrink:0 }}>
                  {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(g.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{g.badge_number||'—'}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Botão Todos para Tudo */}
          <div style={{ padding:10, borderTop:'1px solid var(--border-subtle)' }}>
            <button onClick={async () => {
              if (!confirm(`Alocar TODOS os vigilantes em TODOS os postos no turno ${activeShiftData?.name}?`)) return
              try {
                await Promise.all(
                  guards.flatMap(g => posts.map(p =>
                    saveShiftSchedule({ shift_type_id: activeShift, guard_id: g.id, post_id: p.id, date, status: 'active' })
                  ))
                )
                await load()
              } catch(e) { console.error(e) }
            }} style={{ width:'100%', padding:'8px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(240,165,0,0.3)', background:'rgba(240,165,0,0.08)', color:'#F0A500', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              ⚡ Todos para Tudo
            </button>
          </div>
        </div>

        {/* Área de postos */}
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, alignContent:'start' }}>
          {posts.length === 0 && (
            <div style={{ gridColumn:'1/-1', padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              Nenhum posto cadastrado. Acesse Cadastros → Postos.
            </div>
          )}
          {posts.map(post => {
            const allocated = allocationMap[activeShift]?.[post.id] || []
            const isOver = dragOver === post.id
            return (
              <div key={post.id}
                onDragOver={e => { e.preventDefault(); setDragOver(post.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(post.id, activeShift)}
                style={{ background:'var(--bg-secondary)', border:`2px dashed ${isOver ? (activeShiftData?.color||'#00D084') : 'var(--border-subtle)'}`, borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'border-color .15s', boxShadow: isOver?`0 0 16px ${activeShiftData?.color||'#00D084'}22`:'none' }}>

                {/* Header do posto */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, background: isOver?`${activeShiftData?.color||'#00D084'}08`:'transparent' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{post.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>{post.floor||'—'}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background: allocated.length>0?'rgba(0,208,132,0.1)':'rgba(139,148,158,0.1)', color: allocated.length>0?'#00D084':'#8B949E', border:`1px solid ${allocated.length>0?'rgba(0,208,132,0.3)':'rgba(139,148,158,0.3)'}` }}>
                    {allocated.length} vigilante(s)
                  </span>
                </div>

                {/* Vigilantes alocados */}
                <div style={{ padding:10, minHeight:80, display:'flex', flexDirection:'column', gap:6 }}>
                  {allocated.length === 0 ? (
                    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:11, fontStyle:'italic', padding:'12px 0' }}>
                      {isOver ? '↓ Solte aqui' : 'Arraste vigilantes aqui'}
                    </div>
                  ) : allocated.map(a => (
                    <div key={a.id||a.guard_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', background:'var(--bg-card)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-subtle)' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,208,132,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#00D084', overflow:'hidden', flexShrink:0 }}>
                        {a.photo_url ? <img src={a.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(a.guard_name)}
                      </div>
                      <span style={{ flex:1, fontSize:12, fontWeight:500 }}>{a.guard_name}</span>
                      <button onClick={() => handleRemove(a.id)} style={{ width:20, height:20, borderRadius:4, border:'none', background:'rgba(255,68,68,0.1)', color:'#FF4444', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
