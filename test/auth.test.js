import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Banco temporário e scrypt barato: só nos testes.
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
process.env.DB_PATH = path.join(pasta, 'teste.sqlite');
process.env.SCRYPT_N = '1024';

const { db } = await import('../src/db/connection.js');
const { migrar } = await import('../src/db/migrate.js');
const { config } = await import('../src/config.js');
const auth = await import('../src/auth/servico.js');
const sessoes = await import('../src/auth/sessoes.js');
const { hashSenha, verificarSenha, validarSenha } = await import('../src/auth/senha.js');
const { limparExpirados } = await import('../src/auth/manutencao.js');
const { definirTransporte } = await import('../src/servicos/email.js');

migrar(db, config.pastaMigracoes);

const emails = [];
definirTransporte(async (mensagem) => {
  emails.push(mensagem);
});
const tokenDoUltimoEmail = () => emails.at(-1).texto.match(/token=([\w-]+)/)[1];

const SENHA = 'correto cavalo bateria grampo';
const PASSADO = '2000-01-01 00:00:00';

async function cadastrar(email, senha = SENHA) {
  await auth.registrar({ nome: 'Fulano', email, senha });
}
const entrar = (email, senha = SENHA, ip = '10.0.0.1') => auth.login({ email, senha }, { ip, userAgent: 'teste' });
const rejeita = (promessa, status) => assert.rejects(promessa, (erro) => erro.status === status);

after(() => {
  db.close();
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('hash de senha: confere, rejeita senha errada e nunca guarda a senha em texto', async () => {
  const hash = await hashSenha(SENHA);
  assert.match(hash, /^scrypt\$1024\$8\$1\$/);
  assert.ok(!hash.includes(SENHA));
  assert.equal((await verificarSenha(SENHA, hash)).ok, true);
  assert.equal((await verificarSenha(SENHA + 'x', hash)).ok, false);
  assert.equal((await verificarSenha(SENHA, 'lixo')).ok, false);
  assert.notEqual(hash, await hashSenha(SENHA), 'cada hash usa um sal diferente');
});

test('hash de senha: detecta parâmetros antigos (precisaRehash)', async () => {
  const hash = await hashSenha(SENHA);
  config.auth.scrypt.N = 2048;
  try {
    assert.deepEqual(await verificarSenha(SENHA, hash), { ok: true, precisaRehash: true });
  } finally {
    config.auth.scrypt.N = 1024;
  }
});

test('política de senha', () => {
  assert.deepEqual(validarSenha(SENHA, { email: 'ana@x.com' }), []);
  assert.ok(validarSenha('curta').length > 0);
  assert.ok(validarSenha('password1234').some((e) => e.includes('comum')));
  assert.ok(validarSenha('aaaaaaaaaaaaaaaa').some((e) => e.includes('variedade')));
  assert.ok(validarSenha('meu-fulano-secreto', { email: 'fulano@x.com' }).some((e) => e.includes('e-mail')));
  assert.ok(validarSenha('x'.repeat(200)).some((e) => e.includes('no máximo')));
  assert.ok(validarSenha(12345).length > 0);
});

test('registrar cria conta não verificada e manda e-mail de confirmação', async () => {
  const antes = emails.length;
  await cadastrar('novo@x.com');
  assert.equal(emails.length, antes + 1);
  assert.equal(emails.at(-1).para, 'novo@x.com');
  const { usuario } = await entrar('novo@x.com');
  assert.equal(usuario.emailVerificado, false);
  assert.equal(usuario.papel, 'usuario');
  assert.equal(usuario.senha_hash, undefined, 'o hash nunca aparece no usuário público');
});

test('registrar com e-mail já existente não revela nada e não altera a conta', async () => {
  await cadastrar('dup@x.com');
  const resultado = await auth.registrar({ nome: 'Outro', email: 'DUP@x.com', senha: 'outra senha bem longa 123' });
  assert.equal(resultado, undefined); // mesma resposta que um cadastro novo
  assert.match(emails.at(-1).texto, /já está cadastrado/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE lower(email) = 'dup@x.com'").get().n, 1);
  await entrar('dup@x.com'); // a senha original continua valendo
  await rejeita(entrar('dup@x.com', 'outra senha bem longa 123'), 401);
});

test('registrar valida os dados', async () => {
  await assert.rejects(auth.registrar({ nome: '', email: 'x', senha: 'curta' }), (e) => e.status === 400 && e.detalhes.erros.length >= 3);
});

test('login: mesma mensagem para e-mail inexistente e senha errada', async () => {
  await cadastrar('msg@x.com');
  const a = await entrar('msg@x.com', 'senha errada mesmo').catch((e) => e);
  const b = await entrar('naoexiste@x.com', 'senha errada mesmo').catch((e) => e);
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.message, b.message);
});

test('login: o token da sessão não é guardado, só o hash', async () => {
  await cadastrar('hash@x.com');
  const { token } = await entrar('hash@x.com');
  const linhas = db.prepare('SELECT token_hash FROM sessoes').all().map((l) => l.token_hash);
  assert.ok(!linhas.includes(token));
  assert.ok(linhas.every((h) => /^[0-9a-f]{64}$/.test(h)));
  assert.equal(sessoes.validarSessao(token).usuario.email, 'hash@x.com');
  assert.equal(sessoes.validarSessao(token + 'x'), null);
});

test('login atualiza o hash quando os parâmetros do scrypt mudam', async () => {
  await cadastrar('rehash@x.com');
  config.auth.scrypt.N = 2048;
  try {
    await entrar('rehash@x.com');
  } finally {
    config.auth.scrypt.N = 1024;
  }
  const { senha_hash } = db.prepare("SELECT senha_hash FROM usuarios WHERE email = 'rehash@x.com'").get();
  assert.match(senha_hash, /^scrypt\$2048\$/);
});

test('bloqueio por tentativas: depois de 5 falhas nem a senha certa entra; libera com o tempo', async () => {
  await cadastrar('lock@x.com');
  for (let i = 0; i < 5; i++) await rejeita(entrar('lock@x.com', 'errada errada errada', '10.0.0.2'), 401);
  await rejeita(entrar('lock@x.com', SENHA, '10.0.0.2'), 429);
  db.prepare('UPDATE tentativas_login SET criada_em = ?').run(PASSADO); // "passou o tempo"
  await entrar('lock@x.com', SENHA, '10.0.0.2');
});

test('bloqueio por IP: muitas falhas em e-mails diferentes travam o IP', async () => {
  for (let i = 0; i < config.auth.maxFalhasPorIp; i++) {
    await rejeita(entrar(`alvo${i}@x.com`, 'errada errada errada', '10.0.0.3'), 401);
  }
  await cadastrar('ipok@x.com');
  await rejeita(entrar('ipok@x.com', SENHA, '10.0.0.3'), 429);
  await entrar('ipok@x.com', SENHA, '10.0.0.4'); // outro IP segue normal
});

test('sessão expira por inatividade e por duração máxima; logout revoga', async () => {
  await cadastrar('sess@x.com');
  const { id } = db.prepare("SELECT id FROM usuarios WHERE email = 'sess@x.com'").get();
  const sessoesDele = () => db.prepare('SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = ?').get(id).n;

  const a = (await entrar('sess@x.com')).token;
  db.prepare('UPDATE sessoes SET ultimo_uso_em = ? WHERE usuario_id = ?').run(PASSADO, id);
  assert.equal(sessoes.validarSessao(a), null);
  assert.equal(sessoesDele(), 0, 'sessão vencida é apagada');

  const b = (await entrar('sess@x.com')).token;
  db.prepare('UPDATE sessoes SET expira_em = ? WHERE usuario_id = ?').run(PASSADO, id);
  assert.equal(sessoes.validarSessao(b), null);

  const c = (await entrar('sess@x.com')).token;
  assert.ok(sessoes.validarSessao(c));
  auth.logout(c);
  assert.equal(sessoes.validarSessao(c), null);
});

test('limite de sessões simultâneas por usuário', async () => {
  await cadastrar('muitas@x.com');
  for (let i = 0; i < config.auth.maxSessoesPorUsuario + 3; i++) await entrar('muitas@x.com', SENHA, `10.1.0.${i}`);
  const { id } = db.prepare("SELECT id FROM usuarios WHERE email = 'muitas@x.com'").get();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = ?').get(id).n, config.auth.maxSessoesPorUsuario);
});

test('alterar senha: exige a atual, derruba as outras sessões e mantém a atual', async () => {
  await cadastrar('troca@x.com');
  const a = await entrar('troca@x.com');
  const b = await entrar('troca@x.com');
  const NOVA = 'uma senha totalmente nova 987';

  await rejeita(auth.alterarSenha(a.usuario, a.token, { senhaAtual: 'errada errada errada', novaSenha: NOVA }), 401);
  await rejeita(auth.alterarSenha(a.usuario, a.token, { senhaAtual: SENHA, novaSenha: SENHA }), 400);
  await rejeita(auth.alterarSenha(a.usuario, a.token, { senhaAtual: SENHA, novaSenha: 'curta' }), 400);

  await auth.alterarSenha(a.usuario, a.token, { senhaAtual: SENHA, novaSenha: NOVA });
  assert.ok(sessoes.validarSessao(a.token), 'a sessão que trocou a senha continua');
  assert.equal(sessoes.validarSessao(b.token), null, 'as outras caem');
  await rejeita(entrar('troca@x.com', SENHA), 401);
  await entrar('troca@x.com', NOVA);
  assert.match(emails.at(-1).assunto, /alterada/);
});

test('redefinição de senha: fluxo completo, token de uso único, derruba sessões', async () => {
  await cadastrar('reset@x.com');
  const sessao = await entrar('reset@x.com');
  const NOVA = 'redefinida com sucesso 456';

  await auth.solicitarRedefinicao({ email: 'reset@x.com' }, { ip: '10.2.0.1' });
  const token = tokenDoUltimoEmail();

  await assert.rejects(auth.redefinirSenha({ token, novaSenha: 'curta' }), (e) => e.status === 400);
  await auth.redefinirSenha({ token, novaSenha: NOVA }); // o token não foi gasto pela tentativa fraca

  assert.equal(sessoes.validarSessao(sessao.token), null);
  await rejeita(entrar('reset@x.com', SENHA), 401);
  const { usuario } = await entrar('reset@x.com', NOVA);
  assert.equal(usuario.emailVerificado, true);
  await rejeita(auth.redefinirSenha({ token, novaSenha: NOVA + 'x' }), 400); // uso único
});

test('redefinição: e-mail inexistente não gera e-mail nem erro; token expirado falha; pedidos são limitados', async () => {
  const antes = emails.length;
  await auth.solicitarRedefinicao({ email: 'fantasma@x.com' }, { ip: '10.2.0.2' });
  assert.equal(emails.length, antes);

  await cadastrar('exp@x.com');
  await auth.solicitarRedefinicao({ email: 'exp@x.com' }, { ip: '10.2.0.3' });
  const token = tokenDoUltimoEmail();
  db.prepare('UPDATE tokens_usuario SET expira_em = ?').run(PASSADO);
  await rejeita(auth.redefinirSenha({ token, novaSenha: 'qualquer senha longa 123' }), 400);

  const antes2 = emails.length;
  for (let i = 0; i < 6; i++) await auth.solicitarRedefinicao({ email: 'exp@x.com' }, { ip: '10.2.0.3' });
  assert.equal(emails.length - antes2, config.auth.maxPedidosResetPorEmail - 1, 'passou do limite: silenciosamente ignorado');
});

test('verificação de e-mail: uso único', async () => {
  await cadastrar('verif@x.com');
  const token = tokenDoUltimoEmail();
  auth.verificarEmail({ token });
  assert.equal((await entrar('verif@x.com')).usuario.emailVerificado, true);
  assert.throws(() => auth.verificarEmail({ token }), (e) => e.status === 400);
  assert.throws(() => auth.verificarEmail({ token: 'inventado' }), (e) => e.status === 400);
  assert.throws(() => auth.verificarEmail({}), (e) => e.status === 400);
});

test('reenviar verificação: só para quem ainda não confirmou', async () => {
  await cadastrar('reenvio@x.com');
  const { usuario } = await entrar('reenvio@x.com');
  const antes = emails.length;
  auth.reenviarVerificacao(usuario);
  assert.equal(emails.length, antes + 1);
  auth.verificarEmail({ token: tokenDoUltimoEmail() });
  auth.reenviarVerificacao({ ...usuario, emailVerificado: true });
  assert.equal(emails.length, antes + 1);
});

test('manutenção apaga o que venceu', async () => {
  await cadastrar('limpa@x.com');
  await entrar('limpa@x.com');
  db.prepare('UPDATE sessoes SET expira_em = ?').run(PASSADO);
  db.prepare('UPDATE tokens_usuario SET expira_em = ?').run(PASSADO);
  db.prepare('UPDATE tentativas_login SET criada_em = ?').run(PASSADO);
  const r = limparExpirados();
  assert.ok(r.sessoes > 0 && r.tokens > 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 0);
});

test('apagar o usuário apaga sessões e tokens (ON DELETE CASCADE)', async () => {
  await cadastrar('cascata@x.com');
  await entrar('cascata@x.com');
  const { id } = db.prepare("SELECT id FROM usuarios WHERE email = 'cascata@x.com'").get();
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = ?').get(id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tokens_usuario WHERE usuario_id = ?').get(id).n, 0);
});
