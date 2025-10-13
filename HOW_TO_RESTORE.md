# 🔄 COMO RESTAURAR O PROJETO PARA ESTADO FUNCIONAL

**📌 Snapshot de Referência: `v1.0-working-state`**
**📅 Data do Snapshot: 2025-10-13**

---

## 🚨 Quando Usar Este Guia

Use este guia se:
- ✅ O site parou de funcionar após mudanças
- ✅ Dropdowns não populam mais
- ✅ Botões não respondem
- ✅ Mapa não aparece
- ✅ Console mostra erros de JavaScript
- ✅ Você quer voltar para um estado garantidamente funcional

---

## 🔍 PASSO 1: Diagnosticar o Problema

### Verificar Estado Atual vs Snapshot

```bash
# Ver quais arquivos foram modificados
git diff v1.0-working-state --name-only

# Ver diferenças detalhadas
git diff v1.0-working-state
```

### Verificar Sintaxe JavaScript

```bash
# Testar script.js
node -c public/script.js

# Se mostrar erro, você tem problema de sintaxe
```

### Comparar Checksums

```bash
# Verificar MD5 do script.js
md5 public/script.js

# Comparar com hash do snapshot (veja WORKING_STATE_SNAPSHOT.md)
# Hash esperado: 73d8dec432e2538b3c257d3fac132df1
```

---

## ⚡ RESTAURAÇÃO RÁPIDA (Se Nada Importante Foi Perdido)

### Opção A: Hard Reset (APAGA mudanças não commitadas!)

```bash
# ⚠️ CUIDADO: Isso apaga todas as mudanças não salvas!
git reset --hard v1.0-working-state

# Forçar push se necessário
git push origin main --force
```

### Opção B: Criar Nova Branch a Partir do Snapshot

```bash
# Mais seguro - cria nova branch
git checkout -b restore-$(date +%Y%m%d) v1.0-working-state

# Ver diferenças com a main
git diff main

# Se estiver bom, substituir main
git checkout main
git reset --hard v1.0-working-state
git push origin main --force
```

---

## 🔧 RESTAURAÇÃO SELETIVA (Manter Mudanças Boas)

### Restaurar Apenas Arquivos Problemáticos

```bash
# Identificar arquivo problemático (ex: script.js)
git diff v1.0-working-state public/script.js

# Restaurar apenas esse arquivo
git checkout v1.0-working-state -- public/script.js

# Testar
netlify dev
```

### Restaurar Múltiplos Arquivos

```bash
# Restaurar todos os arquivos do public/
git checkout v1.0-working-state -- public/

# Ou apenas arquivos específicos
git checkout v1.0-working-state -- public/script.js public/styles.css
```

---

## 🎯 RESTAURAÇÃO PASSO A PASSO (Método Seguro)

### 1. Fazer Backup das Mudanças Atuais

```bash
# Criar branch com estado atual
git checkout -b backup-antes-restauracao
git add .
git commit -m "Backup antes de restaurar snapshot"
git push origin backup-antes-restauracao

# Voltar para main
git checkout main
```

### 2. Comparar com Snapshot

```bash
# Ver o que mudou
git diff v1.0-working-state
```

### 3. Decidir Estratégia

**Se mudanças são pequenas:**
```bash
# Restaurar arquivo por arquivo
git checkout v1.0-working-state -- public/script.js
```

**Se mudanças são grandes:**
```bash
# Restaurar tudo
git reset --hard v1.0-working-state
```

### 4. Testar Localmente

```bash
# Rodar servidor local
netlify dev

# Abrir http://localhost:8888

# Verificar:
# - Mapa carrega?
# - Dropdowns populam?
# - Botões funcionam?
# - Console não tem erros?
```

### 5. Deploy

```bash
git push origin main --force
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

Após restaurar, verifique:

### Frontend
- [ ] Abrir https://encarregado.netlify.app
- [ ] Mapa carrega e mostra marcadores
- [ ] Dropdown "Bairro" tem opções (não só "Todos os bairros")
- [ ] Botão 📍 solicita permissão de localização
- [ ] Botão ☰ abre/fecha menu
- [ ] Label mostra "Tipo de Loja"
- [ ] Console (F12) mostra logs: `[Init]`, `[FetchLojas]`, `[PopulateBairros]`

### Backend
```bash
# Testar API
curl "https://encarregado.netlify.app/.netlify/functions/get-lojas" | head -c 200

# Deve retornar JSON com lojas
```

### Sintaxe
```bash
# Validar JavaScript
node -c public/script.js

# Não deve mostrar erros
```

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### "Permission denied" ao fazer push

```bash
# Certifique-se que está na branch correta
git branch

# Use force push (cuidado!)
git push origin main --force
```

### "Your branch is behind"

```bash
# Puxar mudanças primeiro
git pull origin main

# Ou force push se tem certeza
git push origin main --force
```

### Netlify não está fazendo deploy

1. Verificar em: https://app.netlify.com/projects/encarregado
2. Ver logs de deploy
3. Se build falhou, verificar erros
4. Trigger manual deploy se necessário

### Git mostra conflitos

```bash
# Abortar merge
git merge --abort

# Fazer hard reset
git reset --hard v1.0-working-state
```

---

## 💾 CRIAR NOVO SNAPSHOT (Após Novas Funcionalidades)

Quando adicionar novas funcionalidades e testar que tudo funciona:

```bash
# 1. Commit todas as mudanças
git add .
git commit -m "Nova funcionalidade: [descrever]"

# 2. Criar nova tag
git tag -a v1.1-working-state -m "✅ WORKING STATE: [descrever mudanças] ($(date +%Y-%m-%d))"

# 3. Push tag
git push origin v1.1-working-state

# 4. Atualizar documento de snapshot
# (Editar WORKING_STATE_SNAPSHOT.md com novos checksums e data)

# 5. Gerar novos checksums
find public -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) -exec md5 {} \; | sort
```

---

## 🔑 COMANDOS ESSENCIAIS

```bash
# Ver todas as tags
git tag -l

# Ver diferenças com snapshot
git diff v1.0-working-state

# Restaurar arquivo específico
git checkout v1.0-working-state -- public/script.js

# Restaurar tudo (CUIDADO!)
git reset --hard v1.0-working-state

# Criar branch de backup
git checkout -b backup-$(date +%Y%m%d)

# Testar sintaxe
node -c public/script.js

# Testar localmente
netlify dev

# Ver checksums
md5 public/script.js
```

---

## 📞 PARA O CLAUDE CODE

Se você estiver usando o Claude Code para ajudar a restaurar:

**Diga:** "Compare o estado atual com v1.0-working-state e me diga o que mudou"

**Ou:** "Restaure o arquivo public/script.js do snapshot v1.0-working-state"

**Ou:** "Veja o WORKING_STATE_SNAPSHOT.md e compare os checksums MD5"

---

## ⚠️ IMPORTANTE

1. **Sempre faça backup** antes de restaurar
2. **Teste localmente** antes de fazer push
3. **Documente** o que causou o problema
4. **Crie novos snapshots** quando adicionar funcionalidades importantes
5. **Mantenha este documento atualizado**

---

## 🎯 RESUMO

**Problema rápido?**
```bash
git checkout v1.0-working-state -- public/script.js
```

**Problema sério?**
```bash
git reset --hard v1.0-working-state
git push origin main --force
```

**Com dúvida?**
```bash
git diff v1.0-working-state
```

**Após restaurar, sempre:**
```bash
netlify dev  # Testar local
# Abrir http://localhost:8888
# Validar tudo funciona
git push origin main
```

---

**📸 Este snapshot foi criado em 2025-10-13 quando TUDO estava funcionando perfeitamente.**
**Use-o com confiança para restaurar o projeto! 🚀**
