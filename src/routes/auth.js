import { Router } from 'express';
import { config } from '../config.js';
import * as auth from '../auth/servico.js';
import { exigirLogin } from '../middlewares/autenticacao.js';

const router = Router();

const contexto = (req) => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300) });

// httpOnly: JavaScript da página não lê o cookie (protege contra roubo por XSS).
// secure: só trafega em HTTPS (produção). sameSite=lax: não vai em POSTs vindos de outros sites.
const opcoesCookie = { httpOnly: true, secure: config.producao, sameSite: 'lax', path: '/' };

router.post('/registrar', async (req, res) => {
  await auth.registrar(req.body);
  res.status(202).json({ mensagem: 'Se o e-mail puder ser cadastrado, você receberá uma mensagem para confirmá-lo.' });
});

router.post('/login', async (req, res) => {
  const { token, usuario } = await auth.login(req.body, contexto(req));
  if (req.tokenSessao) auth.logout(req.tokenSessao); // não deixa a sessão antiga acumulada
  res.cookie(config.auth.nomeCookie, token, { ...opcoesCookie, maxAge: config.auth.sessaoMaxMs });
  res.json({ usuario });
});

router.post('/logout', (req, res) => {
  if (req.tokenSessao) auth.logout(req.tokenSessao);
  res.clearCookie(config.auth.nomeCookie, opcoesCookie);
  res.status(204).end();
});

router.get('/eu', exigirLogin, (req, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/alterar-senha', exigirLogin, async (req, res) => {
  await auth.alterarSenha(req.usuario, req.tokenSessao, req.body);
  res.json({ mensagem: 'Senha alterada. As outras sessões foram encerradas.' });
});

router.post('/esqueci-senha', async (req, res) => {
  await auth.solicitarRedefinicao(req.body, contexto(req));
  res.status(202).json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
});

router.post('/redefinir-senha', async (req, res) => {
  await auth.redefinirSenha(req.body);
  res.json({ mensagem: 'Senha redefinida. Entre com a nova senha.' });
});

router.post('/verificar-email', (req, res) => {
  auth.verificarEmail(req.body);
  res.json({ mensagem: 'E-mail confirmado.' });
});

router.post('/reenviar-verificacao', exigirLogin, (req, res) => {
  auth.reenviarVerificacao(req.usuario);
  res.status(202).json({ mensagem: 'Se o e-mail ainda não estiver confirmado, enviamos um novo link.' });
});

router.delete('/sessoes', exigirLogin, (req, res) => {
  auth.encerrarTodasAsSessoes(req.usuario.id);
  res.clearCookie(config.auth.nomeCookie, opcoesCookie);
  res.status(204).end();
});

export default router;
