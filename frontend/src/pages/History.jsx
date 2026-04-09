import { useState, useEffect, useCallback } from 'react'
import { getAlarmHistory, getGuards, getPosts } from '../api'
import { format, parseISO } from 'date-fns'

const ST = {
  active:        { bg:'rgba(255,68,68,0.15)',    color:'#FF4444', label:'Ativo'      },
  snoozed:       { bg:'rgba(240,165,0,0.15)',    color:'#F0A500', label:'Adiado'     },
  acknowledged:  { bg:'rgba(0,208,132,0.15)',    color:'#00D084', label:'Confirmado' },
  auto_resolved: { bg:'rgba(88,166,255,0.15)',   color:'#58A6FF', label:'Resolvido'  },
}
const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

function exportCSV(rows) {
  const headers = ['Data/Hora','Vigilante','Posto','Ausência (min)','Limite (min)','Status','Confirmado por']
  const lines = rows.map(r=>[
    format(parseISO(r.triggered_at),'dd/MM/yyyy HH:mm'),
    r.guard_name, r.post_name,
    r.absence_minutes, r.threshold_minutes,
    ST[r.status]?.label||r.status, r.acknowledged_by||'',
  ].map(v=>`"${v}"`).join(','))
  const blob = new Blob(['\uFEFF'+[headers.join(','),...lines].join('\n')],{type:'text/csv;charset=utf-8;'})
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`sentinel_${format(new Date(),'yyyyMMdd')}.csv`; a.click()
}

const inp = { width:'100%', padding:'8px 10px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }

export default function History() {
  const [rows, setRows] = useState([])
  const [guards, setGuards] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const limit = 30

  const today = format(new Date(),'yyyy-MM-dd')
  const monthStart = format(new Date(new Date().getFullYear(),new Date().getMonth(),1),'yyyy-MM-dd')
  const [filters, setFilters] = useState({ guardId:'', postId:'', from:monthStart, to:today, status:'' })
  const setF = (k,v) => setFilters(f=>({...f,[k]:v}))

  const load = useCallback(async (p=0) => {
    setLoading(true)
    try {
      const data = await getAlarmHistory({ ...filters, limit, offset:p*limit,
        from: filters.from?filters.from+'T00:00:00':undefined,
        to:   filters.to?filters.to+'T23:59:59':undefined })
      setRows(data); setPage(p)
    } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load(0) }, [])
  useEffect(() => { Promise.all([getGuards(),getPosts()]).then(([g,p])=>{setGuards(g);setPosts(p)}) }, [])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Histórico</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Registro completo de alarmes e ocorrências</div>
        </div>
        <button onClick={()=>exportCSV(rows)} disabled={!rows.length} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        {[['De','date','from'],['Até','date','to']].map(([l,t,k])=>(
          <div key={k} style={{ minWidth:130 }}>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:5 }}>{l}</label>
            <input type={t} style={inp} value={filters[k]} onChange={e=>setF(k,e.target.value)}/>
          </div>
        ))}
        {[['Vigilante','guardId',guards.map(g=>({value:g.id,label:g.name}))],['Posto','postId',posts.map(p=>({value:p.id,label:p.name}))],['Status','status',[{value:'acknowledged',label:'Confirmados'},{value:'auto_resolved',label:'Resolvidos'},{value:'active',label:'Ativos'}]]].map(([l,k,opts])=>(
          <div key={k} style={{ minWidth:150 }}>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:5 }}>{l}</label>
            <select style={{ ...inp, appearance:'none' }} value={filters[k]} onChange={e=>setF(k,e.target.value)}>
              <option value="">Todos</option>
              {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
        <button onClick={()=>load(0)} disabled={loading} style={{ padding:'8px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', height:34, alignSelf:'flex-end' }}>
          {loading?'Buscando...':'Filtrar'}
        </button>
      </div>

      {/* Tabela */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 1fr 80px 80px 100px 110px', padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            {['Data/Hora','Vigilante','Posto','Ausência','Limite','Status','Confirmado'].map(h=><span key={h}>{h}</span>)}
          </div>

          {loading && <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Carregando...</div>}
          {!loading && rows.length===0 && <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Nenhum alarme encontrado para o período.</div>}

          {rows.map((row,i)=>{
            const ss = ST[row.status]||ST.active
            return (
              <div key={row.id} style={{ display:'grid', gridTemplateColumns:'130px 1fr 1fr 80px 80px 100px 110px', padding:'11px 16px', borderBottom:i<rows.length-1?'1px solid var(--border-subtle)':'none', fontSize:12, alignItems:'center', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div>
                  <div style={{ fontWeight:600 }}>{format(parseISO(row.triggered_at),'dd/MM/yyyy')}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{format(parseISO(row.triggered_at),'HH:mm')}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(88,166,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#58A6FF', flexShrink:0 }}>{initials(row.guard_name)}</div>
                  <div>
                    <div style={{ fontWeight:600 }}>{row.guard_name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>Mat: {row.badge_number||'—'}</div>
                  </div>
                </div>
                <div>
                  <div>{row.post_name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{row.floor}</div>
                </div>
                <div style={{ fontWeight:700, color:row.absence_minutes>=row.threshold_minutes?'#FF4444':'#F0A500' }}>{row.absence_minutes} min</div>
                <div style={{ color:'var(--text-muted)' }}>{row.threshold_minutes} min</div>
                <span style={{ padding:'3px 8px', borderRadius:4, background:ss.bg, color:ss.color, fontSize:10, fontWeight:700, letterSpacing:'0.3px', display:'inline-block' }}>{ss.label}</span>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {row.acknowledged_by||'—'}
                  {row.acknowledged_at && <div style={{ fontSize:10 }}>{format(parseISO(row.acknowledged_at),'HH:mm')}</div>}
                </div>
              </div>
            )
          })}
        </div>

        {(rows.length===limit||page>0) && (
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
            <button onClick={()=>load(page-1)} disabled={page===0} style={{ padding:'7px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>← Anterior</button>
            <span style={{ fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center' }}>Página {page+1}</span>
            <button onClick={()=>load(page+1)} disabled={rows.length<limit} style={{ padding:'7px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  )
}
