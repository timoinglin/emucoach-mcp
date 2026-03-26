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
        // Deep merge of auth and world sub-objects
        if (data.schema_override.auth) {
          currentSchema.auth = { ...MoPSchema.auth, ...data.schema_override.auth };
        }
        if (data.schema_override.world) {
          currentSchema.world = { ...MoPSchema.world, ...data.schema_override.world };
        }
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
