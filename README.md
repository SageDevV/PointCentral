# PointCentral Backend

Sistema backend automatizado para envio de notificações no **Telegram**, lembrando o usuário de bater o ponto nos horários configurados.

## 🚀 Tecnologias Utilizadas

- **Node.js** com **TypeScript**
- **Axios** (Integração com API)
- **Node-cron** (Agendamento de tarefas)
- **Luxon** (Manipulação de datas e fusos horários)
- **Winston** (Logging profissional)
- **Telegram Bot API** (Notificações estáveis e personalizadas)

## 🛠️ Configuração do Telegram Bot

Para receber as notificações, você precisa criar um bot oficial e obter suas credenciais:

1. Fale com o [@BotFather](https://t.me/botfather) no Telegram e use `/newbot` para criar um bot.
2. Copie o **API Token** gerado.
3. Obtenha seu **Chat ID** numérico (você pode usar o bot [@userinfobot](https://t.me/userinfobot) para isso).
4. Abra uma conversa com seu novo bot e clique em **Começar** (ou envie `/start`).
5. Preencha `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no arquivo `.env`.

## ⚙️ Instalação e Execução Local

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais:
   ```bash
   cp .env.example .env
   ```
4. Execute em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Para compilar e rodar em produção localmente:
   ```bash
   npm run build
   npm start
   ```

## Senior Automation

O botão principal de registro chama o backend em `/api/register`. O backend abre a Senior com Playwright, faz login usando `SENIOR_USERNAME` e `SENIOR_PASSWORD`, localiza o botão `Registrar Ponto` e então atualiza o estado local do PointCentral.

Configure as variáveis no Railway ou no `.env` local:

```bash
SENIOR_USERNAME=
SENIOR_PASSWORD=
SENIOR_POINT_URL=
SENIOR_REGISTER_BUTTON_TEXT=Registrar Ponto
SENIOR_AUTOMATION_TIMEOUT_MS=90000
SENIOR_BROWSER_HEADLESS=true
```

## 🛡️ Persistência de Estado

O sistema mantém o estado do dia em um arquivo JSON (`day-state.json`) para garantir que:
- As notificações não sejam enviadas duplicadas.
- O fluxo de Entrada -> Almoço -> Retorno -> Saída seja respeitado.
- Mesmo após reinicializações, o sistema saiba em qual etapa do dia o usuário está.

## 🌍 Deploy

Recomendamos o uso do **Railway** para o deploy.

### Passo a passo para Deploy:
1. Crie uma conta no [Railway.app](https://railway.app/).
2. Conecte seu repositório GitHub.
3. Vá em **Settings > Variables** e adicione todas as variáveis do arquivo `.env`.
4. O Railway iniciará o build e execução automaticamente via `npm start`.

## 📝 Logs

O sistema gera logs detalhados:
- `combined.log`: Todos os eventos de execução.
- `error.log`: Apenas erros críticos.
- Console: Saída monitorada em tempo real.

---
Desenvolvido para facilitar sua rotina. Não esqueça mais o ponto! 🚀

