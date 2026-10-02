// Datas no mesmo formato do SQLite (datetime('now')): 'YYYY-MM-DD HH:MM:SS' em UTC.
// Nesse formato, comparar texto equivale a comparar datas.
export const paraSql = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
export const deSql = (texto) => Date.parse(`${texto.replace(' ', 'T')}Z`);
