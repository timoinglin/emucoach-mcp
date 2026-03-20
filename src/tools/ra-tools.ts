import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendRaCommand, sendRaCommandBatch } from "../services/ra-client.js";

export function registerRaTools(server: McpServer): void {
  server.tool(
    "ra_command",
    "Send a single command to the worldserver via Remote Access (telnet). Examples: '.server info', '.account create test test', '.reload all', '.gm on', '.additem 49623 1', '.teleport <player> <location>', '.ban account <name> <time> <reason>'. The command should include the leading dot.",
    {
      command: z
        .string()
        .describe("The RA command to send (with leading dot), e.g. '.server info'"),
    },
    async ({ command }) => {
      const result = await sendRaCommand(command);
      if (result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: result.response || "(Command executed, no output returned)",
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `RA command failed: ${result.error}\n\nPartial response: ${result.response}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "ra_command_batch",
    "Send multiple RA commands in sequence. Stops on first error. Useful for bulk operations like reloading multiple tables or creating multiple accounts.",
    {
      commands: z
        .string()
        .describe(
          'JSON array of commands to send, e.g. \'[".reload creature_template", ".reload quest_template"]\''
        ),
    },
    async ({ commands }) => {
      try {
        const cmds = JSON.parse(commands) as string[];
        const results = await sendRaCommandBatch(cmds);

        const lines = results.map((r, i) => {
          const status = r.success ? "✓" : "✗";
          const response = r.response || r.error || "(no output)";
          return `${status} [${i + 1}] ${cmds[i]}\n  → ${response}`;
        });

        const allSuccess = results.every((r) => r.success);
        const summary = allSuccess
          ? `All ${results.length} commands executed successfully.`
          : `${results.filter((r) => r.success).length}/${cmds.length} commands succeeded.`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${lines.join("\n\n")}`,
            },
          ],
          isError: !allSuccess,
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Batch command error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
