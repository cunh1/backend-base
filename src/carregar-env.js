// Carrega variáveis de um arquivo .env na raiz do projeto, se ele existir (suporte nativo do Node 20.6+).
// Importe este módulo ANTES de qualquer outro que leia process.env (config.js, connection.js...) —
// entre imports, o Node avalia cada um por completo na ordem em que aparecem no arquivo.
try {
  process.loadEnvFile();
} catch {
  // Sem .env (ex.: variáveis já exportadas no ambiente, como em produção) — segue normalmente.
}
