import express from 'express';
import usuariosRouter from './routes/usuarios.js';

export const app = express();

app.use(express.json());

app.get('/saude', (req, res) => res.json({ ok: true }));
app.use('/usuarios', usuariosRouter);

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Tratamento central de erros (Express 5 já encaminha erros de handlers para cá).
app.use((erro, req, res, next) => {
  if (typeof erro.code === 'string' && erro.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ erro: 'Conflito com dados existentes (ex.: e-mail já cadastrado)' });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido' });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno' });
});
