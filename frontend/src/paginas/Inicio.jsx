import { useAutenticacao } from '../contexto/AutenticacaoContexto.jsx';
import { urlAdmin } from '../api.js';
import Cabecalho from '../componentes/Cabecalho.jsx';

const selo = {
  admin: { background: '#eef1fd', color: '#23459f' },
  usuario: { background: '#f1f2f4', color: '#6b7280' },
};

/**
 * Home do app (área logada). É a base para o desenvolvimento do sistema: o cabeçalho e o
 * aviso de e-mail já ficam prontos aqui; as telas reais (o que o sistema vai gerenciar no
 * dia a dia) entram no lugar do cartão tracejado, conforme o domínio for definido.
 */
export default function Inicio() {
  const { usuario } = useAutenticacao();

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7f9', fontFamily: 'system-ui, sans-serif' }}>
      <Cabecalho />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Olá, {usuario.nome.split(' ')[0]}</h1>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999, ...selo[usuario.papel] }}>
            {usuario.papel === 'admin' ? 'Administrador' : 'Usuário'}
          </span>
        </div>

        {!usuario.emailVerificado && (
          <div
            style={{
              background: '#fff4e5',
              color: '#9a6700',
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            Confirme seu e-mail para ter acesso completo ao sistema.
          </div>
        )}

        {usuario.papel === 'admin' && (
          <a
            href={urlAdmin()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              background: '#fff',
              border: '1px solid #e2e5ea',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 20,
              textDecoration: 'none',
              color: '#1c1f26',
            }}
          >
            <strong style={{ fontSize: 14 }}>Painel de administração ↗</strong>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Gerencie usuários, crie contas e defina quem é administrador.
            </div>
          </a>
        )}

        <div
          style={{
            border: '1px dashed #d0d4db',
            borderRadius: 10,
            padding: 40,
            color: '#6b7280',
            textAlign: 'center',
            background: '#fff',
          }}
        >
          As telas do sistema entram aqui.
        </div>
      </main>
    </div>
  );
}
