import { neon } from '@netlify/neon';
const sql = neon();

export const handler = async () => {
  try {
    // Cria usuário genérico
    await sql`
      INSERT INTO users (username, role)
      VALUES ('import_zonasul', 'merchant')
      ON CONFLICT (username) DO NOTHING
    `;

    // Insere lojas do array
    await sql`
      INSERT INTO lojas (user_id, nome, endereco, telefone, website, latitude, longitude, bairro, categoria)
      SELECT
        (SELECT id FROM users WHERE username='import_zonasul'),
        v.nome, v.endereco, v.telefone, v.website, v.latitude, v.longitude, v.bairro, v.categoria
      FROM (VALUES
        ('Amoedo Ipanema', 'Rua Farme de Amoedo 107, Rio de Janeiro', '(21) 2287-7000', NULL, -22.98492, -43.20378, 'Ipanema', 'Loja de materiais de construção'),
        ('Abc da Construção', 'Rua Farme de Amoedo 122, Rio de Janeiro', '(21) 99296-5055', NULL, -22.98522, -43.20456, 'Ipanema', 'Loja de materiais de construção'),
        ('707 Materiais de Construção', 'Rua Barata Ribeiro 707, lj. G, Rio de Janeiro', '(21) 2235-3379', NULL, -22.9734, -43.19349, 'Copacabana', 'Loja de materiais de construção'),
        ('SIB Materiais', 'Rua Visconde de Pirajá 207, lj. 314, Rio de Janeiro', '(21) 2522-1440', NULL, -22.98363, -43.19898, 'Ipanema', 'Loja de materiais de construção'),
        ('Casa Mourão Materiais de Construção e Ferragens', 'Rua Vinícius de Moraes 71, lj. A, Rio de Janeiro, RJ, 22411-010', '(21) 98876-8872', 'wa.me', -22.98305, -43.2052, 'Ipanema', 'Loja de ferragens'),
        ('Rede Citylar Material de Construção - Gávea', 'Rua Marquês de São Vicente 9, lj. A, Rio de Janeiro, RJ, 22451-041', '(21) 2274-2446', 'loja.rezendeconstrucao.com.br', -22.9741, -43.22818, 'Gávea', 'Loja de materiais de construção'),
        ('Befran Materiais de Construção', 'Rua Gen. Polidoro 177, lj. A e B, Rio de Janeiro, RJ, 22280-002', '(21) 98870-1000', 'www.lojabefran.com.br', -22.95663, -43.1856, 'Botafogo', 'Loja de materiais de construção'),
        ('Rede Citylar Material de Construção - Copacabana', 'Rua Barata Ribeiro 425, Rio de Janeiro, RJ, 22040-001', '(21) 2255-3083', 'www.redecitylar.com.br', -22.9686, -43.18732, 'Copacabana', 'Loja de materiais de construção')
      ) AS v(nome, endereco, telefone, website, latitude, longitude, bairro, categoria)
      ON CONFLICT DO NOTHING
    `;

    return { statusCode: 200, body: JSON.stringify({ message: 'Lojas importadas com sucesso!' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};