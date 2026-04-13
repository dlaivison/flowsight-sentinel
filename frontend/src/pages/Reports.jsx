import { useState, useEffect } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFlowStore } from '../store'

const api = (token) => ({
  get: (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
})

function fmt(dt) {
  if (!dt) return '—'
  return format(new Date(dt), 'dd/MM HH:mm', { locale: ptBR })
}

function duration(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (m < 60) return `${m}min`
  return `${Math.floor(m/60)}h ${m%60}min`
}

const PERIODS = [
  { label:'Hoje',         days: 0  },
  { label:'Últimos 7d',   days: 7  },
  { label:'Últimos 30d',  days: 30 },
  { label:'Personalizado',days: -1 },
]

export default function Reports() {
  const { token } = useFlowStore()
  const [period,    setPeriod]    = useState(7)
  const [dateFrom,  setDateFrom]  = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,    setDateTo]    = useState(format(new Date(), 'yyyy-MM-dd'))
  const [custom,    setCustom]    = useState(false)
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [groupBy,   setGroupBy]   = useState('post') // post | guard | day

  const load = async () => {
    setLoading(true)
    try {
      const from = dateFrom
      const to   = dateTo
      const res = await fetch(
        `/api/reports/alarms?from=${from}&to=${to}&groupBy=${groupBy}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const selectPeriod = (days) => {
    if (days === -1) { setCustom(true); return }
    setCustom(false)
    setPeriod(days)
    const to   = format(new Date(), 'yyyy-MM-dd')
    const from = days === 0
      ? format(new Date(), 'yyyy-MM-dd')
      : format(subDays(new Date(), days), 'yyyy-MM-dd')
    setDateFrom(from)
    setDateTo(to)
  }

  useEffect(() => { load() }, [dateFrom, dateTo, groupBy])

  const exportCSV = () => {
    if (!data?.rows) return
    const headers = ['Data/Hora','Posto','Vigilante','Ausência (min)','Limite (min)','Status','Confirmado por']
    const rows = data.rows.map(r => [
      fmt(r.triggered_at), r.post_name, r.guard_name||'—',
      r.absence_minutes, r.threshold_minutes,
      r.status, r.acknowledged_by||'—'
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `relatorio_${dateFrom}_${dateTo}.csv`
    a.click()
  }

  const kpis = data?.summary || {}

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Relatórios</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Histórico de ausências e alarmes por período</div>
        </div>
        <button onClick={exportCSV} disabled={!data?.rows?.length}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
          ↓ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ padding:'12px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        {/* Período */}
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => selectPeriod(p.days)} style={{
              padding:'5px 12px', borderRadius:12, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid',
              borderColor: (!custom && period===p.days) || (custom && p.days===-1) ? 'var(--green)' : 'var(--border)',
              background:  (!custom && period===p.days) || (custom && p.days===-1) ? 'rgba(0,208,132,0.1)' : 'transparent',
              color:       (!custom && period===p.days) || (custom && p.days===-1) ? 'var(--green)' : 'var(--text-muted)',
            }}>{p.label}</button>
          ))}
        </div>

        {/* Datas customizadas */}
        {custom && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{ padding:'5px 8px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
            <span style={{ color:'var(--text-muted)', fontSize:12 }}>até</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{ padding:'5px 8px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
          </div>
        )}

        {/* Agrupar por */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Agrupar:</span>
          {[['post','Por posto'],['guard','Por vigilante'],['day','Por dia']].map(([v,l]) => (
            <button key={v} onClick={() => setGroupBy(v)} style={{
              padding:'4px 10px', borderRadius:12, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid',
              borderColor: groupBy===v ? '#58A6FF' : 'var(--border)',
              background:  groupBy===v ? 'rgba(88,166,255,0.1)' : 'transparent',
              color:       groupBy===v ? '#58A6FF' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
          {[
            { label:'Total alarmes',      value: kpis.total        || 0, color:'#FF4444' },
            { label:'Confirmados',         value: kpis.acknowledged  || 0, color:'#00D084' },
            { label:'Auto resolvidos',     value: kpis.auto_resolved || 0, color:'#8B949E' },
            { label:'Tempo médio ausência',value: duration(kpis.avg_absence_seconds), color:'#F0A500', isText:true },
            { label:'Posto mais crítico',  value: kpis.top_post || '—', color:'#58A6FF', isText:true },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg-secondary)', border:`1px solid ${k.color}33`, borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
              <div style={{ fontSize: k.isText?14:26, fontWeight:700, color:k.color, lineHeight:1.2, marginBottom:4, wordBreak:'break-word' }}>{k.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabela agrupada */}
        {data?.groups && data.groups.length > 0 && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', fontSize:13, fontWeight:700 }}>
              Resumo {groupBy === 'post' ? 'por Posto' : groupBy === 'guard' ? 'por Vigilante' : 'por Dia'}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg-card)' }}>
                  {[groupBy==='day'?'Data':'Nome','Alarmes','Confirmados','Tempo médio','Maior ausência'].map(h => (
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{g.name}</td>
                    <td style={{ padding:'10px 14px', color:'#FF4444', fontWeight:700 }}>{g.total}</td>
                    <td style={{ padding:'10px 14px', color:'#00D084' }}>{g.acknowledged}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text-secondary)' }}>{duration(g.avg_seconds)}</td>
                    <td style={{ padding:'10px 14px', color:'#F0A500' }}>{duration(g.max_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabela detalhada */}
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, fontWeight:700 }}>Detalhamento</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{data?.rows?.length || 0} registros</div>
          </div>
          {loading ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Carregando...</div>
          ) : !data?.rows?.length ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Nenhum alarme no período selecionado</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg-card)' }}>
                    {['Data/Hora','Posto','Vigilante','Ausência','Limite','Status','Confirmado por'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border-subtle)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const statusColor = r.status === 'acknowledged' ? '#00D084' : r.status === 'auto_resolved' ? '#8B949E' : '#FF4444'
                    const statusLabel = r.status === 'acknowledged' ? 'Confirmado' : r.status === 'auto_resolved' ? 'Auto resolvido' : 'Ativo'
                    return (
                      <tr key={r.id} style={{ borderBottom:'1px solid var(--border-subtle)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'8px 14px', whiteSpace:'nowrap', color:'var(--text-secondary)' }}>{fmt(r.triggered_at)}</td>
                        <td style={{ padding:'8px 14px', fontWeight:600 }}>{r.post_name}</td>
                        <td style={{ padding:'8px 14px', color:'var(--text-secondary)' }}>{r.guard_name||'—'}</td>
                        <td style={{ padding:'8px 14px', color:'#FF4444', fontWeight:700 }}>{r.absence_minutes} min</td>
                        <td style={{ padding:'8px 14px', color:'var(--text-muted)' }}>{r.threshold_minutes} min</td>
                        <td style={{ padding:'8px 14px' }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background:`${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}33` }}>{statusLabel}</span>
                        </td>
                        <td style={{ padding:'8px 14px', color:'var(--text-muted)' }}>
                          <div>{r.acknowledged_by||'—'}</div>
                          {r.acknowledged_at && <div style={{ fontSize:10 }}>{fmt(r.acknowledged_at)}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
