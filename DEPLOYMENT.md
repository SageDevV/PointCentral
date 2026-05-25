# Migracao de Hosting

O PointCentral precisa de um runtime always-on. O scheduler roda dentro do processo Node com `node-cron`, entao plataformas que dormem por inatividade podem deixar de enviar lembretes no horario correto.

## Opcao recomendada: Fly.io

Use Fly.io quando quiser uma experiencia parecida com Railway, com Docker, HTTPS automatico, regiao em Sao Paulo (`gru`) e custo baixo para uma instancia pequena sempre ligada.

O arquivo `fly.toml` deste repo ja configura:

- Dockerfile existente.
- Porta interna `3000`.
- Healthcheck em `/health`.
- `auto_stop_machines = "off"` e `min_machines_running = 1`, para manter o cron vivo.
- Volume em `/data`, usado por `STATE_PATH` e `STORAGE_PATH`.
- VM inicial de `512mb`, suficiente para o backend sem automacao de navegador.

Passos:

```bash
fly launch --copy-config --name pointcentral --region gru --no-deploy
fly volumes create pointcentral_data --region gru --size 1
fly secrets set TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." APP_URL="https://pointcentral.fly.dev"
fly deploy
fly logs
```

Se escolher outro nome para o app, ajuste `app = "..."` no `fly.toml` e use o mesmo dominio em `APP_URL`.

## Opcao sem mensalidade: Oracle Cloud Always Free

Use OCI Always Free se a prioridade for custo zero e voce aceitar administrar uma VM Linux. A opcao ARM Always Free atual permite ate 4 OCPUs e 24 GB de memoria dentro da franquia, mas a criacao da instancia depende de capacidade disponivel na regiao.

Depois de criar uma VM Ubuntu/Oracle Linux e instalar Docker:

```bash
git clone <repo-url> pointcentral
cd pointcentral
cp .env.example .env
docker compose up -d --build
docker compose logs -f pointcentral
```

Para acessar via Telegram com um link confiavel, publique a porta `3000` por HTTPS. As opcoes mais simples sao Caddy com dominio proprio ou Cloudflare Tunnel.

## Outras opcoes

- Render Free e Koyeb Free nao sao ideais para este app, porque instancias gratuitas podem escalar para zero ou suspender por inatividade. Isso quebra os lembretes do `node-cron`.
- Render pago tambem funciona para o backend atual, mas Fly.io continua simples por ja usar Docker e volume.
- DigitalOcean Droplet funciona bem com `docker compose`, mas exige configurar firewall, Docker, HTTPS e atualizacoes da VM.

## Variaveis obrigatorias

Configure estas variaveis no provedor, nunca no repositorio:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
APP_URL=
TIMEZONE=America/Sao_Paulo
STATE_PATH=/data/day-state.json
STORAGE_PATH=/data/storage.json
```

## Limpeza antes do push

Este repo tinha arquivos locais versionados que nao devem ir para a imagem nem para GitHub: `.env`, `combined.log`, `error.log` e `day-state.json`. A `.dockerignore` ja impede que eles entrem no build Docker, mas o ideal e tambem remover do tracking do Git:

```bash
git rm --cached .env combined.log error.log day-state.json
git add .gitignore .dockerignore fly.toml docker-compose.yml DEPLOYMENT.md .env.example README.md
git commit -m "Prepare cloud migration"
```

Se o `.env` com credenciais reais ja foi enviado para um remoto, rotacione `TELEGRAM_BOT_TOKEN` e qualquer outro segredo antes de seguir.
