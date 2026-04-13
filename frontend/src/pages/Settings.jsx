import { useState, useEffect } from 'react'
import { getConfig, updateConfig, getWatchlists, getAbsenceReasons, createAbsenceReason, updateAbsenceReason, deleteAbsenceReason } from '../api'

const TABS = [
  { key:'integration', label:'Integração' },
  { key:'watchlist',   label:'Watchlist'  },
  { key:'thresholds',  label:'Thresholds' },
  { key:'reasons',     label:'Motivos'    },
  { key:'whatsapp',    label:'WhatsApp'   },
]

const TYPE_LABELS = { post:'Posto', individual:'Individual', both:'Ambos' }
const TYPE_COLORS = { post:'#58A6FF', individual:'#00D084', both:'#F0A500' }

const inp = {
  padding:'8px 12px', background:'var(--bg-primary)',
  border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
  color:'var(--text-primary)', fontSize:12, outline:'none', fontFamily:'inherit',
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--border-subtle)', gap:16 }}>
      <div style={{ flex:'1 1 240px' }}>
        <div style={{ fontSize:13, fontWeight:500 }}>{label}</div>
        {hint && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{hint}</div>}
      </div>
      <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap:8 }}>{children}</div>
    </div>
  )
}

function ReasonModal({ reason, onClose, onSave }) {
  const isEdit = !!reason?.id
  const [form, setForm] = useState({
    name:            reason?.name            || '',
    type:            reason?.type            || 'both',
    default_minutes: reason?.default_minutes || 15,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      if (isEdit) await updateAbsenceReason(reason.id, form)
      else        await createAbsenceReason(form)
      onSave()
    } catch(e) { setError(e.response?.data?.error || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:400, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
          <span style={{ fontSize:15, fontWeight:700 }}>{isEdit ? 'Editar motivo' : 'Novo motivo'}</span>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg-hover)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Nome *</label>
            <input style={{ ...inp, width:'100%' }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Banheiro, Almoço..."/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Tipo</label>
            <div style={{ display:'flex', gap:8 }}>
              {Object.entries(TYPE_LABELS).map(([v,l]) => (
                <label key={v} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:'var(--radius-sm)', cursor:'pointer', border:`1px solid ${form.type===v ? TYPE_COLORS[v]+'66' : 'var(--border-subtle)'}`, background:form.type===v ? TYPE_COLORS[v]+'11' : 'var(--bg-card)', fontSize:12, fontWeight:form.type===v?700:400, color:form.type===v?TYPE_COLORS[v]:'var(--text-secondary)' }}>
                  <input type="radio" name="type" value={v} checked={form.type===v} onChange={()=>setForm(f=>({...f,type:v}))} style={{ display:'none' }}/>
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>
              Duração padrão — {form.default_minutes} min
            </label>
            <input type="range" min="5" max="120" step="5" value={form.default_minutes}
              onChange={e=>setForm(f=>({...f,default_minutes:parseInt(e.target.value)}))}
              style={{ width:'100%', accentColor:'#00D084' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
              <span>5min</span><span>120min</span>
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

export default function Settings() {
  const [tab,        setTab]        = useState('integration')
  const [config,     setConfig]     = useState({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState({})
  const [saved,      setSaved]      = useState({})
  const [showPass,   setShowPass]   = useState({})

  // Watchlist
  const [watchlists,       setWatchlists]       = useState([])
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistSaving,  setWatchlistSaving]  = useState(false)
  const [watchlistSaved,   setWatchlistSaved]   = useState(false)
  const [selectedWl,       setSelectedWl]       = useState('')

  // Motivos
  const [reasons,      setReasons]      = useState([])
  const [reasonModal,  setReasonModal]  = useState(null)
  const [deleting,     setDeleting]     = useState(null)

  useEffect(() => {
    getConfig().then(rows => {
      const m = {}; rows.forEach(r => { m[r.key] = r.value })
      setConfig(m)
      setSelectedWl(m.guards_watchlist_id || '')
      setLoading(false)
    })
    loadReasons()
  }, [])

  const loadReasons = async () => {
    try { const res = await getAbsenceReasons(); setReasons(res.data || res || []) } catch(_) {}
  }

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
    try { const res = await getWatchlists(); setWatchlists(res.data || res || []) }
    catch { alert('Erro ao carregar watchlists') }
    finally { setWatchlistLoading(false) }
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

  const handleDeleteReason = async (id) => {
    if (!confirm('Remover este motivo?')) return
    setDeleting(id)
    try { await deleteAbsenceReason(id); await loadReasons() }
    catch(e) { alert(e.response?.data?.error || 'Erro ao remover') }
    finally { setDeleting(null) }
  }

  const configuredWl = Array.isArray(watchlists) ? watchlists.find(w => w.id === config.guards_watchlist_id) : null
  const currentWl    = Array.isArray(watchlists) ? watchlists.find(w => w.id === selectedWl) : null

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
      <Field label={label} hint={hint}>
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
      </Field>
    )
  }

  function SliderField({ configKey, label, hint, min, max, step=1, unit='min' }) {
    const [val, setVal] = useState(parseInt(config[configKey])||0)
    useEffect(() => { setVal(parseInt(config[configKey])||0) }, [config[configKey]])
    return (
      <Field label={label} hint={hint}>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => setVal(parseInt(e.target.value))}
          style={{ width:120, accentColor:'#00D084', flexShrink:0 }}/>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', width:52, textAlign:'right', flexShrink:0 }}>{val} {unit}</span>
        <button onClick={() => saveKey(configKey, String(val))}
          disabled={saving[configKey] || String(val) === config[configKey]}
          style={btnSave(configKey, String(val))}>
          {saving[configKey] ? '..' : saved[configKey] ? '✓' : 'Salvar'}
        </button>
      </Field>
    )
  }

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>Carregando...</div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
        <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Parâmetros</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Configurações do sistema e integrações</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', padding:'0 24px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 18px', border:'none', background:'transparent',
            color: tab===t.key ? 'var(--green)' : 'var(--text-muted)',
            fontSize:13, fontWeight: tab===t.key ? 700 : 400, cursor:'pointer',
            borderBottom: tab===t.key ? '2px solid var(--green)' : '2px solid transparent',
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* ─── INTEGRAÇÃO ─── */}
        {tab === 'integration' && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Integração Corsight / Forsight</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Conexão com a API do Fortify</div>
            </div>
            <div style={{ padding:'0 20px' }}>
              <TextField configKey="forsight_api_url"  label="URL da API"       hint="Endereço base do servidor Forsight" placeholder="https://127.0.0.1"/>
              <TextField configKey="forsight_username" label="Usuário Forsight" hint="Nome de usuário para autenticação"  placeholder="apifortytest"/>
              <TextField configKey="forsight_password" label="Senha Forsight"   hint="Senha do usuário Forsight"          placeholder="••••••••" secret/>
              <SliderField configKey="polling_interval_seconds" label="Intervalo de recálculo" hint="Com que frequência recalcular ausências" min={10} max={120} step={5} unit="s"/>
              <SliderField configKey="watchlist_sync_interval" label="Sincronização da watchlist" hint="Com que frequência sincronizar vigilantes do Fortify" min={1} max={60} step={1} unit="min"/>
              <Field label="Modo de alocação" hint="Specific: vigilante por posto | All to All: qualquer vigilante cobre qualquer posto">
                <select
                  defaultValue={config.allocation_mode || 'specific'}
                  onChange={e => saveKey('allocation_mode', e.target.value)}
                  style={{ padding:'7px 12px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:12, outline:'none' }}>
                  <option value="specific">Específico — vigilante por posto</option>
                  <option value="all_to_all">Todos para Tudo — qualquer vigilante cobre qualquer posto</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* ─── WATCHLIST ─── */}
        {tab === 'watchlist' && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Watchlist de Vigilantes</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Define qual lista do Corsight contém os vigilantes monitorados</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
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
                    {config.guards_watchlist_id ? 'A galeria usa esta lista como fonte' : 'Carregue as watchlists e selecione a lista de vigilantes'}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6 }}>Watchlist do Corsight</label>
                  <select style={{ ...inp, width:'100%' }} value={selectedWl} onChange={e=>setSelectedWl(e.target.value)} disabled={watchlists.length===0}>
                    <option value="">{watchlists.length===0 ? '— Clique em Carregar —' : '— Selecione —'}</option>
                    {watchlists.map(w => <option key={w.id} value={w.id}>{w.name} ({w.type})</option>)}
                  </select>
                </div>
                <button onClick={loadWatchlists} disabled={watchlistLoading} style={{ padding:'8px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {watchlistLoading ? 'Carregando...' : '↺ Carregar'}
                </button>
                <button onClick={saveWatchlist} disabled={watchlistSaving||!selectedWl||selectedWl===config.guards_watchlist_id} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                  background: watchlistSaved ? 'rgba(0,208,132,0.15)' : selectedWl&&selectedWl!==config.guards_watchlist_id ? 'linear-gradient(135deg,#00D084,#00A86B)' : 'var(--bg-hover)',
                  color: watchlistSaved ? 'var(--green)' : selectedWl&&selectedWl!==config.guards_watchlist_id ? '#000' : 'var(--text-muted)',
                }}>
                  {watchlistSaving ? 'Salvando...' : watchlistSaved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
              {selectedWl && currentWl && selectedWl!==config.guards_watchlist_id && (
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>
                  Selecionada: {currentWl.name}{currentWl.notes ? ` — ${currentWl.notes}` : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── THRESHOLDS ─── */}
        {tab === 'thresholds' && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Thresholds padrão</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Aplicados ao criar novos postos</div>
            </div>
            <div style={{ padding:'0 20px' }}>
              <SliderField configKey="default_warning_threshold" label="Aviso após"  hint="Tempo para status atenção (âmbar)"    min={5}  max={60}  step={5}/>
              <SliderField configKey="default_absence_threshold" label="Alarme após" hint="Tempo para disparar alarme (vermelho)" min={10} max={120} step={5}/>
            </div>
          </div>
        )}

        {/* ─── MOTIVOS ─── */}
        {tab === 'reasons' && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Motivos de Ausência Justificada</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Defina os motivos disponíveis ao justificar uma ausência</div>
              </div>
              <button onClick={() => setReasonModal({})} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,208,132,0.3)', background:'rgba(0,208,132,0.1)', color:'var(--green)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                <span style={{ fontSize:16 }}>+</span> Novo motivo
              </button>
            </div>
            <div style={{ padding:'8px 0' }}>
              {reasons.length === 0 ? (
                <div style={{ padding:'30px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>Nenhum motivo cadastrado</div>
              ) : reasons.map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{r.default_minutes} min padrão</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12,
                    background:`${TYPE_COLORS[r.type]}18`, color:TYPE_COLORS[r.type],
                    border:`1px solid ${TYPE_COLORS[r.type]}33` }}>
                    {TYPE_LABELS[r.type]}
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setReasonModal(r)} style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Editar</button>
                    <button onClick={() => handleDeleteReason(r.id)} disabled={deleting===r.id} style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(255,68,68,0.3)', background:'rgba(255,68,68,0.08)', color:'#FF4444', fontSize:12, cursor:'pointer' }}>
                      {deleting===r.id ? '...' : 'Remover'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── WHATSAPP ─── */}
        {tab === 'whatsapp' && (
          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Módulo WhatsApp</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Licença adicional necessária</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px', fontSize:12, color:'var(--text-secondary)', lineHeight:1.7 }}>
                Com este módulo ativo você recebe alertas de ausência no WhatsApp, configura múltiplos destinatários e define quais grupos geram notificações. Integração via Z-API.
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:8 }}>Chave de licença</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{ ...inp, flex:1, fontFamily:'monospace' }} placeholder="FLOW-XXXX-XXXX-XXXX-XXXX"/>
                  <button style={{ padding:'9px 20px', borderRadius:'var(--radius-sm)', border:'none', background:'linear-gradient(135deg,#00D084,#00A86B)', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer' }}>Ativar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Versão */}
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>FlowSight Sentinel v1.0.0</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>Monitoramento de postos de vigilância · On-premises</div>
          </div>
          <div style={{ textAlign:'right', fontSize:11, color:'var(--text-muted)' }}>
            <div>Node.js + React + PostgreSQL</div>
            <div>Corsight/Forsight API v1.4.0</div>
          </div>
        </div>
      </div>

      {reasonModal !== null && (
        <ReasonModal
          reason={reasonModal?.id ? reasonModal : null}
          onClose={() => setReasonModal(null)}
          onSave={() => { setReasonModal(null); loadReasons() }}
        />
      )}
    </div>
  )
}
