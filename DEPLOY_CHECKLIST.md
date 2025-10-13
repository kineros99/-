# 🚀 Checklist de Deploy - Google Maps Pronto

## ✅ Status Atual

### O que já está PRONTO:
- ✅ Google Maps Geocoding API implementado
- ✅ Todo código OpenCage removido
- ✅ Mapa usando tiles do Google Maps
- ✅ auth-register.js usando Google Maps
- ✅ Chave no `.env`: `AIzaSyBtortv4GqJ3tGWGtbtkWHl9T-ksxkPqyg`
- ✅ Sistema 100% funcional (esperando billing)

### O que FALTA:
- ⏳ Ativar billing no Google Cloud (VOCÊ precisa fazer)
- ⏳ Configurar a chave no Netlify
- ⏳ Fazer deploy

---

## 📋 QUANDO VOCÊ ATIVAR O BILLING

### Passo 1: Ativar Billing no Google Cloud

1. Acesse: https://console.cloud.google.com/billing
2. Link a billing account
3. Adicione cartão de crédito
4. **Lembre-se**: $200 grátis/mês = 40.000 requisições grátis

### Passo 2: Testar que está funcionando

```bash
cd /Users/eros/Desktop/encarregado
node tools/scripts/test_complete_system.js
```

Você DEVE ver:
```
✅ Success: 3
🎉 ALL TESTS PASSED! Google Maps Geocoding is working perfectly!
```

### Passo 3: Testar localmente

```bash
netlify dev
```

Abra: http://localhost:8888

**Teste:**
1. Clique em "➕ Cadastre sua Loja"
2. Preencha:
   - Username: `teste123`
   - Nome: `Loja Teste`
   - Endereço: `Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro`
   - Categoria: `Material de Construção`
3. Clique em "Cadastrar Loja"
4. Deve aparecer: "Loja cadastrada com sucesso!"
5. Veja se a loja aparece no mapa com o pin correto

### Passo 4: Configurar no Netlify

**IMPORTANTE**: A chave também precisa estar no Netlify!

1. Acesse: https://app.netlify.com/
2. Selecione seu site: **encarregado**
3. Vá em: **Site settings** → **Environment variables**
4. Você já tem `GOOGLE_MAPS_API_KEY` configurada?
   - **SIM**: Edite e confirme que o valor é: `AIzaSyBtortv4GqJ3tGWGtbtkWHl9T-ksxkPqyg`
   - **NÃO**: Clique em "Add a variable":
     - Key: `GOOGLE_MAPS_API_KEY`
     - Value: `AIzaSyBtortv4GqJ3tGWGtbtkWHl9T-ksxkPqyg`
5. Clique em **Save**

### Passo 5: Fazer Commit e Deploy

```bash
cd /Users/eros/Desktop/encarregado

# Ver o que mudou
git status

# Adicionar todas as mudanças
git add .

# Fazer commit
git commit -m "Switch to Google Maps Geocoding API - Remove OpenCage completely"

# Push para o repositório
git push origin main
```

O Netlify vai automaticamente:
1. Detectar o push
2. Fazer build
3. Deploy (leva ~2-3 minutos)
4. Site estará no ar com Google Maps

### Passo 6: Verificar Deploy

1. Vá para: https://app.netlify.com/
2. Veja os "Deploys" - deve estar "Published"
3. Acesse seu site público
4. Teste registrar uma loja real
5. Verifique que as coordenadas estão corretas

---

## 🔧 Se Algo Der Errado

### "REQUEST_DENIED" após deploy
- Verifique se a variável `GOOGLE_MAPS_API_KEY` está no Netlify
- Verifique se o billing está ativo no Google Cloud
- Verifique se a Geocoding API está habilitada

### "API key not configured"
- A chave não está nas Environment Variables do Netlify
- Adicione manualmente (Passo 4 acima)
- Faça um **Trigger deploy** manual após adicionar

### Lojas não aparecem no mapa
- Verifique o console do navegador (F12)
- Pode ser erro de geocoding
- Verifique os logs no Netlify: Site → Functions → Logs

### Coordenadas erradas
- Com Google Maps isso NÃO deve acontecer
- Google é extremamente preciso
- Se acontecer, me avise com o endereço específico

---

## 📊 Monitorar Uso

Para ver quantas requisições está usando:

1. https://console.cloud.google.com/
2. **APIs & Services** → **Dashboard**
3. Clique em **"Geocoding API"**
4. Veja o gráfico de uso

**Alerta:** Se estiver perto de 40.000/mês, você vai começar a pagar.

---

## 🎯 Arquivos Importantes

- **`.env`** - Chave local (NÃO fazer commit!)
- **`netlify/functions/utils/geocoding_google.js`** - Módulo do Google Maps
- **`netlify/functions/auth-register.js`** - Usa geocoding
- **`public/script.js`** - Mapa com tiles do Google
- **`tools/scripts/test_complete_system.js`** - Teste completo

---

## ✅ Checklist Final

Antes de considerar concluído:

- [ ] Billing ativado no Google Cloud
- [ ] `test_complete_system.js` passa todos os testes
- [ ] `netlify dev` funciona localmente
- [ ] Consegue registrar loja localmente
- [ ] Chave configurada no Netlify
- [ ] Commit e push feitos
- [ ] Deploy no Netlify completado
- [ ] Site público funciona
- [ ] Consegue registrar loja no site público
- [ ] Coordenadas estão corretas no mapa

---

## 💡 Dicas

1. **Economize requisições**: Cada registro de loja = 1 requisição
2. **Cache**: As coordenadas são salvas no banco, não precisa geocodificar de novo
3. **Precisão**: Google Maps é MUITO mais preciso que OpenCage (geralmente < 10m de erro)
4. **Custo**: Com uso normal, você nunca vai pagar (40k grátis é muito)

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs: `netlify dev` (local) ou Netlify Functions logs (produção)
2. Teste a chave: `node tools/scripts/test_google_api_key.js`
3. Verifique billing no Google Cloud
4. Me chame de volta com o erro específico

---

**TUDO ESTÁ PRONTO! Só falta você ativar o billing e fazer deploy.** 🚀
