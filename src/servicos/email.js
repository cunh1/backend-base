import { config } from '../config.js';

// Em desenvolvimento os e-mails aparecem no console (é lá que você pega o link/token).
// Para enviar de verdade, troque o transporte por nodemailer, Resend, SES etc.
async function transporteConsole({ para, assunto, texto }) {
  if (config.producao) {
    // Não imprimimos o corpo em produção: ele contém tokens.
    console.error(`[email] Nenhum provedor configurado. Não enviado: "${assunto}" para ${para}`);
    return;
  }
  console.log(`\n────── E-MAIL (simulado) ──────\nPara: ${para}\nAssunto: ${assunto}\n\n${texto}\n───────────────────────────────\n`);
}

let transporte = transporteConsole;

/** Permite plugar um provedor real (ou capturar e-mails nos testes). */
export function definirTransporte(fn) {
  transporte = fn;
}

export async function enviarEmail(mensagem) {
  return transporte(mensagem);
}
