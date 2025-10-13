import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL); // uses NETLIFY_DATABASE_URL automatically

export const handler = async (event) => {
  try {
    const bairro = event.queryStringParameters?.bairro;
    const source = event.queryStringParameters?.source; // 'user', 'auto', or 'all'

    let lojas;

    // Build query based on filters
    if (bairro && source && source !== 'all') {
      // Filter by both neighborhood and source
      lojas = await sql`
        SELECT id, nome, endereco, telefone, website, latitude, longitude, bairro, categoria, source, user_verified
        FROM lojas
        WHERE bairro ILIKE ${bairro}
        AND source = ${source}
        ORDER BY nome
      `;
    } else if (bairro) {
      // Filter by neighborhood only
      lojas = await sql`
        SELECT id, nome, endereco, telefone, website, latitude, longitude, bairro, categoria, source, user_verified
        FROM lojas
        WHERE bairro ILIKE ${bairro}
        ORDER BY nome
      `;
    } else if (source && source !== 'all') {
      // Filter by source only
      lojas = await sql`
        SELECT id, nome, endereco, telefone, website, latitude, longitude, bairro, categoria, source, user_verified
        FROM lojas
        WHERE source = ${source}
        ORDER BY nome
      `;
    } else {
      // Return all stores
      lojas = await sql`
        SELECT id, nome, endereco, telefone, website, latitude, longitude, bairro, categoria, source, user_verified
        FROM lojas
        ORDER BY nome
      `;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(lojas),
    };
  } catch (err) {
    console.error('Error fetching stores:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to fetch stores',
        message: err.message
      }),
    };
  }
};
