import { z } from 'zod';

/**
 * Base intent schema
 */
const BaseIntentSchema = z.object({
  type: z.string(),
  reasoning: z.string(),
});

/**
 * Create directory intent
 */
const CreateDirectoryIntentSchema = BaseIntentSchema.extend({
  type: z.literal('create_directory'),
  path: z.string(),
  recursive: z.boolean(),
});

/**
 * Create file intent
 */
const CreateFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('create_file'),
  path: z.string(),
  content: z.string().optional(),
  overwrite: z.boolean(),
});

/**
 * Write file intent
 */
const WriteFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('write_file'),
  path: z.string(),
  content: z.string(),
  overwrite: z.boolean(),
});

/**
 * Delete file intent
 */
const DeleteFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('delete_file'),
  path: z.string(),
  confirm: z.boolean(),
});

/**
 * Delete directory intent
 */
const DeleteDirectoryIntentSchema = BaseIntentSchema.extend({
  type: z.literal('delete_directory'),
  path: z.string(),
  recursive: z.boolean(),
  confirm: z.boolean(),
});

/**
 * Modify file intent
 */
const ModifyFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('modify_file'),
  path: z.string(),
  search: z.string(),
  replace: z.string(),
  global: z.boolean(),
});

/**
 * Copy file intent
 */
const CopyFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('copy_file'),
  sourcePath: z.string(),
  destinationPath: z.string(),
  overwrite: z.boolean(),
});

/**
 * Move file intent
 */
const MoveFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('move_file'),
  sourcePath: z.string(),
  destinationPath: z.string(),
  overwrite: z.boolean(),
});

/**
 * Rename file intent
 */
const RenameFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('rename_file'),
  path: z.string(),
  newName: z.string(),
  overwrite: z.boolean(),
});

/**
 * List directory intent
 */
const ListDirectoryIntentSchema = BaseIntentSchema.extend({
  type: z.literal('list_directory'),
  path: z.string(),
  detailed: z.boolean().optional(),
});

/**
 * Read file intent
 */
const ReadFileIntentSchema = BaseIntentSchema.extend({
  type: z.literal('read_file'),
  path: z.string(),
  lines: z.number().optional(),
  fromLine: z.number().optional(),
});

/**
 * Undo intent
 */
const UndoIntentSchema = z.object({
  type: z.literal('undo'),
  reasoning: z.string().optional(),
});

/**
 * Help intent
 */
const HelpIntentSchema = BaseIntentSchema.extend({
  type: z.literal('help'),
});

/**
 * Explain intent
 */
const ExplainIntentSchema = BaseIntentSchema.extend({
  type: z.literal('explain'),
  message: z.string().optional(),
});

/**
 * Union of all command intents
 */
export const CommandIntentSchema = z.discriminatedUnion('type', [
  CreateDirectoryIntentSchema,
  CreateFileIntentSchema,
  WriteFileIntentSchema,
  DeleteFileIntentSchema,
  DeleteDirectoryIntentSchema,
  ModifyFileIntentSchema,
  CopyFileIntentSchema,
  MoveFileIntentSchema,
  RenameFileIntentSchema,
  ListDirectoryIntentSchema,
  ReadFileIntentSchema,
  UndoIntentSchema,
  HelpIntentSchema,
  ExplainIntentSchema,
]);

// Export types
export type CommandIntent = z.infer<typeof CommandIntentSchema>;
export type CreateDirectoryIntent = z.infer<typeof CreateDirectoryIntentSchema>;
export type CreateFileIntent = z.infer<typeof CreateFileIntentSchema>;
export type WriteFileIntent = z.infer<typeof WriteFileIntentSchema>;
export type DeleteFileIntent = z.infer<typeof DeleteFileIntentSchema>;
export type DeleteDirectoryIntent = z.infer<typeof DeleteDirectoryIntentSchema>;
export type ModifyFileIntent = z.infer<typeof ModifyFileIntentSchema>;
export type CopyFileIntent = z.infer<typeof CopyFileIntentSchema>;
export type MoveFileIntent = z.infer<typeof MoveFileIntentSchema>;
export type RenameFileIntent = z.infer<typeof RenameFileIntentSchema>;
export type ListDirectoryIntent = z.infer<typeof ListDirectoryIntentSchema>;
export type ReadFileIntent = z.infer<typeof ReadFileIntentSchema>;
export type UndoIntent = z.infer<typeof UndoIntentSchema>;
export type HelpIntent = z.infer<typeof HelpIntentSchema>;
export type ExplainIntent = z.infer<typeof ExplainIntentSchema>;
