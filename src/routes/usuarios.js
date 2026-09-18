import { Router } from 'express';
import * as usuarios from '../repositories/usuarios.js';

const router = Router();

function validar(corpo) {
  const erros = [];
  if (typeof corpo?.nome !== 'string' || !corpo.nome.trim()) erros.push('nome é obrigatório');
  if (typeof corpo?.email !== 'string' || !corpo.email.includes('@')) erros.push('email inválido');
  return erros;
}

function limpar(corpo) {
  return {
    nome: corpo.nome.trim(),
    email: corpo.email.trim().toLowerCase(),
    telefone: typeof corpo.telefone === 'string' && corpo.telefone.trim() ? corpo.telefone.trim() : null,
  };
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

router.post('/', (req, res) => {
  const erros = validar(req.body);
  if (erros.length) return res.status(400).json({ erros });
  res.status(201).json(usuarios.criar(limpar(req.body)));
});

router.put('/:id', (req, res) => {
  const erros = validar(req.body);
  if (erros.length) return res.status(400).json({ erros });
  const usuario = idDe(req) !== null && usuarios.atualizar(idDe(req), limpar(req.body));
  if (!usuario) return naoEncontrado(res);
  res.json(usuario);
});

router.delete('/:id', (req, res) => {
  if (idDe(req) === null || !usuarios.remover(idDe(req))) return naoEncontrado(res);
  res.status(204).end();
});

export default router;
