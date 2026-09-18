-- Exemplo de ajuste feito "depois": nova coluna sem mexer na migração 001.
ALTER TABLE usuarios ADD COLUMN telefone TEXT;
