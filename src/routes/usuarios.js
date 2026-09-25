import { Router } from 'express';
import { ErroHttp } from '../erros.js';
import { hashSenha, validarSenha } from '../auth/senha.js';
import * as credenciais from '../repositories/credenciais.js';
import * as usuarios from '../repositories/usuarios.js';

// Este router é montado atrás de exigirLogin + exigirPapel('admin') (veja app.js).
const router = Router();

const PAPEIS = ['usuario', 'admin'];
const emailValido = (email) => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function validarDados(corpo, { exigirSenha }) {
  const erros = [];
  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : '';
  const email = typeof corpo?.email === 'string' ? corpo.email.trim().toLowerCase() : '';
  const papel = corpo?.papel ?? 'usuario';

  if (!nome || nome.length > 120) erros.push('nome é obrigatório (até 120 caracteres)');
  // Contas criadas pelo admin não precisam ser um e-mail de verdade (ex.: um login de serviço),
  // mas se parecer e-mail, ele precisa ser válido — evita erros de digitação.
  if (!email) erros.push('e-mail é obrigatório');
  else if (email.includes('@') && !emailValido(email)) erros.push('e-mail inválido');
  if (!PAPEIS.includes(papel)) erros.push('papel deve ser "usuario" ou "admin"');
  if (exigirSenha) erros.push(...validarSenha(corpo?.senha, { email }));

  return { erros, dados: { nome, email, papel } };
}

function idDe(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) ? id : null;
}

const naoEncontrado = (res) => res.status(404).json({ erro: 'Usuário não encontrado' });

router.get('/', (req, res) => {
  res.json(usuarios.listar());
});

router.get('/:id', (req, res) => {
  const usuario = idDe(req) !== null && usuarios.buscar(idDe(req));
  if (!usuario) return naoEncontrado(res);
  res.json(usuario);
});

router.post('/', async (req, res) => {
  const { erros, dados } = validarDados(req.body, { exigirSenha: true });
  if (erros.length) return res.status(400).json({ erros });

  const senhaHash = await hashSenha(req.body.senha);
  const { criado, id } = credenciais.criarPeloAdmin({ ...dados, senhaHash });
  if (!criado) return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail' });
  res.status(201).json(usuarios.buscar(id));
});

router.put('/:id', (req, res) => {
  const id = idDe(req);
  const atual = id !== null && usuarios.buscar(id);
  if (!atual) return naoEncontrado(res);

  const { erros, dados } = validarDados(req.body, { exigirSenha: false });
  if (erros.length) return res.status(400).json({ erros });

  if (atual.papel === 'admin' && dados.papel !== 'admin' && usuarios.contarAdmins() <= 1) {
    throw new ErroHttp(400, 'Este é o único administrador. Torne outra pessoa admin antes de rebaixá-lo.');
  }

  const usuario = usuarios.atualizar(id, {
    nome: dados.nome,
    email: dados.email,
    telefone: typeof req.body.telefone === 'string' && req.body.telefone.trim() ? req.body.telefone.trim() : null,
    papel: dados.papel,
  });
  res.json(usuario);
});

router.delete('/:id', (req, res) => {
  const id = idDe(req);
  const atual = id !== null && usuarios.buscar(id);
  if (!atual) return naoEncontrado(res);

  if (atual.papel === 'admin' && usuarios.contarAdmins() <= 1) {
    throw new ErroHttp(400, 'Este é o único administrador e não pode ser removido.');
  }

  usuarios.remover(id);
  res.status(204).end();
});

export default router;
