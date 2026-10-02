/** Loga cada requisição no formato "hora método caminho status Xms" — útil já em desenvolvimento. */
export function logarRequisicoes(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}
