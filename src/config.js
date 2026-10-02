import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const producao = process.env.NODE_ENV === 'production';
const lista = (texto) => texto.split(',').map((s) => s.trim()).filter(Boolean);

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export const config = {
  producao,
  porta: Number(process.env.PORT) || 3000,
  caminhoBanco: process.env.DB_PATH || path.join(raiz, 'data', 'app.sqlite'),
  pastaMigracoes: path.join(raiz, 'src', 'db', 'migrations'),

  // Frontends autorizados a chamar a API com cookies (CORS + checagem de Origin).
  origensPermitidas: lista(process.env.ORIGENS_PERMITIDAS || 'http://localhost:5173,http://localhost:3000'),
  // Base dos links enviados por e-mail (verificação e redefinição de senha).
  urlFrontend: process.env.URL_FRONTEND || 'http://localhost:5173',
  // Quantos proxies confiáveis existem na frente da API (ex.: 1 atrás do Nginx).
  // Sem isso, req.ip seria o IP do proxy e o limite por IP não funcionaria.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,

  auth: {
    nomeCookie: producao ? '__Host-sid' : 'sid', // __Host- exige HTTPS, por isso só em produção
    sessaoInatividadeMs: 7 * DIA, // sem uso por 7 dias => expira
    sessaoMaxMs: 30 * DIA, // duração máxima, mesmo com uso
    maxSessoesPorUsuario: 10,

    tokenVerificacaoMs: DIA,
    tokenResetMs: HORA,

    janelaTentativasMs: 15 * MIN,
    maxFalhasPorEmail: 5,
    maxFalhasPorIp: 20,
    janelaResetMs: HORA,
    maxPedidosResetPorEmail: 3,
    maxPedidosResetPorIp: 10,

    senhaMin: 12,
    senhaMax: 128,
    // OWASP: scrypt com N=2^17, r=8, p=1 (~128 MiB por hash). SCRYPT_N existe só para acelerar testes.
    scrypt: { N: Number(process.env.SCRYPT_N) || 2 ** 17, r: 8, p: 1 },
  },
};
