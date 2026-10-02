import { useState } from 'react';
import { Link } from 'react-router-dom';
import { chamarApi } from '../api.js';
import * as estilo from '../componentes/estilos.js';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    await chamarApi('/auth/esqueci-senha', { metodo: 'POST', corpo: { email } }).catch(() => {});
    setEnviado(true);
    setEnviando(false);
  }

  return (
    <div style={estilo.caixa}>
      <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Esqueci minha senha</h1>
      {enviado ? (
        <div style={{ ...estilo.sucesso, marginTop: 20 }}>Se o e-mail estiver cadastrado, enviamos as instruções para ele.</div>
      ) : (
        <form onSubmit={aoEnviar}>
          <label style={estilo.rotulo}>E-mail</label>
          <input style={estilo.campo} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <button style={estilo.botao} type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Link style={estilo.linkSutil} to="/entrar">Voltar para o login</Link>
      </div>
    </div>
  );
}
