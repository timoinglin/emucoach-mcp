import { MoPSchema, SchemaDefinition } from './definitions.js';
import * as fs from 'fs';
import * as path from 'path';

let currentSchema: SchemaDefinition = MoPSchema;

/**
 * Loads the schema based on configuration.
 * Currently defaults to MoPSchema but can be extended to load from a JSON file.
 */
export async function initializeSchema(configPath?: string): Promise<SchemaDefinition> {
  if (configPath && fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.schema_override) {
         // Deep merge or replace logic here
         currentSchema = { ...MoPSchema, ...data.schema_override };
      }
    } catch (err) {
      console.error('Failed to load schema override:', err);
    }
  }
  return currentSchema;
}

/**
 * Returns the currently active schema definition.
 */
export function getSchema(): SchemaDefinition {
  return currentSchema;
}
