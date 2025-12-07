import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  eq,
  and,
  TriviaQuestions,
  DuelMatches,
  DuelPlayers,
  DuelRounds,
  DuelAnswers,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createQuestion: defineAction({
    input: z.object({
      category: z.string().optional(),
      subcategory: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      question: z.string().min(1, "Question is required"),
      options: z.any().optional(),
      correctAnswer: z.any().optional(),
      explanation: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [question] = await db
        .insert(TriviaQuestions)
        .values({
          ownerId: user.id,
          category: input.category,
          subcategory: input.subcategory,
          difficulty: input.difficulty ?? "easy",
          question: input.question,
          options: input.options,
          correctAnswer: input.correctAnswer,
          explanation: input.explanation,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { question };
    },
  }),

  updateQuestion: defineAction({
    input: z.object({
      id: z.number().int(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      question: z.string().min(1).optional(),
      options: z.any().optional(),
      correctAnswer: z.any().optional(),
      explanation: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(TriviaQuestions)
        .where(and(eq(TriviaQuestions.id, id), eq(TriviaQuestions.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { question: existing };
      }

      const [question] = await db
        .update(TriviaQuestions)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(TriviaQuestions.id, id), eq(TriviaQuestions.ownerId, user.id)))
        .returning();

      return { question };
    },
  }),

  listMyQuestions: defineAction({
    input: z
      .object({
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const includeInactive = input?.includeInactive ?? false;

      const questions = await db
        .select()
        .from(TriviaQuestions)
        .where(eq(TriviaQuestions.ownerId, user.id));

      const filtered = includeInactive
        ? questions
        : questions.filter((q) => q.isActive);

      return { questions: filtered };
    },
  }),

  createMatch: defineAction({
    input: z.object({
      title: z.string().optional(),
      maxPlayers: z.number().int().positive().optional(),
      totalRounds: z.number().int().positive().optional(),
      timePerQuestionSeconds: z.number().int().positive().optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
      joinCode: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [match] = await db
        .insert(DuelMatches)
        .values({
          ownerId: user.id,
          title: input.title,
          maxPlayers: input.maxPlayers,
          totalRounds: input.totalRounds,
          timePerQuestionSeconds: input.timePerQuestionSeconds,
          visibility: input.visibility ?? "private",
          joinCode: input.joinCode,
          status: "waiting",
          createdAt: new Date(),
        })
        .returning();

      return { match };
    },
  }),

  updateMatch: defineAction({
    input: z.object({
      id: z.number().int(),
      title: z.string().optional(),
      maxPlayers: z.number().int().positive().optional(),
      totalRounds: z.number().int().positive().optional(),
      timePerQuestionSeconds: z.number().int().positive().optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
      joinCode: z.string().optional(),
      status: z.enum(["waiting", "in_progress", "completed", "cancelled"]).optional(),
      startedAt: z.coerce.date().optional(),
      endedAt: z.coerce.date().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(DuelMatches)
        .where(and(eq(DuelMatches.id, id), eq(DuelMatches.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Match not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { match: existing };
      }

      const [match] = await db
        .update(DuelMatches)
        .set(updateData)
        .where(and(eq(DuelMatches.id, id), eq(DuelMatches.ownerId, user.id)))
        .returning();

      return { match };
    },
  }),

  joinMatch: defineAction({
    input: z.object({
      matchId: z.number().int(),
      displayName: z.string().min(1, "Display name is required"),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [match] = await db
        .select()
        .from(DuelMatches)
        .where(eq(DuelMatches.id, input.matchId))
        .limit(1);

      if (!match || match.status === "cancelled" || match.status === "completed") {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Match not available.",
        });
      }

      const [player] = await db
        .insert(DuelPlayers)
        .values({
          matchId: input.matchId,
          userId: user.id,
          displayName: input.displayName,
          joinedAt: new Date(),
        })
        .returning();

      return { player };
    },
  }),

  addRound: defineAction({
    input: z.object({
      matchId: z.number().int(),
      questionId: z.number().int(),
      roundNumber: z.number().int().positive().optional(),
      points: z.number().int().positive().optional(),
      meta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [match] = await db
        .select()
        .from(DuelMatches)
        .where(and(eq(DuelMatches.id, input.matchId), eq(DuelMatches.ownerId, user.id)))
        .limit(1);

      if (!match) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Match not found.",
        });
      }

      const [question] = await db
        .select()
        .from(TriviaQuestions)
        .where(eq(TriviaQuestions.id, input.questionId))
        .limit(1);

      if (!question || !question.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not available.",
        });
      }

      const [round] = await db
        .insert(DuelRounds)
        .values({
          matchId: input.matchId,
          questionId: input.questionId,
          roundNumber: input.roundNumber ?? 1,
          points: input.points ?? 1,
          meta: input.meta,
          startedAt: new Date(),
        })
        .returning();

      return { round };
    },
  }),

  submitAnswer: defineAction({
    input: z.object({
      roundId: z.number().int(),
      playerId: z.number().int(),
      answer: z.any().optional(),
      isCorrect: z.boolean().optional(),
      pointsAwarded: z.number().int().nonnegative().optional(),
    }),
    handler: async (input) => {
      const [round] = await db
        .select()
        .from(DuelRounds)
        .where(eq(DuelRounds.id, input.roundId))
        .limit(1);

      if (!round) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Round not found.",
        });
      }

      const [player] = await db
        .select()
        .from(DuelPlayers)
        .where(eq(DuelPlayers.id, input.playerId))
        .limit(1);

      if (!player || player.matchId !== round.matchId) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Player not found in this match.",
        });
      }

      const [answer] = await db
        .insert(DuelAnswers)
        .values({
          roundId: input.roundId,
          playerId: input.playerId,
          answer: input.answer,
          isCorrect: input.isCorrect ?? false,
          pointsAwarded: input.pointsAwarded ?? 0,
          answeredAt: new Date(),
        })
        .returning();

      return { answer };
    },
  }),
};
