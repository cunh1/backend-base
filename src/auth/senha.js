import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';

const scrypt = promisify(crypto.scrypt);
const TAM_CHAVE = 64;

function derivar(senha, salt, { N, r, p }) {
  // maxmem precisa ser maior que 128*N*r bytes, senão o Node recusa.
  return scrypt(senha.normalize('NFKC'), salt, TAM_CHAVE, { N, r, p, maxmem: 256 * N * r });
}

/** Formato guardado: scrypt$N$r$p$salt$hash — os parâmetros vão junto para poder evoluí-los depois. */
export async function hashSenha(senha) {
  const params = { ...config.auth.scrypt };
  const salt = crypto.randomBytes(16);
  const chave = await derivar(senha, salt, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), chave.toString('base64')].join('$');
}

/** Retorna { ok, precisaRehash }. precisaRehash = senha correta, mas guardada com parâmetros antigos. */
export async function verificarSenha(senha, armazenado) {
  try {
    const partes = String(armazenado).split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return { ok: false, precisaRehash: false };
    const [, N, r, p, saltB64, chaveB64] = partes;
    const params = { N: Number(N), r: Number(r), p: Number(p) };
    const esperado = Buffer.from(chaveB64, 'base64');
    const chave = await derivar(senha, Buffer.from(saltB64, 'base64'), params);
    const ok = chave.length === esperado.length && crypto.timingSafeEqual(chave, esperado);
    const atual = config.auth.scrypt;
    const precisaRehash = ok && (params.N !== atual.N || params.r !== atual.r || params.p !== atual.p);
    return { ok, precisaRehash };
  } catch {
    return { ok: false, precisaRehash: false };
  }
}

// Hash de mentira, usado quando o e-mail não existe: assim o login gasta o mesmo tempo
// nos dois casos e não dá para descobrir quais e-mails têm conta pelo tempo de resposta.
let hashFalso;
export const obterHashFalso = () => (hashFalso ??= hashSenha(crypto.randomBytes(16).toString('hex')));

// Só senhas com 12+ caracteres chegam aqui, então a lista tem só as comuns desse tamanho.
// Em produção, troque por uma lista maior ou pela API Pwned Passwords.
const COMUNS = new Set([
  'password1234', 'password12345', 'passwordpassword', 'letmein123456', 'iloveyou1234',
  '123456789012', '1234567890123', '12345678901234', '123123123123', '111111111111',
  '000000000000', 'qwertyuiop12', 'qwertyuiop123', 'abcdefghijkl', 'senha1234567',
  'senha12345678', 'senhasenhasenha', 'mudar1234567', 'administrador', 'brasilbrasil',
]);

/** Segue a linha do NIST: foco em tamanho e senhas conhecidas, sem regras de "1 maiúscula + 1 símbolo". */
export function validarSenha(senha, { email = '' } = {}) {
  if (typeof senha !== 'string') return ['senha é obrigatória'];
  const erros = [];
  const { senhaMin, senhaMax } = config.auth;
  const tamanho = [...senha].length;
  const minusculas = senha.toLowerCase();

  if (tamanho < senhaMin) erros.push(`a senha deve ter pelo menos ${senhaMin} caracteres`);
  if (tamanho > senhaMax) erros.push(`a senha deve ter no máximo ${senhaMax} caracteres`);
  if (COMUNS.has(minusculas)) erros.push('essa senha é muito comum');
  if (new Set(senha).size < 5) erros.push('use mais variedade de caracteres');

  const parteLocal = email.split('@')[0].toLowerCase();
  if (parteLocal.length >= 4 && minusculas.includes(parteLocal)) erros.push('a senha não pode conter o seu e-mail');
  return erros;
}
