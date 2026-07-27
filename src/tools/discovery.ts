/**
 * Discovery-tier tool. Registered ONLY when the server runs in --discover mode
 * (pointed at a projects root rather than a single vault). Lets a client see
 * every MasterVault under the root by name.
 *
 * Credit: multi-vault discovery contributed by Grigori Korotkikh. Security note:
 * this tool only *lists* vaults; file operations remain confined to the active
 * vault's VaultService. Listing is read-only and cannot mutate or escape.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VaultDiscovery } from "../services/discovery.js";
import { ok, fail } from "../services/format.js";
import { ResponseFormat } from "../schemas/index.js";

const ListVaultsInputSchema = z
  .object({
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' or 'json'"),
  })
  .strict();

export function registerDiscoveryTools(
  server: McpServer,
  discovery: VaultDiscovery
): void {
  server.registerTool(
    "mastervault_list_vaults",
    {
      title: "List discovered MasterVaults",
      description: `List every MasterVault found under the discovery root.

Available only when the server is started in discovery mode (pointed at a parent directory that contains multiple vaults). Each result is a directory containing an _orientation.md file.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  The name and path of each discovered vault.

Examples:
  - Use when: the server was started against a projects root and you want to see which vaults are available.
  - Don't use when: the server was started against a single vault (this tool won't be registered).`,
      inputSchema: ListVaultsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        const vaults = await discovery.discover();
        const structured = {
          root: discovery.getRoot(),
          count: vaults.length,
          vaults,
        };
        if (params.response_format === ResponseFormat.JSON) {
          return ok(JSON.stringify(structured, null, 2), structured);
        }
        const lines = [
          `# Discovered MasterVaults (${vaults.length})`,
          `Root: ${discovery.getRoot()}`,
          ``,
        ];
        for (const v of vaults) lines.push(`- **${v.name}** — ${v.path}`);
        if (!vaults.length) lines.push("_No vaults found under this root._");
        return ok(lines.join("\n"), structured);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
