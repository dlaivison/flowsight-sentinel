import { useState, useEffect } from 'react'
import { getConfig, updateConfig, getWatchlists } from '../api'

function Section({ title, description, children }) {
  return (
    <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }}>
        <div style={{ fontSize:14, fontWeight:700 }}>{title}</div>
        {description && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{description}</div>}
      </div>
      <div style={{ padding:'0 20px' }}>{children}</div>
    </div>
  )
}

function Row({ label, hint, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--border-subtle)', gap:16, width:'100%' }}>
      <div style={{ flex:'1 1 240px', minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500 }}>{label}</div>
        {hint && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{hint}</div>}
      </div>
      <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap:8 }}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const [config,     setConfig]     = useState({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState({})
  const [saved,      setSaved]      = useState({})
  const [showPass,   setShowPass]   = useState({})
  const [licensed,   setLicensed]   = useState(false)
  const [licKey,     setLicKey]     = useState('')

  // Watchlist
  const [watchlists,       setWatchlists]       = useState([])
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistSaving,  setWatchlistSaving]  = useState(false)
  const [watchlistSaved,   setWatchlistSaved]   = useState(false)
  const [selectedWl,       setSelectedWl]       = useState('')

  useEffect(() => {
    getConfig().then(rows => {
      const m = {}; rows.forEach(r => { m[r.key] = r.value })
      setConfig(m)
      setSelectedWl(m.guards_watchlist_id || '')
      setLoading(false)
    })
  }, [])

  const saveKey = async (key, value) => {
    setSaving(s => ({...s, [key]: true}))
    try {
      await updateConfig(key, value)
      setConfig(c => ({...c, [key]: value}))
      setSaved(s => ({...s, [key]: true}))
      setTimeout(() => setSaved(s => ({...s, [key]: false})), 2000)
    } finally { setSaving(s => ({...s, [key]: false})) }
  }

  const loadWatchlists = async () => {
    setWatchlistLoading(true)
    try {
      const data = await getWatchlists()
      setWatchlists(data)
    } catch(e) {
      alert('Erro ao carregar watchlists do Corsight. Verifique as credenciais.')
    } finally { setWatchlistLoading(false) }
  }

  const saveWatchlist = async () => {
    setWatchlistSaving(true)
    try {
      await updateConfig('guards_watchlist_id', selectedWl)
      setConfig(c => ({...c, guards_watchlist_id: selectedWl}))
      setWatchlistSaved(true)
      setTimeout(() => setWatchlistSaved(false), 2000)
    } finally { setWatchlistSaving(false) }
  }

  const currentWl = watchlists.find(w => w.id === selectedWl)
  const configuredWl = watchlists.find(w => w.id === config.guards_watchlist_id)

  const inp = {
    padding:'8px 12px', background:'var(--bg-primary)',
    border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
    color:'var(--text-primary)', fontSize:12, outline:'none', fontFamily:'inherit',
  }

  const btnSave = (k, val) => ({
    padding:'7px 14px', borderRadius:'var(--radius-sm)', border:'none',
    fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
    background: saved[k] ? 'rgba(0,208,132,0.15)' : saving[k] ? 'var(--bg-hover)' : 'linear-gradient(135deg,#00D084,#00A86B)',
    color: saved[k] ? '#00D084' : saving[k] ? 'var(--text-muted)' : '#000',
  })

  function TextField({ configKey, label, hint, placeholder, secret }) {
    const [val, setVal] = useState(config[configKey]||'')
    useEffect(() => { setVal(config[configKey]||'') }, [config[configKey]])
    return (
      <Row label={label} hint={hint}>
        <input
          type={secret && !showPass[configKey] ? 'password' : 'text'}
          style={{ ...inp, width:260 }} value={val}
          onChange={e => setVal(e.target.value)} placeholder={placeholder}
        />
        {secret && (
          <button onClick={() => setShowPass(s => ({...s, [configKey]: !s[configKey]}))}
            style={{ ...inp, width:'auto', padding:'7px 12px', cursor:'pointer', fontSize:11, color:'var(--text-secondary)' }}>
            {showPass[configKey] ? 'Ocultar' : 'Ver'}
          </button>
        )}
        <button onClick={() => saveKey(configKey, val)}
          disabled={saving[configKey] || val === config[configKey]}
          style={btnSave(configKey, val)}>
          {saving[configKey] ? '..' : saved[configKey] ? '✓ Salvo' : 'Salvar'}
        </button>
      </Row>
    )
  }

  function SliderField({ configKey, label, hint, min, max, step=1, unit='min' }) {
    const [val, setVal] = useState(parseInt(config[configKey])||0)
    useEffect(() => { setVal(parseInt(config[configKey])||0) }, [config[configKey]])
    return (
      <Row label={label} hint={hint}>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => setVal(parseInt(e.target.value))}
          style={{ width:120, accentColor:'#00D084', flexShrink:0 }}/>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', width:52, textAlign:'right', flexShrink:0 }}>{val} {unit}</span>
        <button onClick={() => saveKey(configKey, String(val))}
          disabled={saving[configKey] || String(val) === config[configKey]}
          style={btnSave(configKey, String(val))}>
          {saving[configKey] ? '..' : saved[configKey] ? '✓' : 'Salvar'}
        </button>
      </Row>
    )
  }

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
      Carregando...
    </div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
        <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Parâmetros</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Configurações do sistema e integrações</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Integração Corsight */}
        <Section title="Integração Corsight / Forsight" description="Conexão com a API do Fortify">
          <TextField configKey="forsight_api_url"  label="URL da API"       hint="Endereço base do servidor Forsight" placeholder="https://127.0.0.1"/>
          <TextField configKey="forsight_username" label="Usuário Forsight" hint="Nome de usuário para autenticação"  placeholder="apifortytest"/>
          <TextField configKey="forsight_password" label="Senha Forsight"   hint="Senha do usuário Forsight"          placeholder="••••••••" secret/>
          <SliderField configKey="polling_interval_seconds" label="Intervalo de recálculo" hint="Com que frequência recalcular ausências" min={10} max={120} step={5} unit="s"/>
        </Section>

        {/* Watchlist de Vigilantes */}
        <Section title="Watchlist de Vigilantes" description="Define qual lista do Corsight contém os vigilantes monitorados">
          <div style={{ padding:'16px 0', display:'flex', flexDirection:'column', gap:14 }}>

            {/* Status atual */}
            <div style={{
              background: config.guards_watchlist_id ? 'rgba(0,208,132,0.08)' : 'rgba(240,165,0,0.08)',
              border: `1px solid ${config.guards_watchlist_id ? 'rgba(0,208,132,0.2)' : 'rgba(240,165,0,0.2)'}`,
              borderRadius:'var(--radius-md)', padding:'12px 14px',
              display:'flex', alignItems:'center', gap:10,
            }}>
              <div style={{ fontSize:16 }}>{config.guards_watchlist_id ? '✓' : '⚠'}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color: config.guards_watchlist_id ? 'var(--green)' : '#F0A500' }}>
                  {config.guards_watchlist_id
                    ? `Watchlist configurada: ${configuredWl?.name || config.guards_watchlist_id}`
                    : 'Nenhuma watchlist configurada'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                  {config.guards_watchlist_id
                    ? 'A galeria de vigilantes usa esta lista como fonte'
                    : 'Carregue as watchlists e selecione a lista de vigilantes'}
                </div>
              </div>
            </div>

            {/* Seletor */}
            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>
                  Watchlist do Corsight
                </label>
                <select
                  style={{ ...inp, width:'100%', appearance:'none' }}
                  value={selectedWl}
                  onChange={e => setSelectedWl(e.target.value)}
                  disabled={watchlists.length === 0}
                >
                  <option value="">
                    {watchlists.length === 0
                      ? '— Clique em "Carregar" para buscar as watchlists —'
                      : '— Selecione uma watchlist —'}
                  </option>
                  {watchlists.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type === 'whitelist' ? 'whitelist' : 'blacklist'})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadWatchlists}
                disabled={watchlistLoading}
                style={{ padding:'8px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                {watchlistLoading ? 'Carregando...' : '↺ Carregar listas'}
              </button>
              <button
                onClick={saveWatchlist}
                disabled={watchlistSaving || !selectedWl || selectedWl === config.guards_watchlist_id}
                style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                  background: watchlistSaved ? 'rgba(0,208,132,0.15)' : selectedWl && selectedWl !== config.guards_watchlist_id ? 'linear-gradient(135deg,#00D084,#00A86B)' : 'var(--bg-hover)',
                  color: watchlistSaved ? 'var(--green)' : selectedWl && selectedWl !== config.guards_watchlist_id ? '#000' : 'var(--text-muted)',
                }}>
                {watchlistSaving ? 'Salvando...' : watchlistSaved ? '✓ Salvo' : 'Salvar'}
              </button>
            </div>

            {/* Info da watchlist selecionada */}
            {selectedWl && currentWl && selectedWl !== config.guards_watchlist_id && (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>
                <span style={{ color:'var(--text-muted)', fontSize:10, textTransform:'uppercase', fontWeight:700, letterSpacing:'0.5px' }}>Selecionada: </span>
                {currentWl.name}
                {currentWl.notes && <span style={{ color:'var(--text-muted)' }}> — {currentWl.notes}</span>}
              </div>
            )}

            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.6 }}>
              Os vigilantes serão carregados exclusivamente desta lista. A galeria de cadastro mostrará apenas os POIs que pertencem à watchlist selecionada.
            </div>
          </div>
        </Section>

        {/* Thresholds */}
        <Section title="Thresholds padrão" description="Aplicados ao criar novos postos (ajustáveis individualmente por posto)">
          <SliderField configKey="default_warning_threshold" label="Aviso após"  hint="Tempo para status atenção (âmbar)"    min={5}  max={60}  step={5}/>
          <SliderField configKey="default_absence_threshold" label="Alarme após" hint="Tempo para disparar alarme (vermelho)" min={10} max={120} step={5}/>
        </Section>

        {/* WhatsApp */}
        <Section title="Módulo WhatsApp" description="Licença adicional necessária para ativar notificações">
          {licensed ? (
            <div style={{ padding:'14px 0' }}>
              <div style={{ background:'rgba(0,208,132,0.1)', border:'1px solid rgba(0,208,132,0.3)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:18 }}>✓</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>Módulo WhatsApp ativo</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>Licença válida</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding:'16px 0', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px', fontSize:12, color:'var(--text-secondary)', lineHeight:1.7 }}>
                Com este módulo ativo você recebe alertas de ausência no WhatsApp, configura múltiplos destinatários e define quais grupos geram notificações. Integração via Z-API.
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:8 }}>Chave de licença</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{ ...inp, flex:1, fontFamily:'monospace', letterSpacing:'0.05em' }}
                    value={licKey} onChange={e => setLicKey(e.target.value)}
                    placeholder="FLOW-XXXX-XXXX-XXXX-XXXX"/>
                  <button onClick={() => licKey.trim() && setLicensed(true)}
                    style={{ padding:'9px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                    Ativar
                  </button>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
                  Adquira uma licença com a equipe FlowSight. Cada licença é vinculada a este servidor.
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Versão */}
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>FlowSight Sentinel v1.0.0</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>Monitoramento de postos de vigilância · On-premises</div>
          </div>
          <div style={{ textAlign:'right', fontSize:11, color:'var(--text-muted)' }}>
            <div>Node.js + React + PostgreSQL</div>
            <div>Corsight/Forsight API v0.41.1</div>
          </div>
        </div>

      </div>
    </div>
  )
}
