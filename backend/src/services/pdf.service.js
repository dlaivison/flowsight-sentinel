const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')


const LOGO_BASE64 = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../../../frontend/public/logo.png'))
    return 'data:image/png;base64,' + buf.toString('base64')
  } catch(e) { return null }
})()

const LOGO_HTML_LG = LOGO_BASE64
  ? '<img src="' + LOGO_BASE64 + '" style="width:44px;height:44px;object-fit:contain;border-radius:8px;">'
  : '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00D084" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'

const LOGO_HTML_SM = LOGO_BASE64
  ? '<img src="' + LOGO_BASE64 + '" style="width:28px;height:28px;object-fit:contain;border-radius:4px;">'
  : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00D084" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'

function duration(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  if (m === 0) return `${seconds}s`
  if (m < 60) return `${m}min`
  return `${Math.floor(m/60)}h ${m%60}min`
}

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

function statusBadge(status) {
  if (status === 'acknowledged')  return `<span class="badge badge-ok">Confirmado</span>`
  if (status === 'auto_resolved') return `<span class="badge badge-gray">Auto resolvido</span>`
  return `<span class="badge badge-red">Ativo</span>`
}

function absenceColor(min) {
  if (min >= 30) return '#DC2626'
  if (min >= 10) return '#D97706'
  return '#059669'
}

async function generateReportPDF({ data, dateFrom, dateTo }) {
  const kpis    = data.summary || {}
  const groups  = data.groups  || []
  const rows    = data.rows    || []
  const now     = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  const period  = `${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1F2937; background: white; }

  /* ── CAPA ── */
  .cover {
    width: 100%; height: 100vh;
    display: flex; flex-direction: column;
    background: linear-gradient(160deg, #0D1117 60%, #161B22 100%);
    padding: 48px;
    page-break-after: always;
  }
  .cover-logo {
    display: flex; align-items: center; gap: 14px;
    border-bottom: 2px solid #00D084; padding-bottom: 20px; margin-bottom: 48px;
  }
  .cover-logo svg { flex-shrink: 0; }
  .cover-logo-text { color: white; }
  .cover-logo-text h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
  .cover-logo-text p  { font-size: 12px; color: #8B949E; margin-top: 2px; }
  .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag {
    display: inline-block; background: rgba(0,208,132,0.15); color: #00D084;
    border: 1px solid rgba(0,208,132,0.3); border-radius: 20px;
    font-size: 11px; font-weight: 700; padding: 4px 14px; letter-spacing: 1px;
    text-transform: uppercase; margin-bottom: 20px; width: fit-content;
  }
  .cover-title { font-size: 52px; font-weight: 700; color: white; line-height: 1.1; margin-bottom: 12px; }
  .cover-title span { color: #00D084; }
  .cover-period { font-size: 16px; color: #8B949E; margin-bottom: 48px; }
  .cover-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 48px; }
  .cover-kpi {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 18px 16px;
  }
  .cover-kpi-value { font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
  .cover-kpi-label { font-size: 11px; color: #8B949E; text-transform: uppercase; letter-spacing: 0.5px; }
  .cover-footer {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;
    font-size: 11px; color: #6B7280;
  }

  /* ── PÁGINAS INTERNAS ── */
  .page { padding: 32px 36px; }
  .page-header {
    display: flex; align-items: center; gap: 12px;
    border-bottom: 3px solid #00D084; padding-bottom: 14px; margin-bottom: 28px;
  }
  .page-header-text h2 { font-size: 18px; font-weight: 700; color: #0D1117; }
  .page-header-text p  { font-size: 11px; color: #6B7280; margin-top: 2px; }

  .section { margin-bottom: 32px; }
  .section-title {
    font-size: 14px; font-weight: 700; color: #0D1117;
    border-left: 4px solid #00D084; padding-left: 10px;
    margin-bottom: 14px;
  }

  /* KPIs */
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
  .kpi-card {
    border-radius: 10px; padding: 16px;
    border-left: 4px solid; 
  }
  .kpi-card-red    { background: #FEF2F2; border-color: #DC2626; }
  .kpi-card-green  { background: #F0FDF4; border-color: #16A34A; }
  .kpi-card-gray   { background: #F9FAFB; border-color: #9CA3AF; }
  .kpi-card-amber  { background: #FFFBEB; border-color: #D97706; }
  .kpi-value { font-size: 30px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; font-weight: 600; }
  .kpi-red   { color: #DC2626; }
  .kpi-green { color: #16A34A; }
  .kpi-gray  { color: #6B7280; }
  .kpi-amber { color: #D97706; }

  /* Alerta */
  .alert-box {
    background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px;
    padding: 10px 14px; font-size: 12px; color: #92400E; margin-bottom: 20px;
    display: flex; align-items: center; gap: 8px;
  }

  /* Tabelas */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #F3F4F6; }
  th {
    padding: 9px 12px; text-align: left;
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #6B7280;
    border-bottom: 2px solid #E5E7EB;
  }
  td { padding: 8px 12px; border-bottom: 1px solid #F3F4F6; color: #374151; }
  tr:nth-child(even) td { background: #F9FAFB; }
  tr:hover td { background: #EFF6FF; }
  .td-right { text-align: right; }
  .td-center { text-align: center; }

  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
  .badge-ok   { background: #D1FAE5; color: #065F46; }
  .badge-gray { background: #F3F4F6; color: #6B7280; }
  .badge-red  { background: #FEE2E2; color: #991B1B; }

  .page-footer {
    margin-top: 24px; border-top: 1px solid #E5E7EB; padding-top: 10px;
    display: flex; justify-content: space-between;
    font-size: 9px; color: #9CA3AF;
  }

  .page-break { page-break-before: always; }
</style>
</head>
<body>

<!-- ═══════════════════════════════ CAPA ═══════════════════════════════ -->
<div class="cover">
  <div class="cover-logo">
    ${LOGO_HTML_LG}
    <div class="cover-logo-text">
      <h1>FlowSight Sentinel</h1>
      <p>Sistema de Monitoramento de Vigilantes · On-premises</p>
    </div>
  </div>

  <div class="cover-main">
    <div class="cover-tag">Relatório Operacional</div>
    <div class="cover-title">Relatório de<br/><span>Ausências</span></div>
    <div class="cover-period">📅 Período: ${period}</div>

    <div class="cover-kpis">
      <div class="cover-kpi">
        <div class="cover-kpi-value" style="color:#FF4444">${kpis.total||0}</div>
        <div class="cover-kpi-label">Total de Alarmes</div>
      </div>
      <div class="cover-kpi">
        <div class="cover-kpi-value" style="color:#00D084">${kpis.acknowledged||0}</div>
        <div class="cover-kpi-label">Confirmados</div>
      </div>
      <div class="cover-kpi">
        <div class="cover-kpi-value" style="color:#8B949E">${kpis.auto_resolved||0}</div>
        <div class="cover-kpi-label">Auto Resolvidos</div>
      </div>
      <div class="cover-kpi">
        <div class="cover-kpi-value" style="color:#F0A500">${duration(kpis.avg_absence_seconds)}</div>
        <div class="cover-kpi-label">Tempo Médio</div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <span>FlowSight Sentinel v1.0.0 · Documento Confidencial</span>
    <span>Gerado em ${now}</span>
  </div>
</div>

<!-- ══════════════════════════ SUMÁRIO EXECUTIVO ══════════════════════════ -->
<div class="page">
  <div class="page-header">
    ${LOGO_HTML_SM}
    <div class="page-header-text">
      <h2>FlowSight Sentinel — Relatório Operacional</h2>
      <p>Período: ${period} · Gerado em ${now}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Sumário Executivo</div>
    <div class="kpi-grid">
      <div class="kpi-card kpi-card-red">
        <div class="kpi-value kpi-red">${kpis.total||0}</div>
        <div class="kpi-label">Total de Alarmes</div>
      </div>
      <div class="kpi-card kpi-card-green">
        <div class="kpi-value kpi-green">${kpis.acknowledged||0}</div>
        <div class="kpi-label">Confirmados</div>
      </div>
      <div class="kpi-card kpi-card-gray">
        <div class="kpi-value kpi-gray">${kpis.auto_resolved||0}</div>
        <div class="kpi-label">Auto Resolvidos</div>
      </div>
      <div class="kpi-card kpi-card-amber">
        <div class="kpi-value kpi-amber">${duration(kpis.avg_absence_seconds)}</div>
        <div class="kpi-label">Tempo Médio de Ausência</div>
      </div>
    </div>

    ${kpis.top_post && kpis.top_post !== '—' ? `
    <div class="alert-box">
      <span>⚠</span>
      <span>Posto mais crítico no período: <strong>${kpis.top_post}</strong></span>
    </div>` : ''}
  </div>

  ${groups.length > 0 ? `
  <div class="section">
    <div class="section-title">2. Resumo por Posto</div>
    <table>
      <thead>
        <tr>
          <th>Posto</th>
          <th class="td-center">Alarmes</th>
          <th class="td-center">Confirmados</th>
          <th class="td-center">Tempo Médio</th>
          <th class="td-center">Maior Ausência</th>
        </tr>
      </thead>
      <tbody>
        ${groups.map(g => `
        <tr>
          <td><strong>${g.name}</strong></td>
          <td class="td-center" style="color:#DC2626;font-weight:700">${g.total}</td>
          <td class="td-center" style="color:#16A34A">${g.acknowledged}</td>
          <td class="td-center">${duration(g.avg_seconds)}</td>
          <td class="td-center" style="color:#D97706;font-weight:600">${duration(g.max_seconds)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="page-footer">
    <span>FlowSight Sentinel v1.0.0 · Confidencial</span>
    <span>${now}</span>
  </div>
</div>

<!-- ══════════════════════════ DETALHAMENTO ══════════════════════════ -->
${rows.length > 0 ? `
<div class="page page-break">
  <div class="page-header">
    ${LOGO_HTML_SM}
    <div class="page-header-text">
      <h2>Detalhamento Completo</h2>
      <p>${rows.length} ocorrências · Período: ${period}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Registro de Alarmes</div>
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Posto</th>
          <th>Vigilante</th>
          <th class="td-center">Ausência</th>
          <th class="td-center">Limite</th>
          <th class="td-center">Status</th>
          <th>Confirmado por</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td style="white-space:nowrap;color:#6B7280">${fmt(r.triggered_at)}</td>
          <td><strong>${r.post_name||'—'}</strong></td>
          <td>${r.guard_name||'—'}</td>
          <td class="td-center" style="color:${absenceColor(r.absence_minutes)};font-weight:700">${r.absence_minutes} min</td>
          <td class="td-center" style="color:#9CA3AF">${r.threshold_minutes} min</td>
          <td class="td-center">${statusBadge(r.status)}</td>
          <td style="color:#6B7280">${r.acknowledged_by||'—'}${r.acknowledged_at?`<br/><span style="font-size:9px;color:#9CA3AF">${fmt(r.acknowledged_at)}</span>`:''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="page-footer">
    <span>FlowSight Sentinel v1.0.0 · Confidencial</span>
    <span>${now}</span>
  </div>
</div>` : ''}

</body>
</html>`

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format:     'A4',
      printBackground: true,
      margin: { top:'0', right:'0', bottom:'0', left:'0' },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

module.exports = { generateReportPDF }
