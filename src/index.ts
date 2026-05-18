#!/usr/bin/env node
/**
 * Customer Intelligence MCP Server
 *
 * Provides tools for Claude to search for the latest updates on customers
 * using the Tavily Search API (web search). Supports single or batch lookups.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface CustomerUpdate {
  customer: string;
  query: string;
  results: SearchResult[];
  error?: string;
}

// ─── Tavily Search Helper ──────────────────────────────────────────────────────

async function tavilySearch(
  query: string,
  apiKey: string,
  count: number = 5,
  topic: "general" | "news" = "news"
): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      topic,
      days: 30,
      max_results: count,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Tavily Search API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };

  return (data.results ?? []).map((r) => ({
    title: r.title ?? "(no title)",
    url: r.url ?? "",
    description: r.content ?? "",
    age: r.published_date,
  }));
}

// ─── Build the search query for a given customer & focus ──────────────────────

function buildQuery(
  customerName: string,
  focus: "news" | "funding" | "leadership" | "product" | "all"
): string {
  const base = `"${customerName}"`;
  switch (focus) {
    case "news":
      return `${base} latest news announcement`;
    case "funding":
      return `${base} funding investment round valuation`;
    case "leadership":
      return `${base} CEO leadership executive hire`;
    case "product":
      return `${base} product launch release update`;
    case "all":
    default:
      return `${base} company update news 2024 2025`;
  }
}

// ─── Format results as markdown ───────────────────────────────────────────────

function formatResults(updates: CustomerUpdate[]): string {
  const lines: string[] = [];

  for (const update of updates) {
    lines.push(`## ${update.customer}`);
    lines.push(`_Query: ${update.query}_\n`);

    if (update.error) {
      lines.push(`⚠️ Error fetching results: ${update.error}\n`);
      continue;
    }

    if (update.results.length === 0) {
      lines.push("No recent results found.\n");
      continue;
    }

    for (const r of update.results) {
      lines.push(`### ${r.title}`);
      if (r.age) lines.push(`_${r.age}_`);
      lines.push(r.description);
      lines.push(`[Read more](${r.url})\n`);
    }
  }

  return lines.join("\n");
}

// ─── Server Setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "customer-intel-mcp",
  version: "1.0.0",
});

// ── Tool 1: search_customer ──────────────────────────────────────────────────
server.tool(
  "search_customer",
  "Search the web for the latest news and updates about a single customer company. Returns recent news, product announcements, funding rounds, and leadership changes.",
  {
    customer_name: z
      .string()
      .describe("The company or customer name to search for"),
    focus: z
      .enum(["news", "funding", "leadership", "product", "all"])
      .default("all")
      .describe(
        "What type of update to focus on: news, funding, leadership, product, or all"
      ),
    result_count: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("How many search results to return (1-10)"),
  },
  async ({ customer_name, focus, result_count }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "❌ TAVILY_API_KEY environment variable is not set. Please configure it to use this tool.",
          },
        ],
        isError: true,
      };
    }

    const query = buildQuery(customer_name, focus ?? "all");

    try {
      const results = await tavilySearch(query, apiKey, result_count ?? 5);
      const update: CustomerUpdate = {
        customer: customer_name,
        query,
        results,
      };
      const formatted = formatResults([update]);
      return {
        content: [{ type: "text", text: formatted }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error searching for "${customer_name}": ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool 2: search_customers_batch ───────────────────────────────────────────
server.tool(
  "search_customers_batch",
  "Search the web for the latest updates on a list of customer companies in one call. Ideal for generating a customer intelligence briefing across your entire book of business.",
  {
    customers: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe("List of company/customer names to search (max 20)"),
    focus: z
      .enum(["news", "funding", "leadership", "product", "all"])
      .default("all")
      .describe(
        "What type of update to focus on for all customers: news, funding, leadership, product, or all"
      ),
    results_per_customer: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3)
      .describe("Number of results per customer (1-5, keep low for large lists)"),
  },
  async ({ customers, focus, results_per_customer }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "❌ TAVILY_API_KEY environment variable is not set. Please configure it to use this tool.",
          },
        ],
        isError: true,
      };
    }

    const updates: CustomerUpdate[] = [];

    for (const customer of customers) {
      const query = buildQuery(customer, focus ?? "all");
      try {
        const results = await tavilySearch(
          query,
          apiKey,
          results_per_customer ?? 3
        );
        updates.push({ customer, query, results });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updates.push({ customer, query, results: [], error: message });
      }
      // Small delay to respect API rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    const summary = `# Customer Intelligence Briefing\n_${new Date().toLocaleDateString("en-US", { dateStyle: "long" })} — ${customers.length} customer(s)_\n\n---\n\n`;
    const formatted = formatResults(updates);

    return {
      content: [{ type: "text", text: summary + formatted }],
    };
  }
);

// ── Tool 3: get_customer_summary ─────────────────────────────────────────────
server.tool(
  "get_customer_summary",
  "Get a concise intelligence summary for a customer by running multiple targeted searches (news + funding + product) and combining the results.",
  {
    customer_name: z
      .string()
      .describe("The company or customer name to summarise"),
  },
  async ({ customer_name }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "❌ TAVILY_API_KEY environment variable is not set. Please configure it to use this tool.",
          },
        ],
        isError: true,
      };
    }

    const focusAreas: Array<"news" | "funding" | "product" | "leadership"> = [
      "news",
      "funding",
      "product",
      "leadership",
    ];
    const allResults: SearchResult[] = [];

    for (const focus of focusAreas) {
      const query = buildQuery(customer_name, focus);
      try {
        const results = await tavilySearch(query, apiKey, 2);
        allResults.push(...results);
      } catch {
        // Silently skip failed sub-queries
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const update: CustomerUpdate = {
      customer: customer_name,
      query: `Multi-angle search: news, funding, product, leadership`,
      results: deduped.slice(0, 8),
    };

    const formatted = formatResults([update]);
    return {
      content: [{ type: "text", text: formatted }],
    };
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
// Log to stderr only (stdout is reserved for MCP protocol)
console.error("✅ Customer Intel MCP server running on stdio");
