import { z } from "zod";

const scenePositionSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
]);

export const worldPromptSchema = z.object({
  type: z.literal("text"),
  text_prompt: z.string().min(1),
  disable_recaption: z.boolean().nullable().optional(),
});

export const scriptCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  playerSelectable: z.boolean(),
  publicBrief: z.string().min(1),
  privateBrief: z.string().min(1),
  secret: z.string().min(1),
  isMurderer: z.boolean(),
  scenePosition: scenePositionSchema,
  portrait: z.string().min(1),
});

export const scriptClueSchema = z.object({
  id: z.string().min(1),
  location: z.string().min(1),
  requires: z.array(z.string().min(1)).optional(),
  reveals: z.array(z.string().min(1)).min(1),
});

export const scriptEndingSchema = z.object({
  title: z.string().min(1),
  narration: z.string().min(1),
  score: z.number().int(),
});

export const scriptDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  worldPrompt: worldPromptSchema,
  cast: z.array(scriptCharacterSchema).min(5),
  clues: z.array(scriptClueSchema).min(3),
  endings: z.object({
    correct_accusation: scriptEndingSchema.extend({
      score: z.literal(100),
    }),
    wrong_accusation: scriptEndingSchema.extend({
      score: z.literal(0),
    }),
    secret_defended_bonus: scriptEndingSchema.extend({
      score: z.literal(25),
    }),
  }),
});

export type WorldPromptDefinition = z.infer<typeof worldPromptSchema>;
export type ScriptCharacter = z.infer<typeof scriptCharacterSchema>;
export type ScriptClue = z.infer<typeof scriptClueSchema>;
export type ScriptEnding = z.infer<typeof scriptEndingSchema>;
export type ScriptDefinition = z.infer<typeof scriptDefinitionSchema>;
