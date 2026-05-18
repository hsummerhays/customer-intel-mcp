# Customer Intelligence MCP Server

A local MCP (Model Context Protocol) server that gives Claude the ability to search the web for the **latest news, funding rounds, product launches, and leadership changes** for any customer or company.

---

## Tools Provided

| Tool | Description |
|---|---|
| `search_customer` | Search for updates on a **single** customer with a configurable focus area |
| `search_customers_batch` | Search for updates on a **list** of customers in one call |
| `get_customer_summary` | Run a **multi-angle deep search** (news + funding + product + leadership) for one customer |

---

## Prerequisites

- **Node.js 18+** — [download here](https://nodejs.org)
- **Tavily Search API key** (free tier available) — [get one here](https://tavily.com)

---

## Setup

### 1. Install dependencies & build

```bash
cd customer-intel-mcp
npm install
npm run build
```

### 2. Get a Tavily Search API key

1. Go to [https://tavily.com](https://tavily.com)
2. Sign up for a free developer account (1,000 free queries/month)
3. Copy your API key

---

## Connect to Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this entry (replace the path and API key with your own):

```json
{
  "mcpServers": {
    "customer-intel": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/customer-intel-mcp/build/index.js"],
      "env": {
        "TAVILY_API_KEY": "YOUR_TAVILY_API_KEY_HERE"
      }
    }
  }
}
```

Then **fully quit and restart Claude Desktop**. You should see a plug 🔌 icon in the chat input — click it to confirm the server is connected.

---

## Connect to Claude Code

```bash
claude mcp add customer-intel \
  -e TAVILY_API_KEY=YOUR_TAVILY_API_KEY_HERE \
  -- node /ABSOLUTE/PATH/TO/customer-intel-mcp/build/index.js
```

Verify it's connected:
```bash
claude mcp list
```

---

## Connect to ChatGPT

ChatGPT supports connecting to custom MCP servers via **SSE (Server-Sent Events)** over a secure public URL (HTTP/HTTPS). Since ChatGPT runs in the cloud and cannot connect directly to a local `stdio` process on your machine, you must run it with an SSE transport and expose it to the internet using a tunneling tool (like **ngrok**).

### 1. Run as an SSE Server
To run this server with SSE transport, you can use an MCP stdio-to-sse bridge or run a simple Node.js SSE host that wraps the MCP server.

### 2. Expose to the Public Internet
Start a secure tunnel on the port your local SSE server is running on (e.g., port `3000`):
```bash
ngrok http 3000
```
Copy the generated public HTTPS URL (e.g., `https://your-tunnel-subdomain.ngrok-free.app`).

### 3. Connect in ChatGPT Settings
1. Open ChatGPT and go to **Settings** → **Apps** (or **Connectors**).
2. Enable **Developer Mode** (this will make the **Create** button appear).
3. Click the **Create** button under custom connectors.
4. Fill in the details:
   * **App Name:** `Customer Intelligence`
   * **URL:** Your public HTTPS tunnel URL (e.g., `https://your-tunnel-subdomain.ngrok-free.app/sse`)
5. Check **"I trust this application"** and click **Save**.

ChatGPT will automatically discover the tools (`search_customer`, `search_customers_batch`, `get_customer_summary`) and let you interact with them directly!

---

## Example Prompts

Once connected, you can ask Claude:

> **"Search for the latest news on Acme Corp"**

> **"Get a full intelligence summary for Stripe"**

> **"Search for funding updates for these customers: Notion, Figma, Linear, Vercel"**

> **"What are the latest product launches from Salesforce? Focus on product news only."**

---

## Focus Areas

When calling `search_customer` or `search_customers_batch`, you can set a `focus`:

| Focus | What it searches for |
|---|---|
| `all` | General company news and updates (default) |
| `news` | Latest announcements and press releases |
| `funding` | Investment rounds, valuations, M&A |
| `leadership` | CEO changes, executive hires/departures |
| `product` | Product launches, releases, feature updates |

---

## Development

Run the server directly without building:

```bash
npm run dev
```

Test via MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

Set your API key first:
```bash
export TAVILY_API_KEY=your_key_here
npx @modelcontextprotocol/inspector node build/index.js
```

---

## File Structure

```
customer-intel-mcp/
├── src/
│   └── index.ts        # MCP server source (TypeScript)
├── build/
│   └── index.js        # Compiled output (run this)
├── package.json
├── tsconfig.json
└── README.md
```
