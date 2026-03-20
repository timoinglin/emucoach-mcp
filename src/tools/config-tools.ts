import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig, updateConfig, resetConfig, getConfigPath } from "../config.js";

export function registerConfigTools(server: McpServer): void {
  server.tool(
    "get_config",
    "Read the current MCP server config.json (database connection, RA settings, server paths)",
    {},
    async () => {
      try {
        const config = getConfig();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error reading config: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_config",
    "Update specific fields in config.json. Pass a JSON object with the fields to update (supports deep merge). Example: {\"database\": {\"password\": \"newpass\"}}",
    {
      patch: z
        .string()
        .describe("JSON string of fields to update (deep merged with existing config)"),
    },
    async ({ patch }) => {
      try {
        const patchObj = JSON.parse(patch) as Record<string, unknown>;
        const updated = updateConfig(patchObj);
        return {
          content: [
            {
              type: "text" as const,
              text: `Config updated successfully.\n\nNew config:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error updating config: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "reset_config",
    "Reset config.json to the default values from example.config.json",
    {},
    async () => {
      try {
        const config = resetConfig();
        return {
          content: [
            {
              type: "text" as const,
              text: `Config reset to defaults.\n\nConfig:\n${JSON.stringify(config, null, 2)}`,
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Error resetting config: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
