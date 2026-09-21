import { config } from '../config.js';
import { ErroHttp } from '../erros.js';
import { emTransacao } from '../db/connection.js';
import { enviarEmail } from '../servicos/email.js';
import * as credenciais from '../repositories/credenciais.js';
import * as limitador from './limitador.js';
import { hashSenha, verificarSenha, validarSenha, obterHashFalso } from './senha.js';
import { criarSessao, revogarSessao, revogarTodas } from './sessoes.js';
import { criarTokenUsuario, consultarToken, consumirToken } from './tokens.js';

const normalizarEmail = (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase() : '');
const emailValido = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const ipDe = (ip) => ip ?? 'desconhecido';

// Envio em segundo plano: a resposta HTTP não espera o e-mail (evita revelar, pelo tempo, se a conta existe)
// e uma falha no provedor não derruba a requisição.
function enviarSemEsperar(mensagem) {
  enviarEmail(mensagem).catch((erro) => console.error('Falha ao enviar e-mail:', erro.message));
}

const linkInvalido = () => new ErroHttp(400, 'Link inválido ou expirado');
const muitasTentativas = () => new ErroHttp(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');

/**
 * Cadastro. Resolve do mesmo jeito exista o e-mail ou não: quem chama nunca descobre se o e-mail já tem conta
 * (quem tem conta recebe um aviso por e-mail). O usuário confirma o e-mail pelo link enviado.
 */
export async function registrar(corpo = {}) {
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  const email = normalizarEmail(corpo.email);

  const erros = [];
  if (!nome || nome.length > 120) erros.push('nome é obrigatório (até 120 caracteres)');
  if (!emailValido(email)) erros.push('e-mail inválido');
  erros.push(...validarSenha(corpo.senha, { email }));
  if (erros.length) throw new ErroHttp(400, 'Dados inválidos', { erros });

  // O hash é calculado sempre, antes de saber se o e-mail existe, para o tempo de resposta ser parecido.
  const senhaHash = await hashSenha(corpo.senha);
  const { criado, id } = credenciais.criarComSenha({ nome, email, senhaHash });

  if (criado) {
    const token = criarTokenUsuario(id, 'verificar_email', config.auth.tokenVerificacaoMs);
    enviarSemEsperar({
      para: email,
      assunto: 'Confirme seu e-mail',
      texto: `Olá, ${nome}!\n\nConfirme seu e-mail pelo link abaixo (vale por 24 horas):\n${config.urlFrontend}/verificar-email?token=${token}\n`,
    });
  } else {
    enviarSemEsperar({
      para: email,
      assunto: 'Você já tem uma conta',
      texto:
        'Alguém tentou criar uma conta com este e-mail, mas ele já está cadastrado.\n' +
        `Se foi você, entre normalmente ou use "Esqueci minha senha": ${config.urlFrontend}/esqueci-senha\n` +
        'Se não foi, pode ignorar esta mensagem.\n',
    });
  }
}

export async function login(corpo = {}, { ip, userAgent } = {}) {
  const email = normalizarEmail(corpo.email);
  const senha = corpo.senha;
  if (!email || typeof senha !== 'string' || !senha || senha.length > 1024) {
    throw new ErroHttp(400, 'Informe e-mail e senha');
  }

  const { janelaTentativasMs: janela, maxFalhasPorEmail, maxFalhasPorIp } = config.auth;
  const chaveEmail = `email:${email}`;
  const chaveIp = `ip:${ipDe(ip)}`;

  // O bloqueio vem ANTES de conferir a senha: enquanto bloqueado, nem a senha certa entra,
  // então o bloqueio não pode ser usado para "testar" senhas.
  if (limitador.contar(chaveEmail, janela) >= maxFalhasPorEmail || limitador.contar(chaveIp, janela) >= maxFalhasPorIp) {
    throw muitasTentativas();
  }

  const usuario = credenciais.buscarPorEmail(email);
  const alvo = usuario?.senha_hash ?? (await obterHashFalso());
  const { ok, precisaRehash } = await verificarSenha(senha, alvo);

  if (!usuario || !usuario.senha_hash || !ok) {
    limitador.registrar(chaveEmail);
    limitador.registrar(chaveIp);
    throw new ErroHttp(401, 'E-mail ou senha inválidos'); // mesma mensagem para "não existe" e "senha errada"
  }

  limitador.limpar(chaveEmail);
  if (precisaRehash) credenciais.atualizarHash(usuario.id, await hashSenha(senha));

  const token = criarSessao(usuario.id, { ip, userAgent });
  return { token, usuario: credenciais.paraPublico(usuario) };
}

export function logout(token) {
  revogarSessao(token);
}

export function encerrarTodasAsSessoes(usuarioId) {
  revogarTodas(usuarioId);
}

export async function alterarSenha(usuario, tokenAtual, corpo = {}) {
  const { senhaAtual, novaSenha } = corpo;
  if (typeof senhaAtual !== 'string' || !senhaAtual || senhaAtual.length > 1024) {
    throw new ErroHttp(400, 'Informe a senha atual');
  }

  // Quem está com a sessão roubada também não pode chutar a senha atual à vontade.
  const chave = `troca:${usuario.id}`;
  if (limitador.contar(chave, config.auth.janelaTentativasMs) >= config.auth.maxFalhasPorEmail) throw muitasTentativas();

  const registro = credenciais.buscarPorId(usuario.id);
  const { ok } = await verificarSenha(senhaAtual, registro.senha_hash ?? (await obterHashFalso()));
  if (!registro.senha_hash || !ok) {
    limitador.registrar(chave);
    throw new ErroHttp(401, 'Senha atual incorreta');
  }

  const erros = validarSenha(novaSenha, { email: usuario.email });
  if (novaSenha === senhaAtual) erros.push('a nova senha deve ser diferente da atual');
  if (erros.length) throw new ErroHttp(400, 'Dados inválidos', { erros });

  const hash = await hashSenha(novaSenha);
  emTransacao(() => {
    credenciais.definirSenha(usuario.id, hash);
    revogarTodas(usuario.id, { exceto: tokenAtual }); // derruba as outras sessões (ex.: a do invasor)
  });
  limitador.limpar(chave);

  enviarSemEsperar({
    para: usuario.email,
    assunto: 'Sua senha foi alterada',
    texto: `Sua senha foi alterada. Se não foi você, redefina-a agora: ${config.urlFrontend}/esqueci-senha\n`,
  });
}

/** Sempre "funciona" por fora, exista o e-mail ou não. Limita quantos pedidos por e-mail/IP para não virar spam. */
export async function solicitarRedefinicao(corpo = {}, { ip } = {}) {
  const email = normalizarEmail(corpo.email);
  if (!emailValido(email)) return;

  const { janelaResetMs: janela, maxPedidosResetPorEmail, maxPedidosResetPorIp } = config.auth;
  const chaveEmail = `reset-email:${email}`;
  const chaveIp = `reset-ip:${ipDe(ip)}`;
  if (limitador.contar(chaveEmail, janela) >= maxPedidosResetPorEmail || limitador.contar(chaveIp, janela) >= maxPedidosResetPorIp) return;
  limitador.registrar(chaveEmail);
  limitador.registrar(chaveIp);

  const usuario = credenciais.buscarPorEmail(email);
  if (!usuario) return;

  const token = criarTokenUsuario(usuario.id, 'redefinir_senha', config.auth.tokenResetMs);
  enviarSemEsperar({
    para: email,
    assunto: 'Redefinição de senha',
    texto: `Para criar uma nova senha, use o link abaixo (vale por 1 hora):\n${config.urlFrontend}/redefinir-senha?token=${token}\n\nSe você não pediu isso, ignore esta mensagem.\n`,
  });
}

export async function redefinirSenha(corpo = {}) {
  const linha = consultarToken(corpo.token, 'redefinir_senha');
  if (!linha) throw linkInvalido();

  const usuario = credenciais.buscarPorId(linha.usuario_id);
  const erros = validarSenha(corpo.novaSenha, { email: usuario.email });
  if (erros.length) throw new ErroHttp(400, 'Dados inválidos', { erros }); // o token NÃO é gasto por senha fraca

  const hash = await hashSenha(corpo.novaSenha);
  emTransacao(() => {
    if (!consumirToken(linha.id)) throw linkInvalido(); // uso único, mesmo com requisições simultâneas
    credenciais.definirSenha(usuario.id, hash);
    credenciais.marcarEmailVerificado(usuario.id); // quem recebeu o link no e-mail provou que ele é seu
    revogarTodas(usuario.id);
  });

  enviarSemEsperar({
    para: usuario.email,
    assunto: 'Sua senha foi redefinida',
    texto: `Sua senha foi redefinida e todas as sessões foram encerradas. Se não foi você, entre em contato: ${config.urlFrontend}/esqueci-senha\n`,
  });
}

export function verificarEmail(corpo = {}) {
  const linha = consultarToken(corpo.token, 'verificar_email');
  if (!linha) throw linkInvalido();
  emTransacao(() => {
    if (!consumirToken(linha.id)) throw linkInvalido();
    credenciais.marcarEmailVerificado(linha.usuario_id);
  });
}

export function reenviarVerificacao(usuario) {
  if (usuario.emailVerificado) return;
  const chave = `verif:${usuario.id}`;
  if (limitador.contar(chave, config.auth.janelaResetMs) >= config.auth.maxPedidosResetPorEmail) throw muitasTentativas();
  limitador.registrar(chave);

  const token = criarTokenUsuario(usuario.id, 'verificar_email', config.auth.tokenVerificacaoMs);
  enviarSemEsperar({
    para: usuario.email,
    assunto: 'Confirme seu e-mail',
    texto: `Confirme seu e-mail pelo link abaixo (vale por 24 horas):\n${config.urlFrontend}/verificar-email?token=${token}\n`,
  });
}
