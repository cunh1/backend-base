import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');

export const config = {
  porta: Number(process.env.PORT) || 3000,
  caminhoBanco: process.env.DB_PATH || path.join(raiz, 'data', 'app.sqlite'),
  pastaMigracoes: path.join(raiz, 'src', 'db', 'migrations'),
};
