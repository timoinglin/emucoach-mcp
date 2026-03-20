import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  startMySQL,
  stopMySQL,
  startAuthserver,
  stopAuthserver,
  startWorldserver,
  stopWorldserver,
  getServerStatus,
} from "../services/process-manager.js";

export function registerProcessTools(server: McpServer): void {
  server.tool(
    "start_mysql",
    "Start the MySQL server using MySQL.bat. Will report if already running.",
    {},
    async () => {
      const result = await startMySQL();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "stop_mysql",
    "Stop the MySQL server process (taskkill). Warning: will forcefully terminate the process.",
    {},
    async () => {
      const result = await stopMySQL();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "restart_mysql",
    "Restart MySQL server (stop then start). Wait a few seconds between stop and start.",
    {},
    async () => {
      const stopResult = await stopMySQL();
      // Wait for process to fully stop
      await new Promise((r) => setTimeout(r, 3000));
      const startResult = await startMySQL();
      return {
        content: [
          {
            type: "text" as const,
            text: `Stop: ${stopResult.message}\nStart: ${startResult.message}`,
          },
        ],
        isError: !startResult.success,
      };
    }
  );

  server.tool(
    "start_authserver",
    "Start the authserver (login server). Will report if already running.",
    {},
    async () => {
      const result = await startAuthserver();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "stop_authserver",
    "Stop the authserver process.",
    {},
    async () => {
      const result = await stopAuthserver();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "restart_authserver",
    "Restart the authserver (stop then start).",
    {},
    async () => {
      const stopResult = await stopAuthserver();
      await new Promise((r) => setTimeout(r, 2000));
      const startResult = await startAuthserver();
      return {
        content: [
          {
            type: "text" as const,
            text: `Stop: ${stopResult.message}\nStart: ${startResult.message}`,
          },
        ],
        isError: !startResult.success,
      };
    }
  );

  server.tool(
    "start_worldserver",
    "Start the worldserver (game server). Will report if already running.",
    {},
    async () => {
      const result = await startWorldserver();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "stop_worldserver",
    "Stop the worldserver process.",
    {},
    async () => {
      const result = await stopWorldserver();
      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    "restart_worldserver",
    "Restart the worldserver (stop then start).",
    {},
    async () => {
      const stopResult = await stopWorldserver();
      await new Promise((r) => setTimeout(r, 3000));
      const startResult = await startWorldserver();
      return {
        content: [
          {
            type: "text" as const,
            text: `Stop: ${stopResult.message}\nStart: ${startResult.message}`,
          },
        ],
        isError: !startResult.success,
      };
    }
  );

  server.tool(
    "get_server_status",
    "Check if MySQL, authserver, and worldserver processes are currently running. Returns PID if running.",
    {},
    async () => {
      const statuses = await getServerStatus();
      const lines = statuses.map((s) => {
        const icon = s.running ? "🟢" : "🔴";
        const pid = s.running && s.pid ? ` (PID: ${s.pid})` : "";
        return `${icon} ${s.name}: ${s.running ? "Running" : "Stopped"}${pid}`;
      });
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
