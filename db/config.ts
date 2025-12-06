import { defineDb } from "astro:db";
import {
  TriviaQuestions,
  DuelMatches,
  DuelPlayers,
  DuelRounds,
  DuelAnswers,
} from "./tables";

export default defineDb({
  tables: {
    TriviaQuestions,
    DuelMatches,
    DuelPlayers,
    DuelRounds,
    DuelAnswers,
  },
});
