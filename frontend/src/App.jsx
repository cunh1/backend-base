import { Routes, Route } from 'react-router-dom';
import { AutenticacaoProvider } from './contexto/AutenticacaoContexto.jsx';
import RotaProtegida from './componentes/RotaProtegida.jsx';
import Entrar from './paginas/Entrar.jsx';
import CriarConta from './paginas/CriarConta.jsx';
import EsqueciSenha from './paginas/EsqueciSenha.jsx';
import RedefinirSenha from './paginas/RedefinirSenha.jsx';
import VerificarEmail from './paginas/VerificarEmail.jsx';
import Inicio from './paginas/Inicio.jsx';

export default function App() {
  return (
    <AutenticacaoProvider>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/verificar-email" element={<VerificarEmail />} />

        <Route element={<RotaProtegida />}>
          <Route path="/" element={<Inicio />} />
        </Route>
      </Routes>
    </AutenticacaoProvider>
  );
}
