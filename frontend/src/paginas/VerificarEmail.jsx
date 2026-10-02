import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { chamarApi } from '../api.js';
import * as estilo from '../componentes/estilos.js';

export default function VerificarEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [estado, setEstado] = useState('verificando'); // verificando | ok | erro

  useEffect(() => {
    if (!token) return setEstado('erro');
    chamarApi('/auth/verificar-email', { metodo: 'POST', corpo: { token } })
      .then(() => setEstado('ok'))
      .catch(() => setEstado('erro'));
  }, [token]);

  return (
    <div style={estilo.caixa}>
      <h1 style={{ fontSize: 19, textAlign: 'center', margin: 0 }}>Confirmação de e-mail</h1>
      {estado === 'verificando' && <p style={{ textAlign: 'center' }}>Confirmando…</p>}
      {estado === 'ok' && <div style={{ ...estilo.sucesso, marginTop: 20 }}>E-mail confirmado com sucesso.</div>}
      {estado === 'erro' && <div style={estilo.aviso}>Link inválido ou expirado.</div>}
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Link style={estilo.linkSutil} to="/">Ir para o sistema</Link>
      </div>
    </div>
  );
}
