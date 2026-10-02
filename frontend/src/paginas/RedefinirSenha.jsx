import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { chamarApi } from '../api.js';
import * as estilo from '../componentes/estilos.js';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [novaSenha, setNovaSenha] = useState('');
  const [erros, setErros] = useState([]);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErros([]);
    setEnviando(true);
    try {
      await chamarApi('/auth/redefinir-senha', { metodo: 'POST', corpo: { token, novaSenha } });
      setOk(true);
    } catch (e) {
      setErros(e.detalhes?.erros || [e.message]);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div style={estilo.caixa}>
        <div style={estilo.aviso}>Link inválido. Peça um novo em "Esqueci minha senha".</div>
      </div>
    );
  }

  if (ok) {
    return (
      <div style={estilo.caixa}>
        <div style={estilo.sucesso}>Senha redefinida. Você já pode entrar com a nova senha.</div>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link style={estilo.linkSutil} to="/entrar">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={estilo.caixa}>
      <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Nova senha</h1>
      <form onSubmit={aoEnviar}>
        <label style={estilo.rotulo}>Nova senha (mínimo 12 caracteres)</label>
        <input style={estilo.campo} type="password" required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
        <button style={estilo.botao} type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Redefinir senha'}</button>
        {erros.length > 0 && <div style={estilo.aviso}>{erros.join('; ')}</div>}
      </form>
    </div>
  );
}
