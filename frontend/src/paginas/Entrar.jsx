import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contexto/AutenticacaoContexto.jsx';
import * as estilo from '../componentes/estilos.js';

export default function Entrar() {
  const { entrar } = useAutenticacao();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
      navegar(local.state?.de?.pathname || '/', { replace: true });
    } catch (e) {
      setErro(e.status === 401 ? 'E-mail ou senha inválidos.' : e.status === 429 ? 'Muitas tentativas. Aguarde um pouco.' : e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={estilo.caixa}>
      <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Entrar</h1>
      <form onSubmit={aoEnviar}>
        <label style={estilo.rotulo}>E-mail</label>
        <input style={estilo.campo} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label style={estilo.rotulo}>Senha</label>
        <input style={estilo.campo} type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
        <button style={estilo.botao} type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        {erro && <div style={estilo.aviso}>{erro}</div>}
      </form>
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between' }}>
        <Link style={estilo.linkSutil} to="/esqueci-senha">Esqueci minha senha</Link>
        <Link style={estilo.linkSutil} to="/criar-conta">Criar conta</Link>
      </div>
    </div>
  );
}
