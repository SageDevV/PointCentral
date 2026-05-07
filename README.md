# PointNotification Backend

Sistema backend automatizado para envio de notificações no WhatsApp, lembrando o usuário de bater o ponto nos horários configurados.

## 🚀 Tecnologias Utilizadas

- **Node.js** com **TypeScript**
- **Axios** (Integração com API)
- **Node-cron** (Agendamento de tarefas)
- **Luxon** (Manipulação de datas e fusos horários)
- **Winston** (Logging profissional)
- **CallMeBot** (API Gratuita e Simples para uso pessoal)

## 🛠️ Configuração do CallMeBot

O CallMeBot é a forma mais rápida de começar para uso pessoal. Siga os passos para obter sua API Key:

1. Adicione o número do CallMeBot aos seus contatos do celular: `+34 621 33 17 00`. (Verifique o número atualizado em [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/)).
2. Envie uma mensagem para esse número via WhatsApp com o texto: `I allow callmebot to send me messages`.
3. Você receberá uma mensagem de volta com a sua **API Key**.
4. Preencha essa chave no arquivo `.env` na variável `CALLMEBOT_API_KEY`.
5. Certifique-se de que o `RECIPIENT_PHONE_NUMBER` seja o seu número com o código do país (ex: `5547992843977`).

> [!TIP]
> O CallMeBot é ideal para lembretes pessoais e não exige configurações complexas de empresa ou aprovação da Meta.

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

## Senior

O botao principal de registro chama o backend em `/api/register`. O backend abre a Senior com Playwright, faz login usando `SENIOR_USERNAME` e `SENIOR_PASSWORD`, localiza o botao `Registrar Ponto` e so entao atualiza o estado local do PointCentral.

Configure as variaveis no Railway ou no `.env` local:

```bash
SENIOR_USERNAME=
SENIOR_PASSWORD=
SENIOR_POINT_URL=
SENIOR_REGISTER_BUTTON_TEXT=Registrar Ponto
SENIOR_AUTOMATION_TIMEOUT_MS=90000
SENIOR_BROWSER_HEADLESS=true
```

Para validar sem bater o ponto, chame:

```bash
curl -X POST http://localhost:3000/api/senior/verify
```

Esse endpoint faz login e confirma que a pagina/botao de marcacao foi localizado, mas nao clica em `Registrar Ponto`.

## 🛡️ Estratégia de Prevenção de Duplicidade

O sistema utiliza um mecanismo de persistência simples e eficaz:
- Um arquivo `storage.json` é mantido no disco.
- Cada notificação enviada é registrada com a chave da data atual (`YYYY-MM-DD`) e o ID do horário (ex: `08:00`).
- Antes de cada disparo, o sistema verifica se aquele ID já existe para a data atual.
- Isso garante que, mesmo que o servidor reinicie ou o agendador execute duas vezes no mesmo minuto, a mensagem seja enviada apenas uma vez.
- O sistema limpa automaticamente registros com mais de 30 dias para manter o arquivo leve.

## 🌍 Deploy

Recomendamos o uso do **Railway** para o deploy deste sistema.

### Por que Railway?
1. **Simplicidade:** Detecta automaticamente o projeto Node.js e faz o build.
2. **Background Workers:** Permite a execução de processos contínuos sem a necessidade de um servidor HTTP aberto.
3. **Persistência:** Você pode anexar um "Volume" (disco) para garantir que o arquivo `storage.json` não seja perdido entre deploys.
4. **Variáveis de Ambiente:** Interface intuitiva para configurar os tokens sensíveis.

### Passo a passo para Deploy:
1. Crie uma conta no [Railway.app](https://railway.app/).
2. Conecte seu repositório GitHub.
3. Vá em **Settings > Variables** e adicione todas as variáveis do arquivo `.env`.
4. (Opcional mas recomendado) Vá em **Volumes** e crie um volume montado em `/app/data`. Altere a variável `STORAGE_PATH` para `./data/storage.json`.
5. O Railway iniciará o build e execução automaticamente via `npm start`.

## 📝 Logs

O sistema gera logs detalhados:
- `combined.log`: Todos os eventos de execução.
- `error.log`: Apenas erros críticos.
- Console: Saída colorida para monitoramento em tempo real.

---
Desenvolvido para facilitar sua rotina. Não esqueça mais o ponto! 🚀
# PointCentral
