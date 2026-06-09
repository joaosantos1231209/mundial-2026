# ⚽ Mundial FIFA 2026 — App Local

App completa para acompanhar e gerir o Mundial de Futebol FIFA 2026.

## Arranque Rápido

**Duplo-clique em `start.bat`** — abre o backend e o frontend automaticamente.

Ou manualmente em dois terminais:

```bash
# Terminal 1 — Backend (porta 3002)
cd backend
npx tsx src/index.ts

# Terminal 2 — Frontend (porta 5173)
cd frontend
npx vite
```

Acede em: http://localhost:5173

## Tecnologias

- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + React Router v6
- Backend: Node.js + Express + TypeScript
- ORM: Drizzle ORM
- Base de dados: SQLite (ficheiro `backend/mundial.db`)

## Funcionalidades

- Dashboard com jogos do dia, resultados e estatísticas
- 12 grupos com tabelas de classificação automáticas (pontos, DG, GF)
- Bracket visual das fases eliminatórias
- Calendário completo com filtros por grupo, fase e estado
- Inserir resultados, eventos (golos, cartões, assistências) e MOTM
- Perfil de cada seleção com plantel e formação tática visual
- Chuteira de Ouro, Luva de Ouro, melhores assistentes

## Resetar Base de Dados

```bash
cd backend
del mundial.db
npx tsx src/db/createTables.ts
npx tsx src/db/seed.ts
```
