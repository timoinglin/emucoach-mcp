import * as net from "net";
import { getConfig } from "../config.js";

/**
 * RA (Remote Access) client for the worldserver's telnet interface.
 * 
 * The SkyFire RA protocol:
 * 1. Connect to host:port
 * 2. Server sends "Username:" prompt
 * 3. Send username + \r\n
 * 4. Server sends "Password:" prompt
 * 5. Send password + \r\n
 * 6. Server sends authentication result
 * 7. Send command + \r\n
 * 8. Server sends response ending with "SF>" prompt
 * 9. Disconnect
 */

export interface RaResult {
  success: boolean;
  response: string;
  error?: string;
}

export async function sendRaCommand(command: string): Promise<RaResult> {
  const config = getConfig();
  const { host, port, username, password, timeout_seconds } = config.remote_access;
  const timeout = (timeout_seconds || 10) * 1000;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = "";
    let phase: "username" | "password" | "auth" | "command" | "done" = "username";
    let commandResponse = "";
    let resolved = false;

    const finish = (result: RaResult) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        success: false,
        response: buffer,
        error: `Connection timed out after ${timeout_seconds}s`,
      });
    }, timeout);

    socket.on("connect", () => {
      // Wait for server prompt
    });

    socket.on("data", (data: Buffer) => {
      buffer += data.toString();

      if (phase === "username" && buffer.toLowerCase().includes("username")) {
        phase = "password";
        buffer = "";
        socket.write(username + "\r\n");
      } else if (phase === "password" && buffer.toLowerCase().includes("password")) {
        phase = "auth";
        buffer = "";
        socket.write(password + "\r\n");
      } else if (phase === "auth") {
        // Check for auth result — look for the prompt or error
        if (buffer.includes("SF>") || buffer.includes("TC>") || buffer.includes("+")) {
          phase = "command";
          buffer = "";
          socket.write(command + "\r\n");
        } else if (
          buffer.toLowerCase().includes("wrong") ||
          buffer.toLowerCase().includes("denied") ||
          buffer.toLowerCase().includes("failed") ||
          buffer.toLowerCase().includes("invalid")
        ) {
          clearTimeout(timer);
          finish({
            success: false,
            response: "",
            error: `RA authentication failed: ${buffer.trim()}`,
          });
        }
      } else if (phase === "command") {
        commandResponse += data.toString();
        // Check if response is complete (ends with prompt)
        if (
          commandResponse.includes("SF>") ||
          commandResponse.includes("TC>") ||
          commandResponse.includes("\nMoP>") ||
          commandResponse.includes("\nmop>")
        ) {
          phase = "done";
          clearTimeout(timer);
          // Clean up the response — remove the prompt
          let clean = commandResponse
            .replace(/SF>/g, "")
            .replace(/TC>/g, "")
            .replace(/MoP>/gi, "")
            .trim();
          finish({ success: true, response: clean });
        }
      }
    });

    socket.on("error", (err: Error) => {
      clearTimeout(timer);
      finish({
        success: false,
        response: "",
        error: `RA connection error: ${err.message}`,
      });
    });

    socket.on("close", () => {
      clearTimeout(timer);
      if (!resolved) {
        // If we got data but the connection closed before seeing a prompt,
        // still return what we have
        if (commandResponse.trim()) {
          finish({ success: true, response: commandResponse.trim() });
        } else if (buffer.trim()) {
          finish({ success: false, response: buffer.trim(), error: "Connection closed unexpectedly" });
        } else {
          finish({ success: false, response: "", error: "Connection closed without response" });
        }
      }
    });

    socket.connect(port, host);
  });
}

export async function sendRaCommandBatch(commands: string[]): Promise<RaResult[]> {
  const results: RaResult[] = [];
  for (const cmd of commands) {
    const result = await sendRaCommand(cmd);
    results.push(result);
    if (!result.success) break; // Stop on first error
  }
  return results;
}
