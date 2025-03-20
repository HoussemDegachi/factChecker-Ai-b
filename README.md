## 🚀 Run Our Backend Locally

this backend is hosted [https://missinformation-detector-b-production.up.railway.app/](https://missinformation-detector-b-production.up.railway.app/)
Route: /analysis/{YtVideoId}

make sure you download the [extension](https://github.com/HoussemDegachi/FactChecker-Ai)

Clone the project:

```bash
git clone https://github.com/HoussemDegachi/factChecker-Ai-b
```

Navigate to the project directory:

```bash
cd factChecker-Ai-b
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm run dev
```

## Add the .env file

```env
GEMINI_API_KEY="GEMINI_KEY"
DB_URL="mongodb+srv://houssemdegachi:JuwPdZEnchfEBk4P@factai.0wpcg.mongodb.net/?retryWrites=true&w=majority&appName=FactAi"
PORT=3000
```
