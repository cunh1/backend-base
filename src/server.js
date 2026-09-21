import { config } from './config.js';
import { db } from './db/connection.js';
import { migrar } from './db/migrate.js';
import { limparExpirados } from './auth/manutencao.js';
import { app } from './app.js';

// Aplica migrações pendentes sempre que o servidor sobe.
const novas = migrar(db, config.pastaMigracoes);
if (novas.length) console.log('Migrações aplicadas:', novas.join(', '));

// Limpa sessões/tokens vencidos agora e a cada hora.
limparExpirados();
setInterval(limparExpirados, 60 * 60 * 1000).unref();

app.listen(config.porta, () => {
  console.log(`API rodando em http://localhost:${config.porta}`);
});
