require('dotenv').config({ path: '/opt/flowsight-sentinel/.env' });
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { WebSocketServer } = require('ws');

const { pool }      = require('./db');
const absenceEngine = require('./services/absence.engine');
const watchlistSync = require('./services/watchlist.sync');
const alarmService  = require('./services/alarm.service');

const app    = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
  console.log('[WS] Cliente conectado');
  try {
    const snapshot     = await absenceEngine.getSnapshot();
    const activeAlarms = await alarmService.getActiveAlarms();
    ws.send(JSON.stringify({ type: 'INITIAL_STATE', payload: { snapshot, activeAlarms } }));
  } catch (err) {
    console.error('[WS] Erro ao enviar estado inicial:', err.message);
  }
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
    } catch (_) {}
  });
  ws.on('close', () => console.log('[WS] Cliente desconectado'));
});

alarmService.setWebSocketServer(wss);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',      require('./api/auth.routes'));
app.use('/api/posts',     require('./api/posts.routes'));
app.use('/api/guards',    require('./api/guards.routes'));
app.use('/api/alarms',    require('./api/alarms.routes'));
app.use('/api/dashboard', require('./api/dashboard.routes'));
app.use('/api/config',    require('./api/config.routes'));
app.use('/api/cameras',   require('./api/cameras.routes'));
app.use('/api/forsight',  require('./api/forsight.routes'));
app.use('/api/shifts',         require('./api/shifts.routes'));
app.use('/api/justifications', require('./api/justifications.routes'));
app.use('/api/reports',        require('./api/reports.routes'));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', engine: absenceEngine.isRunning ? 'running' : 'stopped', lastPoll: absenceEngine.lastPollAt });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`\n🚀 FlowSight Sentinel rodando na porta ${PORT}`);
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL conectado ✓');
    await watchlistSync.start();
    await absenceEngine.start();
  } catch (err) {
    console.error('[FATAL]', err.message);
  }
});

process.on('SIGTERM', async () => {
  absenceEngine.stop();
  await pool.end();
  server.close(() => process.exit(0));
});
