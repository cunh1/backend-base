import { useState } from 'react';
import { Link } from 'react-router-dom';
import { chamarApi } from '../api.js';
import * as estilo from '../componentes/estilos.js';

export default function CriarConta() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErros([]);
    setEnviando(true);
    try {
      await chamarApi('/auth/registrar', { metodo: 'POST', corpo: { nome, email, senha } });
      setEnviado(true);
    } catch (e) {
      setErros(e.detalhes?.erros || [e.message]);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div style={estilo.caixa}>
        <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Confira seu e-mail</h1>
        <div style={{ ...estilo.sucesso, marginTop: 20 }}>
          Se o e-mail puder ser cadastrado, enviamos um link de confirmação para ele.
        </div>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link style={estilo.linkSutil} to="/entrar">Voltar para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={estilo.caixa}>
      <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Criar conta</h1>
      <form onSubmit={aoEnviar}>
        <label style={estilo.rotulo}>Nome</label>
        <input style={estilo.campo} required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        <label style={estilo.rotulo}>E-mail</label>
        <input style={estilo.campo} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label style={estilo.rotulo}>Senha (mínimo 12 caracteres)</label>
        <input style={estilo.campo} type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        <button style={estilo.botao} type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Criar conta'}</button>
        {erros.length > 0 && <div style={estilo.aviso}>{erros.join('; ')}</div>}
      </form>
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Link style={estilo.linkSutil} to="/entrar">Já tenho conta</Link>
      </div>
    </div>
  );
}
