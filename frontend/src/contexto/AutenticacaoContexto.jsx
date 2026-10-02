import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { chamarApi } from '../api.js';

const AutenticacaoContexto = createContext(null);

export function AutenticacaoProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = ainda checando; null = sem sessão

  const recarregar = useCallback(async () => {
    try {
      const { usuario } = await chamarApi('/auth/eu');
      setUsuario(usuario);
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const entrar = useCallback(async (email, senha) => {
    const { usuario } = await chamarApi('/auth/login', { metodo: 'POST', corpo: { email, senha } });
    setUsuario(usuario);
  }, []);

  const sair = useCallback(async () => {
    await chamarApi('/auth/logout', { metodo: 'POST' }).catch(() => {});
    setUsuario(null);
  }, []);

  const valor = { usuario, carregando: usuario === undefined, entrar, sair, recarregar };
  return <AutenticacaoContexto.Provider value={valor}>{children}</AutenticacaoContexto.Provider>;
}

export function useAutenticacao() {
  const contexto = useContext(AutenticacaoContexto);
  if (!contexto) throw new Error('useAutenticacao precisa estar dentro de <AutenticacaoProvider>');
  return contexto;
}
