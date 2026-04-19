# Using Nella MCP in n8n

Nella now implements the **standard Model Context Protocol SSE transport**, which means it works natively with n8n!

## Configuration

In your n8n workspace, go to **Settings > AI > MCP Servers** and add a new connection:

* **Type**: SSE (Server-Sent Events)
* **URL**: `https://mcp.getnella.dev/sse`
* **Headers**:
  * **Key**: `Authorization`
  * **Value**: `Bearer nella_PajGk1ItRSS2223Ub9YsBftVpqOd5oF6XdzSOB4E8Rs`

> Note: Make sure you deploy the latest updates to `mcp.getnella.dev` first so the `/sse` endpoint is live!
