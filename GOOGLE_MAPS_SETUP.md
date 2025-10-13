# Como Configurar Google Maps Geocoding API

## 📋 Resumo

- **Custo**: $5 por 1.000 requisições
- **Crédito grátis**: $200/mês = **40.000 requisições grátis por mês**
- **Precisão**: Extremamente alta (especialmente para endereços brasileiros)

## 🚀 Passo a Passo

### 1. Criar Conta no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google
3. Se for primeira vez, aceite os termos de serviço

### 2. Criar um Projeto

1. No topo da página, clique em **"Select a project"** → **"New Project"**
2. Nome do projeto: `encarregado-geocoding` (ou qualquer nome)
3. Clique em **"Create"**

### 3. Ativar a Geocoding API

1. No menu lateral, vá em: **APIs & Services** → **Library**
2. Procure por: **"Geocoding API"**
3. Clique em **"Geocoding API"**
4. Clique em **"ENABLE"**

### 4. Criar uma API Key

1. No menu lateral: **APIs & Services** → **Credentials**
2. Clique em **"+ CREATE CREDENTIALS"** → **"API key"**
3. Uma chave será gerada (algo como: `AIzaSyDx...`)
4. **COPIE A CHAVE** - você vai precisar dela

### 5. Restringir a API Key (IMPORTANTE para segurança)

1. Na tela de credenciais, clique no ícone de **editar** (lápis) ao lado da sua chave
2. Em **"API restrictions"**:
   - Selecione **"Restrict key"**
   - Marque apenas: **"Geocoding API"**
3. Em **"Application restrictions"** (opcional mas recomendado):
   - Selecione **"HTTP referrers (web sites)"**
   - Adicione: `*.netlify.app/*` (para permitir apenas do Netlify)
4. Clique em **"SAVE"**

### 6. Configurar Billing (Obrigatório mesmo com crédito grátis)

1. No menu lateral: **Billing**
2. Clique em **"Link a billing account"**
3. Adicione um cartão de crédito
   - **NÃO SE PREOCUPE**: Você recebe $200 grátis por mês
   - Google só cobra SE você ultrapassar os $200
   - 40.000 requisições grátis por mês é MUITO (mais de 1.300 por dia)

### 7. Adicionar a Chave ao Projeto

**Local (para desenvolvimento):**

Edite o arquivo `.env`:
```env
GOOGLE_MAPS_API_KEY=AIzaSyDx...sua_chave_aqui
```

**Netlify (para produção):**

1. Acesse: https://app.netlify.com/
2. Selecione seu site
3. Vá em: **Site settings** → **Environment variables**
4. Clique em **"Add a variable"**:
   - Key: `GOOGLE_MAPS_API_KEY`
   - Value: `AIzaSyDx...sua_chave_aqui`
5. Clique em **"Create variable"**

## ✅ Testar

Depois de configurar, teste localmente:

```bash
netlify dev
```

Abra `http://localhost:8888` e tente registrar uma loja nova.

Você deve ver no console:
```
[Geocoding - Google] Requesting coordinates for: "Rua X, 123..."
[Geocoding - Google] ✓ Found: -22.98492, -43.20378
[Geocoding - Google] Location type: ROOFTOP
```

## 📊 Monitorar Uso

Para ver quantas requisições você está fazendo:

1. Google Cloud Console
2. Menu: **APIs & Services** → **Dashboard**
3. Clique em **"Geocoding API"**
4. Veja o gráfico de uso

## 💰 Custos Estimados

Com o uso esperado do seu projeto:

| Cenário | Requisições/mês | Custo |
|---------|----------------|-------|
| Poucos registros | 100-500 | **GRÁTIS** ($0) |
| Crescimento inicial | 1.000-5.000 | **GRÁTIS** ($0) |
| Uso moderado | 10.000 | **GRÁTIS** ($0) |
| Uso alto | 40.000 | **GRÁTIS** ($0) |
| Acima de 40k | 50.000 | $50 ($200 grátis - $150 uso extra) |

**Nota**: Cada registro de loja = 1 requisição. Então 40.000 grátis = 40.000 lojas por mês.

## 🔄 Voltar para OpenCage (se necessário)

Se quiser voltar para OpenCage (grátis, mas menos preciso):

Em `netlify/functions/auth-register.js`, linha 22:

```javascript
// GOOGLE MAPS (atual):
import { geocodeAddress, validateCoordinates } from './utils/geocoding_google.js';

// OPENCAGE (alternativa grátis):
import { geocodeAddress, validateCoordinates } from './utils/geocoding_corrected.js';
```

Mude apenas essa linha e faça commit/push.

## ⚠️ Segurança

**NUNCA** faça commit do arquivo `.env` com a chave!

O arquivo `.gitignore` já está configurado para ignorar `.env`, mas verifique:

```bash
cat .gitignore | grep .env
```

Deve mostrar: `.env`

## 🆘 Problemas Comuns

### "API key not configured"
- Verifique se adicionou `GOOGLE_MAPS_API_KEY` no `.env`
- Se no Netlify, verifique as Environment Variables

### "REQUEST_DENIED"
- Verifique se ativou a "Geocoding API" no Google Cloud Console
- Verifique se configurou o billing

### "OVER_QUERY_LIMIT"
- Você ultrapassou os 40.000 grátis do mês
- Verifique o uso no Dashboard

### Netlify não está usando a chave
- Após adicionar Environment Variables, você precisa fazer um **redeploy**
- Vá em: Deploys → Trigger deploy → Deploy site

## 📞 Suporte

- Documentação oficial: https://developers.google.com/maps/documentation/geocoding
- Preços: https://developers.google.com/maps/billing-and-pricing/pricing
- Console: https://console.cloud.google.com/

---

**Pronto!** 🎉 Com isso configurado, você terá geocoding de altíssima precisão para endereços brasileiros.
