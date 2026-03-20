import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query, execute, executeRaw, testConnection, type DbName } from "../services/database.js";

const dbEnum = z.enum(["auth", "characters", "world"]);

export function registerDatabaseTools(server: McpServer): void {
  server.tool(
    "db_query",
    "Execute a SELECT query on the specified database (auth, characters, or world). Returns rows as JSON. Use parameterized queries with ? placeholders.",
    {
      database: dbEnum.describe("Target database: auth, characters, or world"),
      sql: z.string().describe("SQL SELECT query (use ? for parameter placeholders)"),
      params: z
        .string()
        .optional()
        .describe("JSON array of parameter values for ? placeholders, e.g. '[1, \"name\"]'"),
    },
    async ({ database, sql, params }) => {
      try {
        const parsedParams = params ? (JSON.parse(params) as unknown[]) : undefined;
        const rows = await query(database as DbName, sql, parsedParams);

        const truncatedRows = rows.slice(0, 100);
        const totalRows = rows.length;
        let text = JSON.stringify(truncatedRows, null, 2);
        if (totalRows > 100) {
          text += `\n\n... (showing 100 of ${totalRows} rows, add LIMIT to your query)`;
        }
        text = `${totalRows} row(s) returned.\n\n${text}`;

        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Query error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "db_insert",
    "Insert a row into a table. Provide the table name, column names, and values.",
    {
      database: dbEnum.describe("Target database: auth, characters, or world"),
      table: z.string().describe("Table name"),
      columns: z.string().describe("JSON array of column names, e.g. '[\"name\", \"level\"]'"),
      values: z.string().describe("JSON array of values, e.g. '[\"TestNPC\", 60]'"),
    },
    async ({ database, table, columns, values }) => {
      try {
        const cols = JSON.parse(columns) as string[];
        const vals = JSON.parse(values) as unknown[];
        const placeholders = cols.map(() => "?").join(", ");
        const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders})`;
        const result = await execute(database as DbName, sql, vals);
        return {
          content: [
            {
              type: "text" as const,
              text: `Insert successful.\nAffected rows: ${result.affectedRows}\nInsert ID: ${result.insertId}`,
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Insert error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "db_update",
    "Update rows in a table. Provide SET clause values and WHERE conditions.",
    {
      database: dbEnum.describe("Target database: auth, characters, or world"),
      table: z.string().describe("Table name"),
      set_columns: z.string().describe("JSON array of column names to update"),
      set_values: z.string().describe("JSON array of new values"),
      where_clause: z.string().describe("WHERE clause (without 'WHERE' keyword), e.g. 'id = ?' or 'name = ?'"),
      where_params: z.string().optional().describe("JSON array of WHERE parameter values"),
    },
    async ({ database, table, set_columns, set_values, where_clause, where_params }) => {
      try {
        const cols = JSON.parse(set_columns) as string[];
        const vals = JSON.parse(set_values) as unknown[];
        const whereParams = where_params ? (JSON.parse(where_params) as unknown[]) : [];

        const setClause = cols.map((c) => `\`${c}\` = ?`).join(", ");
        const sql = `UPDATE \`${table}\` SET ${setClause} WHERE ${where_clause}`;
        const allParams = [...vals, ...whereParams];
        const result = await execute(database as DbName, sql, allParams);

        return {
          content: [
            {
              type: "text" as const,
              text: `Update successful.\nAffected rows: ${result.affectedRows}`,
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Update error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "db_delete",
    "Delete rows from a table. ALWAYS requires a WHERE clause for safety.",
    {
      database: dbEnum.describe("Target database: auth, characters, or world"),
      table: z.string().describe("Table name"),
      where_clause: z.string().describe("WHERE clause (without 'WHERE' keyword), e.g. 'entry = ?'"),
      where_params: z.string().optional().describe("JSON array of WHERE parameter values"),
    },
    async ({ database, table, where_clause, where_params }) => {
      try {
        const whereParams = where_params ? (JSON.parse(where_params) as unknown[]) : [];
        const sql = `DELETE FROM \`${table}\` WHERE ${where_clause}`;
        const result = await execute(database as DbName, sql, whereParams);

        return {
          content: [
            {
              type: "text" as const,
              text: `Delete successful.\nAffected rows: ${result.affectedRows}`,
            },
          ],
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Delete error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "db_execute",
    "Execute raw SQL on a database (for DDL, complex queries, multi-table joins, etc). Use with caution.",
    {
      database: dbEnum.describe("Target database: auth, characters, or world"),
      sql: z.string().describe("Raw SQL statement to execute"),
      params: z.string().optional().describe("JSON array of parameter values"),
    },
    async ({ database, sql, params }) => {
      try {
        const parsedParams = params ? (JSON.parse(params) as unknown[]) : undefined;
        const result = await executeRaw(database as DbName, sql, parsedParams);

        let text: string;
        if (Array.isArray(result)) {
          const truncated = result.slice(0, 100);
          text = `${result.length} row(s) returned.\n\n${JSON.stringify(truncated, null, 2)}`;
          if (result.length > 100) {
            text += `\n\n... (showing 100 of ${result.length} rows)`;
          }
        } else {
          text = `Execution successful.\n\n${JSON.stringify(result, null, 2)}`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Execute error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "db_test_connection",
    "Test database connectivity to auth, characters, and world databases",
    {},
    async () => {
      try {
        const results = await Promise.all([
          testConnection("auth"),
          testConnection("characters"),
          testConnection("world"),
        ]);
        const text = [
          `Auth DB:       ${results[0] ? "✓ Connected" : "✗ Failed"}`,
          `Characters DB: ${results[1] ? "✓ Connected" : "✗ Failed"}`,
          `World DB:      ${results[2] ? "✓ Connected" : "✗ Failed"}`,
        ].join("\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          content: [{ type: "text" as const, text: `Connection test error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
