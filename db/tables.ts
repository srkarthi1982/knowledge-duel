import { column, defineTable, NOW } from "astro:db";

/**
 * Question bank used for duels.
 * Can be global (ownerId = null) or user-owned.
 */
export const TriviaQuestions = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // If set, question belongs to a specific user; otherwise can be global.
    ownerId: column.text({ optional: true }),

    category: column.text({ optional: true }),   // e.g. "Science", "History"
    subcategory: column.text({ optional: true }), // optional finer group
    difficulty: column.text({
      enum: ["easy", "medium", "hard"],
      default: "easy",
    }),

    question: column.text(),

    // Options for MCQ
    options: column.json({ optional: true }), // e.g. [{id:"A", label:"..."}, ...]

    // Correct answer: "A", ["A","C"], or boolean etc.
    correctAnswer: column.json({ optional: true }),

    explanation: column.text({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * One duel match.
 * Example: "Friday Night Trivia – 4 players"
 */
export const DuelMatches = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // Who created the match
    ownerId: column.text(),

    title: column.text({ optional: true }),

    // Optional game settings
    maxPlayers: column.number({ optional: true }),
    totalRounds: column.number({ optional: true }),
    timePerQuestionSeconds: column.number({ optional: true }),

    // Game state
    status: column.text({
      enum: ["waiting", "in_progress", "completed", "cancelled"],
      default: "waiting",
    }),

    // Public/private
    visibility: column.text({
      enum: ["private", "unlisted", "public"],
      default: "private",
    }),

    // Could store PIN / room code string
    joinCode: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
    startedAt: column.date({ optional: true }),
    endedAt: column.date({ optional: true }),
  },
});

/**
 * Players participating in a match.
 */
export const DuelPlayers = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    matchId: column.number({ references: () => DuelMatches.columns.id }),

    // Link to parent user (optional for guests)
    userId: column.text({ optional: true }),

    // Name/nickname shown in the game UI
    displayName: column.text(),

    // Score for the match
    score: column.number({ default: 0 }),

    joinedAt: column.date({ default: NOW }),
    leftAt: column.date({ optional: true }),

    // For connection / presence information (optional, not enforced)
    meta: column.json({ optional: true }),
  },
});

/**
 * Each question round inside a match.
 */
export const DuelRounds = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    matchId: column.number({ references: () => DuelMatches.columns.id }),
    questionId: column.number({ references: () => TriviaQuestions.columns.id }),

    // Round number in a match: 1, 2, 3, ...
    roundNumber: column.number({ default: 1 }),

    // When the round started/ended
    startedAt: column.date({ optional: true }),
    endedAt: column.date({ optional: true }),

    // For scoring config (points, bonuses, etc.)
    points: column.number({ default: 1 }),
    meta: column.json({ optional: true }),
  },
});

/**
 * Each player's answer in a given round.
 */
export const DuelAnswers = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    roundId: column.number({ references: () => DuelRounds.columns.id }),
    playerId: column.number({ references: () => DuelPlayers.columns.id }),

    // The given answer payload (string, option id, etc.)
    answer: column.json({ optional: true }),

    isCorrect: column.boolean({ default: false }),
    pointsAwarded: column.number({ default: 0 }),

    answeredAt: column.date({ default: NOW }),
  },
});

export const knowledgeDuelTables = {
  TriviaQuestions,
  DuelMatches,
  DuelPlayers,
  DuelRounds,
  DuelAnswers,
} as const;
