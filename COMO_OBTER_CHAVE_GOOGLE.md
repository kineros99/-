# ⚠️ SUA CHAVE DO GOOGLE MAPS NÃO ESTÁ FUNCIONANDO

A chave que você forneceu (`AIzaSyAIExbRRpWa-df8WRFJRbRxbesmwIDBQKE`) retornou erro:
**"The provided API key is invalid."**

## 🔧 Como Resolver

### Opção 1: Ativar a chave que você já tem

Se você já criou essa chave no Google Cloud Console:

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Encontre sua API key: `AIzaSyAIExbRRpWa-df8WRFJRbRxbesmwIDBQKE`
3. Verifique se:
   - ✅ A chave está **ativada** (não desabilitada)
   - ✅ A **Geocoding API** está habilitada no projeto
   - ✅ O **billing (faturamento)** está configurado

### Opção 2: Criar uma NOVA chave

#### Passo 1: Acessar o Console
https://console.cloud.google.com/

#### Passo 2: Criar ou selecionar um projeto
- Clique no dropdown de projetos no topo
- Clique em "New Project" (Novo Projeto)
- Nome: `encarregado` (ou qualquer nome)
- Clique em "Create"

#### Passo 3: Ativar a Geocoding API
1. No menu lateral: **APIs & Services** → **Library**
2. Procure: **"Geocoding API"**
3. Clique em "ENABLE" (Ativar)

#### Passo 4: Configurar Billing (OBRIGATÓRIO)
1. No menu lateral: **Billing**
2. "Link a billing account" (Vincular conta de faturamento)
3. Adicione um cartão de crédito

**NÃO SE PREOCUPE:** Você ganha $200 grátis por mês = 40.000 requisições grátis

#### Passo 5: Criar API Key
1. No menu lateral: **APIs & Services** → **Credentials**
2. Clique em "**+ CREATE CREDENTIALS**"
3. Selecione "**API key**"
4. Uma nova chave será gerada: `AIzaSy...`
5. **COPIE A CHAVE**

#### Passo 6: Restringir a chave (SEGURANÇA)
1. Clique no ícone de lápis ao lado da chave
2. Em "API restrictions":
   - Selecione "**Restrict key**"
   - Marque apenas: **Geocoding API**
3. Salve

#### Passo 7: Adicionar no projeto

**No arquivo `.env`:**
```env
GOOGLE_MAPS_API_KEY=sua_nova_chave_aqui
```

**No Netlify (IMPORTANTE!):**
1. https://app.netlify.com/ → Seu site
2. **Site settings** → **Environment variables**
3. Edite a variável `GOOGLE_MAPS_API_KEY`
4. Cole a nova chave
5. Salve
6. Vá em **Deploys** → **Trigger deploy** → **Deploy site**

## ✅ Testar a Nova Chave

Depois de atualizar o `.env`:

```bash
node tools/scripts/test_google_api_key.js
```

Você deve ver:
```
✅ API KEY IS WORKING!
```

## 🆘 Se Você Tem a Outra Chave

Você mencionou que tem 2 chaves. Se você souber qual é a outra, teste ela:

1. Abra o `.env`
2. Substitua a chave atual pela outra
3. Rode: `node tools/scripts/test_google_api_key.js`

## 📞 Precisa de Ajuda?

Se continuar com problemas:
1. Me mostre a mensagem de erro completa
2. Verifique no Google Cloud Console se você tem billing configurado
3. Verifique se a Geocoding API está realmente ativada

---

## 🎯 Status Atual do Projeto

✅ Google Maps Geocoding API **IMPLEMENTADO**
✅ Todo código do OpenCage **REMOVIDO**
✅ Mapa usando tiles do Google Maps
❌ Precisa de chave válida para funcionar

Assim que você tiver uma chave válida, o sistema estará **100% funcional**.
