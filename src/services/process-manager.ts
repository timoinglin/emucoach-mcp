import { exec, spawn } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { getConfig, resolveConfigPath } from "../config.js";

const execAsync = promisify(exec);

export interface ProcessStatus {
  name: string;
  running: boolean;
  pid?: number;
}

// ---------------------------------------------------------------------------
//  Process helpers
// ---------------------------------------------------------------------------

/** Check if a process is running by its image name using tasklist. */
async function isProcessRunning(
  processName: string
): Promise<{ running: boolean; pid?: number }> {
  try {
    const { stdout } = await execAsync(
      `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`,
      { windowsHide: true }
    );
    const lines = stdout
      .trim()
      .split("\n")
      .filter((l) => l.toLowerCase().includes(processName.toLowerCase()));
    if (lines.length > 0) {
      const match = lines[0].match(/"[^"]+","(\d+)"/);
      return { running: true, pid: match ? parseInt(match[1], 10) : undefined };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

/**
 * Stop a process by image name.
 * Checks whether the process is actually running before calling taskkill,
 * so we never rely on parsing localised error messages.
 */
async function stopProcess(
  processName: string,
  displayName: string
): Promise<{ success: boolean; message: string }> {
  const status = await isProcessRunning(processName);
  if (!status.running) {
    return { success: true, message: `${displayName} is not running.` };
  }

  try {
    await execAsync(`taskkill /IM "${processName}" /F`, {
      windowsHide: true,
    });
  } catch {
    // taskkill can exit non-zero even when the kill works; we verify below.
  }

  // Give the OS a moment to clean up, then verify
  await new Promise((r) => setTimeout(r, 1500));
  const check = await isProcessRunning(processName);
  if (!check.running) {
    return { success: true, message: `Stopped ${displayName}.` };
  }
  return {
    success: false,
    message: `${displayName} is still running after stop attempt.`,
  };
}

/**
 * Launch an executable in a **new visible console window**.
 *
 * Uses `cmd.exe /c start "" /D "<cwd>" "<exe>" [args …]`.
 * - The outer `cmd.exe` inherits the MCP server's hidden console (windowsHide).
 * - `start ""` allocates a brand-new visible console for the target executable.
 *
 * This mirrors the Python `subprocess.Popen(…, creationflags=CREATE_NEW_CONSOLE)`
 * pattern used in tele-wow.
 */
function launchInNewConsole(
  exePath: string,
  workingDir: string,
  extraArgs: string[] = []
): void {
  // Build 'start' arguments: start "title" /D "workdir" "exe" args...
  const startArgs = [
    "/c",
    "start",
    '""',           // window title (empty)
    "/D",
    workingDir,     // working directory for the new process
    exePath,        // executable
    ...extraArgs,
  ];

  const child = spawn("cmd.exe", startArgs, {
    stdio: "ignore",
    detached: true,
    windowsHide: true, // hide the transient cmd.exe, 'start' creates its own window
  });
  child.unref();
}

// ---------------------------------------------------------------------------
//  MySQL
// ---------------------------------------------------------------------------

export async function startMySQL(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  const processName = config.servers.mysql.process_name;
  const workingDir = resolveConfigPath(config.servers.mysql.working_dir);

  const status = await isProcessRunning(processName);
  if (status.running) {
    return {
      success: true,
      message: `MySQL is already running (PID: ${status.pid}).`,
    };
  }

  try {
    if (config.servers.mysql.start_script) {
      // The .bat file typically contains its own `start mysqld …` command,
      // which opens a visible console for mysqld.  We just need to run the
      // bat file itself; wrapping it in another `start` makes sure the
      // transient cmd.exe that runs the bat does not hang.
      const batPath = resolveConfigPath(config.servers.mysql.start_script);
      if (!existsSync(batPath)) {
        return {
          success: false,
          message: `MySQL start script not found: ${batPath}`,
        };
      }
      launchInNewConsole(batPath, workingDir);
    } else {
      // Fallback: launch mysqld directly
      const mysqldPath = resolveConfigPath(
        config.servers.mysql.working_dir + "/mysql/bin/mysqld.exe"
      );
      if (!existsSync(mysqldPath)) {
        return {
          success: false,
          message: `mysqld.exe not found: ${mysqldPath}`,
        };
      }
      launchInNewConsole(mysqldPath, workingDir, [
        "--defaults-file=mysql/bin/my.cnf",
        "--standalone",
        "--console",
      ]);
    }

    // MySQL can take a moment to initialise
    await new Promise((r) => setTimeout(r, 3000));
    const check = await isProcessRunning(processName);
    if (check.running) {
      return {
        success: true,
        message: `MySQL started successfully (PID: ${check.pid}).`,
      };
    }
    return {
      success: false,
      message: "MySQL process not detected after startup. Check the console window for errors.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Failed to start MySQL: ${(err as Error).message}`,
    };
  }
}

export async function stopMySQL(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  return stopProcess(config.servers.mysql.process_name, "MySQL");
}

// ---------------------------------------------------------------------------
//  Authserver
// ---------------------------------------------------------------------------

export async function startAuthserver(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  const processName = config.servers.authserver.process_name;
  const workingDir = resolveConfigPath(config.servers.authserver.working_dir);
  const exePath = resolveConfigPath(config.servers.authserver.path!);

  const status = await isProcessRunning(processName);
  if (status.running) {
    return {
      success: true,
      message: `Authserver is already running (PID: ${status.pid}).`,
    };
  }

  if (!existsSync(exePath)) {
    return {
      success: false,
      message: `Authserver executable not found: ${exePath}`,
    };
  }

  try {
    launchInNewConsole(exePath, workingDir);

    await new Promise((r) => setTimeout(r, 2000));
    const check = await isProcessRunning(processName);
    if (check.running) {
      return {
        success: true,
        message: `Authserver started successfully (PID: ${check.pid}).`,
      };
    }
    return {
      success: false,
      message: "Authserver process not detected after startup. Check the console window for errors.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Failed to start authserver: ${(err as Error).message}`,
    };
  }
}

export async function stopAuthserver(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  return stopProcess(config.servers.authserver.process_name, "Authserver");
}

// ---------------------------------------------------------------------------
//  Worldserver
// ---------------------------------------------------------------------------

export async function startWorldserver(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  const processName = config.servers.worldserver.process_name;
  const workingDir = resolveConfigPath(config.servers.worldserver.working_dir);
  const exePath = resolveConfigPath(config.servers.worldserver.path!);

  const status = await isProcessRunning(processName);
  if (status.running) {
    return {
      success: true,
      message: `Worldserver is already running (PID: ${status.pid}).`,
    };
  }

  if (!existsSync(exePath)) {
    return {
      success: false,
      message: `Worldserver executable not found: ${exePath}`,
    };
  }

  try {
    launchInNewConsole(exePath, workingDir);

    // Worldserver takes longer to initialise (loading maps, etc.)
    await new Promise((r) => setTimeout(r, 5000));
    const check = await isProcessRunning(processName);
    if (check.running) {
      return {
        success: true,
        message: `Worldserver started successfully (PID: ${check.pid}).`,
      };
    }
    return {
      success: false,
      message: "Worldserver process not detected after startup. Check the console window for errors.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Failed to start worldserver: ${(err as Error).message}`,
    };
  }
}

export async function stopWorldserver(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getConfig();
  return stopProcess(config.servers.worldserver.process_name, "Worldserver");
}

// ---------------------------------------------------------------------------
//  Combined status
// ---------------------------------------------------------------------------

export async function getServerStatus(): Promise<ProcessStatus[]> {
  const config = getConfig();
  const [mysqlStatus, authStatus, worldStatus] = await Promise.all([
    isProcessRunning(config.servers.mysql.process_name),
    isProcessRunning(config.servers.authserver.process_name),
    isProcessRunning(config.servers.worldserver.process_name),
  ]);

  return [
    { name: "MySQL", ...mysqlStatus },
    { name: "Authserver", ...authStatus },
    { name: "Worldserver", ...worldStatus },
  ];
}
