import { NavLink } from 'react-router-dom';
import { useAutenticacao } from '../contexto/AutenticacaoContexto.jsx';
import { urlAdmin } from '../api.js';

const estiloLink = {
  fontSize: 13,
  color: '#6b7280',
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: 7,
};

const linkAtivo = ({ isActive }) => ({
  ...estiloLink,
  ...(isActive ? { color: '#1c1f26', background: '#eef0f3' } : null),
});

/**
 * Cabeçalho comum a toda a área logada do sistema. A aba "Administração" só aparece
 * para quem tem papel === 'admin', e abre a tela de admin (public/admin.html, servida
 * pelo próprio backend) em outra guia, já que é uma página separada, fora do React.
 */
export default function Cabecalho() {
  const { usuario, sair } = useAutenticacao();

  return (
    <header style={{ borderBottom: '1px solid #e2e5ea', background: '#fff' }}>
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontSize: 15, marginRight: 10 }}>Meu Sistema</strong>
          <NavLink to="/" end style={linkAtivo}>
            Início
          </NavLink>
          {usuario?.papel === 'admin' && (
            <a href={urlAdmin()} target="_blank" rel="noopener noreferrer" style={estiloLink} title="Abre em outra guia">
              Administração ↗
            </a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {usuario?.nome} · {usuario?.email}
          </span>
          <button
            onClick={sair}
            style={{ padding: '7px 12px', border: '1px solid #e2e5ea', borderRadius: 7, background: '#eef0f3', cursor: 'pointer', fontSize: 13 }}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
