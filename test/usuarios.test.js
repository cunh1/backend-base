import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Banco temporário e scrypt barato: só nos testes.
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'usuarios-test-'));
process.env.DB_PATH = path.join(pasta, 'teste.sqlite');
process.env.SCRYPT_N = '1024';

const { db } = await import('../src/db/connection.js');
const { migrar } = await import('../src/db/migrate.js');
const { config } = await import('../src/config.js');
const { app } = await import('../src/app.js');
const { hashSenha } = await import('../src/auth/senha.js');

migrar(db, config.pastaMigracoes);

const SENHA_ADMIN = 'senha do admin inicial 123';
db.prepare(
  `INSERT INTO usuarios (nome, email, senha_hash, papel, email_verificado_em, senha_alterada_em)
   VALUES ('Admin Inicial', 'admin@teste.com', ?, 'admin', datetime('now'), datetime('now'))`,
).run(await hashSenha(SENHA_ADMIN));

let servidor;
let base;

before(() => new Promise((resolve) => {
  servidor = app.listen(0, () => {
    base = `http://localhost:${servidor.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => {
  db.close();
  fs.rmSync(pasta, { recursive: true, force: true });
  servidor.close(() => resolve());
}));

// Pequeno cliente que guarda o cookie de sessão entre chamadas, como um navegador faria.
function criarCliente() {
  let cookie;
  return async (caminho, { metodo = 'GET', corpo } = {}) => {
    const resposta = await fetch(base + caminho, {
      method: metodo,
      headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const definido = resposta.headers.get('set-cookie');
    if (definido) cookie = definido.split(';')[0];
    const tipo = resposta.headers.get('content-type') || '';
    const dados = tipo.includes('application/json') ? await resposta.json().catch(() => null) : null;
    return { status: resposta.status, dados };
  };
}

async function logarComoAdmin() {
  const cliente = criarCliente();
  const r = await cliente('/auth/login', { metodo: 'POST', corpo: { email: 'admin@teste.com', senha: SENHA_ADMIN } });
  assert.equal(r.status, 200);
  return cliente;
}

test('sem sessão: 401', async () => {
  const cliente = criarCliente();
  const r = await cliente('/usuarios');
  assert.equal(r.status, 401);
});

test('sessão de quem não é admin: 403', async () => {
  await hashSenha('senha da ana bem longa 123').then((hash) =>
    db
      .prepare(
        `INSERT INTO usuarios (nome, email, senha_hash, papel, email_verificado_em, senha_alterada_em)
         VALUES ('Ana Comum', 'ana.comum@teste.com', ?, 'usuario', datetime('now'), datetime('now'))`,
      )
      .run(hash),
  );
  const cliente = criarCliente();
  await cliente('/auth/login', { metodo: 'POST', corpo: { email: 'ana.comum@teste.com', senha: 'senha da ana bem longa 123' } });
  const r = await cliente('/usuarios');
  assert.equal(r.status, 403);
});

test('admin cria usuário: sucesso, sem senha_hash na resposta', async () => {
  const cliente = await logarComoAdmin();
  const r = await cliente('/usuarios', {
    metodo: 'POST',
    corpo: { nome: 'Beto Criado', email: 'beto@teste.com', senha: 'senha do usuario um bem longa 123' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.dados.email, 'beto@teste.com');
  assert.equal(r.dados.papel, 'usuario');
  assert.equal(r.dados.senha_hash, undefined);
});

test('criar usuário: senha fraca é recusada (400)', async () => {
  const cliente = await logarComoAdmin();
  const r = await cliente('/usuarios', { metodo: 'POST', corpo: { nome: 'X', email: 'x@teste.com', senha: 'curta' } });
  assert.equal(r.status, 400);
  assert.ok(r.dados.erros.length > 0);
});

test('criar usuário: e-mail duplicado é recusado (409)', async () => {
  const cliente = await logarComoAdmin();
  const r = await cliente('/usuarios', {
    metodo: 'POST',
    corpo: { nome: 'Outro Beto', email: 'beto@teste.com', senha: 'outra senha qualquer bem longa 123' },
  });
  assert.equal(r.status, 409);
});

test('criar usuário já como admin funciona', async () => {
  const cliente = await logarComoAdmin();
  const r = await cliente('/usuarios', {
    metodo: 'POST',
    corpo: { nome: 'Carla Admin', email: 'carla@teste.com', senha: 'senha da terceira pessoa bem longa 123', papel: 'admin' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.dados.papel, 'admin');
});

test('paginação: tamanho da página é respeitado e o total bate', async () => {
  const cliente = await logarComoAdmin();
  const r1 = await cliente('/usuarios?pagina=1&tamanho=2');
  assert.equal(r1.status, 200);
  assert.equal(r1.dados.itens.length, 2);
  assert.equal(r1.dados.pagina, 1);
  assert.equal(r1.dados.tamanho, 2);
  assert.ok(r1.dados.total >= 4); // admin inicial + ana + beto + carla, no mínimo

  const r2 = await cliente('/usuarios?pagina=2&tamanho=2');
  assert.notDeepEqual(r1.dados.itens.map((u) => u.id), r2.dados.itens.map((u) => u.id));

  const semParametros = await cliente('/usuarios');
  assert.equal(semParametros.dados.tamanho, 20, 'tamanho padrão é 20');

  const acimaDoLimite = await cliente('/usuarios?tamanho=500');
  assert.equal(acimaDoLimite.dados.tamanho, 100, 'tamanho máximo é 100, mesmo pedindo mais');
});

test('promover a admin: o usuário promovido realmente ganha acesso', async () => {
  const admin = await logarComoAdmin();
  const { id } = db.prepare("SELECT id FROM usuarios WHERE email = 'ana.comum@teste.com'").get();

  const r = await admin(`/usuarios/${id}`, {
    metodo: 'PUT',
    corpo: { nome: 'Ana Comum', email: 'ana.comum@teste.com', papel: 'admin' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.dados.papel, 'admin');

  const ana = criarCliente();
  await ana('/auth/login', { metodo: 'POST', corpo: { email: 'ana.comum@teste.com', senha: 'senha da ana bem longa 123' } });
  const acesso = await ana('/usuarios');
  assert.equal(acesso.status, 200, 'agora ela acessa /usuarios como admin');
});

test('não é possível rebaixar nem remover o último administrador', async () => {
  const admin = await logarComoAdmin();
  // rebaixa todo mundo, exceto o admin inicial, para sobrar só um
  for (const email of ['carla@teste.com', 'ana.comum@teste.com']) {
    const { id } = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    await admin(`/usuarios/${id}`, { metodo: 'PUT', corpo: { nome: 'X', email, papel: 'usuario' } });
  }
  const { id: idAdmin } = db.prepare("SELECT id FROM usuarios WHERE email = 'admin@teste.com'").get();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin'").get().n, 1);

  const rebaixar = await admin(`/usuarios/${idAdmin}`, {
    metodo: 'PUT',
    corpo: { nome: 'Admin Inicial', email: 'admin@teste.com', papel: 'usuario' },
  });
  assert.equal(rebaixar.status, 400);

  const remover = await admin(`/usuarios/${idAdmin}`, { metodo: 'DELETE' });
  assert.equal(remover.status, 400);

  assert.equal(db.prepare('SELECT papel FROM usuarios WHERE id = ?').get(idAdmin).papel, 'admin');
});

test('remover funciona normalmente quando não é o último admin', async () => {
  const admin = await logarComoAdmin();
  const criado = await admin('/usuarios', {
    metodo: 'POST',
    corpo: { nome: 'Descartável', email: 'descartavel@teste.com', senha: 'senha temporaria bem longa 123' },
  });
  const r = await admin(`/usuarios/${criado.dados.id}`, { metodo: 'DELETE' });
  assert.equal(r.status, 204);
  assert.equal(db.prepare('SELECT id FROM usuarios WHERE email = ?').get('descartavel@teste.com'), undefined);
});
