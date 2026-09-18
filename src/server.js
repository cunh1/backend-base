import { config } from './config.js';
import { db } from './db/connection.js';
import { migrar } from './db/migrate.js';
import { app } from './app.js';

// Aplica migrações pendentes sempre que o servidor sobe.
const novas = migrar(db, config.pastaMigracoes);
if (novas.length) console.log('Migrações aplicadas:', novas.join(', '));

app.listen(config.porta, () => {
  console.log(`API rodando em http://localhost:${config.porta}`);
});
