import { useState, useEffect, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFlowStore } from '../store'

function fmt(dt) {
  if (!dt) return '—'
  return format(new Date(dt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}
function fmtDate(dt) {
  if (!dt) return '—'
  return format(new Date(dt), 'dd/MM/yyyy', { locale: ptBR })
}
function duration(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  if (m === 0) return `${seconds}s`
  if (m < 60) return `${m}min`
  return `${Math.floor(m/60)}h ${m%60}min`
}

const PERIODS = [
  { label:'Hoje',         days: 0  },
  { label:'Últimos 7d',   days: 7  },
  { label:'Últimos 30d',  days: 30 },
  { label:'Personalizado',days: -1 },
]

const PRINT_STYLES = `
  @media print {
    @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .page-break { page-break-before: always; }

    /* Capa */
    .cover-page {
      display: flex !important;
      flex-direction: column;
      height: 100vh;
      padding: 40px;
      background: white;
    }
    .cover-header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid #00D084;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .cover-logo-box {
      width: 56px; height: 56px;
      background: #0D1117;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .cover-title { font-size: 32px; font-weight: 700; color: #0D1117; margin: 0; }
    .cover-subtitle { font-size: 14px; color: #8B949E; margin: 4px 0 0 0; }
    .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .cover-report-title { font-size: 42px; font-weight: 700; color: #0D1117; line-height: 1.2; margin-bottom: 16px; }
    .cover-period { font-size: 18px; color: #58A6FF; font-weight: 600; margin-bottom: 8px; }
    .cover-generated { font-size: 13px; color: #8B949E; }
    .cover-footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 16px;
      display: flex; justify-content: space-between;
      font-size: 11px; color: #8B949E;
    }

    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
    .kpi-card {
      border: 1px solid #E5E7EB; border-radius: 8px;
      padding: 14px 16px; background: #F9FAFB;
    }
    .kpi-value { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
    .kpi-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Tabelas */
    .report-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0; }
    .report-table th {
      background: #F3F4F6; padding: 8px 10px;
      text-align: left; font-weight: 700; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: #6B7280; border-bottom: 2px solid #E5E7EB;
    }
    .report-table td { padding: 7px 10px; border-bottom: 1px solid #F3F4F6; color: #374151; }
    .report-table tr:nth-child(even) td { background: #F9FAFB; }

    .section-title {
      font-size: 16px; font-weight: 700; color: #0D1117;
      border-left: 4px solid #00D084; padding-left: 12px;
      margin: 24px 0 12px 0;
    }
    .section-subtitle { font-size: 12px; color: #6B7280; margin-bottom: 16px; margin-left: 16px; }

    .badge-confirmed { background: #D1FAE5; color: #065F46; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-auto { background: #F3F4F6; color: #6B7280; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-active { background: #FEE2E2; color: #991B1B; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }

    .alert-high { color: #DC2626; font-weight: 700; }
    .alert-med  { color: #D97706; font-weight: 600; }
    .alert-ok   { color: #059669; }

    .page-number { position: fixed; bottom: 10mm; right: 15mm; font-size: 10px; color: #9CA3AF; }
  }
  @media screen {
    .print-only { display: none; }
    .cover-page { display: none; }
  }
`

export default function Reports() {
  const { token } = useFlowStore()
  const [period,   setPeriod]   = useState(7)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [custom,   setCustom]   = useState(false)
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [groupBy,  setGroupBy]  = useState('post')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/reports/alarms?from=${dateFrom}&to=${dateTo}&groupBy=${groupBy}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setData(await res.json())
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [dateFrom, dateTo, groupBy])

  const selectPeriod = (days) => {
    if (days === -1) { setCustom(true); return }
    setCustom(false); setPeriod(days)
    setDateTo(format(new Date(), 'yyyy-MM-dd'))
    setDateFrom(days === 0 ? format(new Date(), 'yyyy-MM-dd') : format(subDays(new Date(), days), 'yyyy-MM-dd'))
  }

  const exportCSV = () => {
    if (!data?.rows) return
    const headers = ['Data/Hora','Posto','Vigilante','Ausência (min)','Limite (min)','Status','Confirmado por']
    const rows = data.rows.map(r => [fmt(r.triggered_at), r.post_name, r.guard_name||'—', r.absence_minutes, r.threshold_minutes, r.status, r.acknowledged_by||'—'])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `relatorio_${dateFrom}_${dateTo}.csv`
    a.click()
  }

  const exportPDF = async () => {
    try {
      const res = await fetch(
        `/api/reports/alarms/pdf?from=${dateFrom}&to=${dateTo}&groupBy=${groupBy}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Erro ao gerar PDF')
      const blob = await res.blob()
      const pdfBlob = new Blob([blob], { type: 'application/pdf' })
      const url  = URL.createObjectURL(pdfBlob)
      const a    = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.download = `relatorio_${dateFrom}_${dateTo}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch(e) { alert('Erro ao gerar PDF: ' + e.message) }
  }

  const kpis = data?.summary || {}
  const periodLabel = `${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  const statusBadge = (status) => {
    if (status === 'acknowledged')  return <span className="badge-confirmed">Confirmado</span>
    if (status === 'auto_resolved') return <span className="badge-auto">Auto resolvido</span>
    return <span className="badge-active">Ativo</span>
  }

  const absenceClass = (min) => {
    if (min >= 30) return 'alert-high'
    if (min >= 10) return 'alert-med'
    return 'alert-ok'
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* ─── VERSÃO IMPRESSÃO (só aparece no print) ─── */}

      {/* Capa */}
      <div className="cover-page">
        <div className="cover-header">
          <div className="cover-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00D084" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <p className="cover-title">FlowSight Sentinel</p>
            <p className="cover-subtitle">Sistema de Monitoramento de Vigilantes</p>
          </div>
        </div>
        <div className="cover-main">
          <div className="cover-report-title">Relatório<br/>Operacional</div>
          <div className="cover-period">📅 Período: {periodLabel}</div>
          <div className="cover-generated">Gerado em {generatedAt}</div>
          <div style={{ marginTop:32, display:'flex', gap:24 }}>
            {[
              { label:'Total de Alarmes', value:kpis.total||0, color:'#DC2626' },
              { label:'Confirmados',      value:kpis.acknowledged||0, color:'#059669' },
              { label:'Auto Resolvidos',  value:kpis.auto_resolved||0, color:'#6B7280' },
              { label:'Tempo Médio',      value:duration(kpis.avg_absence_seconds), color:'#D97706' },
            ].map(k => (
              <div key={k.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:36, fontWeight:700, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="cover-footer">
          <span>FlowSight Sentinel v1.0.0 — Confidencial</span>
          <span>{generatedAt}</span>
        </div>
      </div>

      {/* Sumário executivo */}
      <div className="print-only page-break">
        <div style={{ padding:'8px 0 16px 0', borderBottom:'3px solid #00D084', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D084" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#0D1117' }}>FlowSight Sentinel — Relatório Operacional</div>
            <div style={{ fontSize:11, color:'#8B949E' }}>Período: {periodLabel} · Gerado em {generatedAt}</div>
          </div>
        </div>

        <div className="section-title">1. Sumário Executivo</div>
        <div className="kpi-grid">
          {[
            { label:'Total de Alarmes',    value:kpis.total||0,            color:'#DC2626' },
            { label:'Confirmados',         value:kpis.acknowledged||0,     color:'#059669' },
            { label:'Auto Resolvidos',     value:kpis.auto_resolved||0,    color:'#6B7280' },
            { label:'Tempo Médio Ausência',value:duration(kpis.avg_absence_seconds), color:'#D97706' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
        {kpis.top_post && kpis.top_post !== '—' && (
          <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400E', marginTop:8 }}>
            ⚠ Posto mais crítico no período: <strong>{kpis.top_post}</strong>
          </div>
        )}

        {/* Resumo por posto/vigilante/dia */}
        {data?.groups?.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop:32 }}>
              2. Resumo {groupBy==='post'?'por Posto':groupBy==='guard'?'por Vigilante':'por Dia'}
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>{groupBy==='day'?'Data':'Nome'}</th>
                  <th style={{ textAlign:'center' }}>Alarmes</th>
                  <th style={{ textAlign:'center' }}>Confirmados</th>
                  <th style={{ textAlign:'center' }}>Tempo Médio</th>
                  <th style={{ textAlign:'center' }}>Maior Ausência</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g, i) => (
                  <tr key={i}>
                    <td><strong>{g.name}</strong></td>
                    <td style={{ textAlign:'center' }} className={absenceClass(0)}><strong style={{ color:'#DC2626' }}>{g.total}</strong></td>
                    <td style={{ textAlign:'center', color:'#059669' }}>{g.acknowledged}</td>
                    <td style={{ textAlign:'center' }}>{duration(g.avg_seconds)}</td>
                    <td style={{ textAlign:'center' }} className="alert-high">{duration(g.max_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Detalhamento completo */}
      {data?.rows?.length > 0 && (
        <div className="print-only page-break">
          <div style={{ padding:'8px 0 16px 0', borderBottom:'3px solid #00D084', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D084" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#0D1117' }}>FlowSight Sentinel — Detalhamento</div>
              <div style={{ fontSize:11, color:'#8B949E' }}>Período: {periodLabel} · {data.rows.length} registros</div>
            </div>
          </div>

          <div className="section-title">3. Detalhamento Completo de Alarmes</div>
          <div className="section-subtitle">{data.rows.length} ocorrências no período de {periodLabel}</div>
          <table className="report-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Posto</th>
                <th>Vigilante</th>
                <th style={{ textAlign:'center' }}>Ausência</th>
                <th style={{ textAlign:'center' }}>Limite</th>
                <th style={{ textAlign:'center' }}>Status</th>
                <th>Confirmado por</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace:'nowrap', color:'#6B7280' }}>{fmt(r.triggered_at)}</td>
                  <td><strong>{r.post_name}</strong></td>
                  <td>{r.guard_name||'—'}</td>
                  <td style={{ textAlign:'center' }} className={absenceClass(r.absence_minutes)}>{r.absence_minutes} min</td>
                  <td style={{ textAlign:'center', color:'#6B7280' }}>{r.threshold_minutes} min</td>
                  <td style={{ textAlign:'center' }}>{statusBadge(r.status)}</td>
                  <td style={{ color:'#6B7280' }}>
                    {r.acknowledged_by||'—'}
                    {r.acknowledged_at && <div style={{ fontSize:9, color:'#9CA3AF' }}>{fmt(r.acknowledged_at)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop:24, borderTop:'1px solid #E5E7EB', paddingTop:12, display:'flex', justifyContent:'space-between', fontSize:10, color:'#9CA3AF' }}>
            <span>FlowSight Sentinel v1.0.0 — Documento Confidencial</span>
            <span>Gerado em {generatedAt}</span>
          </div>
        </div>
      )}

      {/* ─── VERSÃO TELA (normal) ─── */}
      <div className="no-print" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Relatórios</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Histórico de ausências e alarmes por período</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={exportCSV} disabled={!data?.rows?.length}
              style={{ padding:'8px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
              ↓ CSV
            </button>
            <button onClick={exportPDF} disabled={!data?.rows?.length}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              📄 Exportar PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding:'12px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6 }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => selectPeriod(p.days)} style={{
                padding:'5px 12px', borderRadius:12, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid',
                borderColor: (!custom&&period===p.days)||(custom&&p.days===-1) ? 'var(--green)' : 'var(--border)',
                background:  (!custom&&period===p.days)||(custom&&p.days===-1) ? 'rgba(0,208,132,0.1)' : 'transparent',
                color:       (!custom&&period===p.days)||(custom&&p.days===-1) ? 'var(--green)' : 'var(--text-muted)',
              }}>{p.label}</button>
            ))}
          </div>
          {custom && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{ padding:'5px 8px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
              <span style={{ color:'var(--text-muted)', fontSize:12 }}>até</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{ padding:'5px 8px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}/>
            </div>
          )}
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
              { label:'Total alarmes',       value:kpis.total||0,                        color:'#FF4444' },
              { label:'Confirmados',          value:kpis.acknowledged||0,                 color:'#00D084' },
              { label:'Auto resolvidos',      value:kpis.auto_resolved||0,               color:'#8B949E' },
              { label:'Tempo médio ausência', value:duration(kpis.avg_absence_seconds),   color:'#F0A500', isText:true },
              { label:'Posto mais crítico',   value:kpis.top_post||'—',                  color:'#58A6FF', isText:true },
            ].map(k => (
              <div key={k.label} style={{ background:'var(--bg-secondary)', border:`1px solid ${k.color}33`, borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
                <div style={{ fontSize:k.isText?13:26, fontWeight:700, color:k.color, lineHeight:1.2, marginBottom:4, wordBreak:'break-word' }}>{k.value}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tabela agrupada */}
          {data?.groups?.length > 0 && (
            <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', fontSize:13, fontWeight:700 }}>
                Resumo {groupBy==='post'?'por Posto':groupBy==='guard'?'por Vigilante':'por Dia'}
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
                  {data.groups.map((g,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{data?.rows?.length||0} registros</div>
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
                    {data.rows.map((r,i) => {
                      const sc = r.status==='acknowledged'?{c:'#00D084',l:'Confirmado'}:r.status==='auto_resolved'?{c:'#8B949E',l:'Auto resolvido'}:{c:'#FF4444',l:'Ativo'}
                      return (
                        <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'8px 14px', whiteSpace:'nowrap', color:'var(--text-secondary)' }}>{fmt(r.triggered_at)}</td>
                          <td style={{ padding:'8px 14px', fontWeight:600 }}>{r.post_name}</td>
                          <td style={{ padding:'8px 14px', color:'var(--text-secondary)' }}>{r.guard_name||'—'}</td>
                          <td style={{ padding:'8px 14px', color:'#FF4444', fontWeight:700 }}>{r.absence_minutes} min</td>
                          <td style={{ padding:'8px 14px', color:'var(--text-muted)' }}>{r.threshold_minutes} min</td>
                          <td style={{ padding:'8px 14px' }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background:`${sc.c}18`, color:sc.c, border:`1px solid ${sc.c}33` }}>{sc.l}</span>
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
    </>
  )
}
