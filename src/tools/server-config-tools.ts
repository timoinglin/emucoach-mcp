import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  readConfigFile, writeConfigFile, updateConfValue, getConfValue, getAllowedFiles,
} from "../services/file-manager.js";

export function registerServerConfigTools(server: McpServer): void {
  server.tool("read_server_config",
    "Read a server config file. Allowed: config.json, worldserver.conf, authserver.conf, my.ini, my.cnf",
    { file: z.string().describe("File key, e.g. 'worldserver.conf'") },
    async ({ file }) => {
      const result = readConfigFile(file);
      if (result.success) {
        let content = result.content!;
        if (content.length > 50000) {
          content = content.substring(0, 50000) + `\n\n... (truncated, ${result.content!.length} chars total)`;
        }
        return { content: [{ type: "text" as const, text: content }] };
      }
      return { content: [{ type: "text" as const, text: result.error! }], isError: true };
    }
  );

  server.tool("write_server_config",
    "Write/overwrite entire server config file. Use update_conf_value for single settings.",
    { file: z.string().describe("File key"), content: z.string().describe("New file contents") },
    async ({ file, content }) => {
      const result = writeConfigFile(file, content);
      if (result.success) {
        return { content: [{ type: "text" as const, text: `"${file}" written (${content.length} chars).` }] };
      }
      return { content: [{ type: "text" as const, text: result.error! }], isError: true };
    }
  );

  server.tool("get_conf_value",
    "Get a specific Key=Value setting from a .conf file",
    { file: z.string().describe("'worldserver.conf' or 'authserver.conf'"), key: z.string().describe("Config key, e.g. 'MaxPlayerLevel'") },
    async ({ file, key }) => {
      const result = getConfValue(file, key);
      if (result.success) return { content: [{ type: "text" as const, text: `${key} = ${result.value}` }] };
      return { content: [{ type: "text" as const, text: result.error! }], isError: true };
    }
  );

  server.tool("update_conf_value",
    "Update a specific Key=Value setting in a .conf file in-place. Restart server for changes to take effect.",
    { file: z.string().describe("'worldserver.conf' or 'authserver.conf'"), key: z.string().describe("Config key"), value: z.string().describe("New value") },
    async ({ file, key, value }) => {
      const result = updateConfValue(file, key, value);
      if (result.success) {
        return { content: [{ type: "text" as const, text: `Updated ${key}: ${result.oldValue} → ${value}. Restart server for effect.` }] };
      }
      return { content: [{ type: "text" as const, text: result.error! }], isError: true };
    }
  );

  server.tool("list_allowed_files",
    "List all files the MCP server can read/write",
    {},
    async () => {
      const files = getAllowedFiles();
      return { content: [{ type: "text" as const, text: `Allowed files:\n${files.map(f => `  • ${f}`).join("\n")}` }] };
    }
  );
}
