import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { ErroHttp } from './erros.js';
import { db } from './db/connection.js';
import { cabecalhosSeguros, cors, ehRotaDeApi, semCache, verificarOrigem } from './middlewares/seguranca.js';
import { carregarSessao, exigirLogin, exigirPapel } from './middlewares/autenticacao.js';
import { logarRequisicoes } from './middlewares/log.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';

export const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

app.use(logarRequisicoes);
app.use(cabecalhosSeguros);
app.use(cors);
app.use(verificarOrigem);
app.use(express.json({ limit: '10kb' }));
app.use(carregarSessao);

// Tela visual do admin, servida pela própria API: mesma origem do cookie, sem CORS a configurar.
const pastaPublica = path.join(import.meta.dirname, '..', 'public');
app.use(express.static(pastaPublica));
app.get('/admin', (req, res) => res.sendFile(path.join(pastaPublica, 'admin.html')));

// Health check de verdade: confere que o banco responde (útil para monitoramento/deploy).
app.get('/saude', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, erro: 'Banco indisponível' });
  }
});
app.get('/api', (req, res) => res.json({ api: 'meu-sistema', rotas: ['/saude', '/auth', '/usuarios', '/admin'] }));

app.use('/auth', semCache, authRouter);
app.use('/usuarios', exigirLogin, exigirPapel('admin'), usuariosRouter);

// App React: se o frontend foi compilado (npm run build:front), a própria API o serve — um único
// endereço para tudo, sem CORS. Rotas do app (/entrar, /conta...) caem no index.html.
const pastaApp = path.join(import.meta.dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(pastaApp, 'index.html'))) {
  app.use(express.static(pastaApp));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || ehRotaDeApi(req.path) || req.path.includes('.')) return next();
    res.sendFile(path.join(pastaApp, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Tratamento central de erros (Express 5 já encaminha erros de handlers async para cá).
app.use((erro, req, res, next) => {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message, ...erro.detalhes });
  }
  if (typeof erro.code === 'string' && erro.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ erro: 'Conflito com dados existentes (ex.: e-mail já cadastrado)' });
  }
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Corpo da requisição grande demais' });
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno' });
});
