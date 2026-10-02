// Tudo aqui fala com a mesma API do backend (auth + usuarios). Usa cookie de sessão
// (credentials: 'include'), então o backend precisa ter a origem do Vite (5173) na
// lista ORIGENS_PERMITIDAS — já vem assim por padrão em src/config.js.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// A tela de administrador (public/admin.html) é servida pelo backend, não pelo Vite.
// Mesma origem do cookie de sessão, então quem já está logado entra direto, sem logar de novo.
export const urlAdmin = () => `${BASE}/admin`;

export class ErroApi extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export async function chamarApi(caminho, { metodo = 'GET', corpo } = {}) {
  const resposta = await fetch(BASE + caminho, {
    method: metodo,
    credentials: 'include',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json().catch(() => null) : null;

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, dados?.erro || `Erro ${resposta.status}`, dados);
  }
  return dados;
}
