import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAutenticacao } from '../contexto/AutenticacaoContexto.jsx';

/** Só deixa passar quem está logado; guarda a rota de origem para voltar depois do login. */
export default function RotaProtegida() {
  const { usuario, carregando } = useAutenticacao();
  const local = useLocation();

  if (carregando) return <div className="carregando-pagina">Carregando…</div>;
  if (!usuario) return <Navigate to="/entrar" state={{ de: local }} replace />;
  return <Outlet />;
}
