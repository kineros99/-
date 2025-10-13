import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL); // usa NETLIFY_DATABASE_URL automaticamente

export const handler = async () => {
  try {
    // Cria a tabela de usuários
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL
      )
    `;

    // Cria a tabela de lojas
    await sql`
      CREATE TABLE IF NOT EXISTS lojas (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INT REFERENCES users(id),
        nome TEXT NOT NULL,
        endereco TEXT NOT NULL,
        telefone TEXT,
        website TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        bairro TEXT,
        categoria TEXT
      )
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Tabelas criadas com sucesso!' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};