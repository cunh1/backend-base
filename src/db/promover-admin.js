import { db } from './connection.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run admin:promover -- email@exemplo.com');
  process.exit(1);
}

const info = db.prepare("UPDATE usuarios SET papel = 'admin' WHERE lower(email) = ?").run(email);
console.log(info.changes ? `${email} agora é admin.` : 'Nenhum usuário com esse e-mail.');
db.close();
