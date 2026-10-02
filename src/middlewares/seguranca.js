import { config } from '../config.js';

/** Caminhos que só devolvem JSON. Todo o resto é HTML/JS/CSS (app React ou tela do admin). */
export const ehRotaDeApi = (caminho) => /^\/(auth|usuarios|saude|api)(\/|$)/.test(caminho);

function politicaDe(caminho) {
  // A tela /admin é HTML com script e estilo inline, então precisa de 'unsafe-inline'.
  if (caminho === '/admin' || caminho === '/admin.html') {
    return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";
  }
  // O app React (build do Vite) usa só arquivos próprios: nada inline, nada de outros domínios.
  if (!ehRotaDeApi(caminho)) {
    return "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";
  }
  // A API só devolve JSON: política mais restrita possível.
  return "default-src 'none'; frame-ancestors 'none'";
}

/** Cabeçalhos básicos de segurança (o pacote "helmet" faz isso e mais; dá para trocar depois). */
export function cabecalhosSeguros(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', politicaDe(req.path));
  if (config.producao) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/** Respostas de autenticação nunca devem ficar em cache. */
export function semCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/** CORS só para as origens da lista, com cookies liberados. */
export function cors(req, res, next) {
  const origem = req.headers.origin;
  if (origem) res.append('Vary', 'Origin');

  if (origem && config.origensPermitidas.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
  } else if (req.method === 'OPTIONS') {
    return res.status(204).end(); // sem cabeçalhos CORS: o navegador bloqueia
  }
  next();
}

/**
 * Proteção contra CSRF: requisições que alteram dados vindas de um navegador
 * precisam ser de uma origem autorizada. (Junto com o cookie SameSite=Lax, são duas camadas.)
 * Clientes que não são navegadores (curl, apps) não mandam Origin e passam; não dependem de cookie do navegador.
 */
export function verificarOrigem(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.headers.origin;
  if (origem && !config.origensPermitidas.includes(origem)) {
    return res.status(403).json({ erro: 'Origem não permitida' });
  }
  next();
}
