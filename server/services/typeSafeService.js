const { logger } = require("../utils/logger");

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";
const TIMEOUT_MS = 6000;

function isTypeSafeConfigured() {
  return Boolean(process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.trim());
}

async function evaluateContactTicket(message, userTier = "FREE") {
  if (!isTypeSafeConfigured() || !message || typeof message !== "string" || message.trim().length < 5) {
    return fallbackContactTriage(message);
  }

  try {
    const payload = {
      state: {
        message: message.trim().slice(0, 1500),
        userTier,
      },
      model: DEFAULT_MODEL,
      questions: {
        is_urgent: {
          type: "noul",
          instructions: "Does this customer support message express an urgent technical malfunction, billing error, double charge, or account blockage that requires immediate intervention?",
          criteria: {
            true: "Critical failure, double charge, money lost, or service completely blocked",
            false: "General feedback, feature request, mild bug, or standard question",
          },
        },
        category: {
          type: "choice",
          instructions: "Which department or category should handle this ticket?",
          criteria: {
            dispute: "Payment failure, double charge, refund request, or invoice error",
            bug: "Website error, broken button, failed roast, or application crash",
            pro: "Pro plan upgrade, features, or subscription benefits inquiry",
            feedback: "Feature requests, ideas, or compliments",
            general: "General questions or comments",
          },
        },
        frustration: {
          type: "score",
          instructions: "How frustrated or distressed is this user?",
          criteria: [
            "Calm, friendly, or polite",
            "Mildly annoyed, confused, or standard inquiry",
            "Visibly upset, urgent, or distressed",
          ],
        },
      },
    };

    const res = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn("TypeSafe", `HTTP error ${res.status}: ${errText.slice(0, 150)}`);
      return fallbackContactTriage(message);
    }

    const data = await res.json();
    const answers = data.answers || {};

    const urgencyNoul = typeof answers.is_urgent?.noul === "number" ? answers.is_urgent.noul : 0;
    const categoryChoice = answers.category?.choice || "general";
    const frustrationScore = typeof answers.frustration?.score === "number" ? answers.frustration.score : 0;

    return {
      aiEvaluated: true,
      isUrgent: urgencyNoul >= 0.7 || frustrationScore >= 1.7,
      urgencyScore: urgencyNoul,
      suggestedCategory: categoryChoice,
      frustrationLevel: frustrationScore,
      model: data.model,
    };
  } catch (err) {
    logger.warn("TypeSafe", `Evaluation failed or timed out: ${err.message}`);
    return fallbackContactTriage(message);
  }
}

function fallbackContactTriage(message = "") {
  const text = (message || "").toLowerCase();
  const urgentKeywords = ["charged twice", "double charge", "refund", "stole", "unauthorized", "money", "crash", "locked out", "urgent"];
  const isUrgent = urgentKeywords.some((k) => text.includes(k));

  let suggestedCategory = "general";
  if (text.includes("pay") || text.includes("charge") || text.includes("bill") || text.includes("refund")) {
    suggestedCategory = "dispute";
  } else if (text.includes("bug") || text.includes("broken") || text.includes("error") || text.includes("failed") || text.includes("crash")) {
    suggestedCategory = "bug";
  } else if (text.includes("pro") || text.includes("upgrade")) {
    suggestedCategory = "pro";
  }

  return {
    aiEvaluated: false,
    isUrgent,
    urgencyScore: isUrgent ? 0.8 : 0.2,
    suggestedCategory,
    frustrationLevel: isUrgent ? 1.5 : 0.5,
  };
}

async function evaluateCommitHygiene(commitMessages = []) {
  if (!isTypeSafeConfigured() || !Array.isArray(commitMessages) || commitMessages.length === 0) {
    return fallbackCommitHygiene(commitMessages);
  }

  try {
    const sample = commitMessages.slice(0, 15);
    const payload = {
      state: {
        recentCommits: sample,
      },
      model: DEFAULT_MODEL,
      questions: {
        hygieneScore: {
          type: "score",
          instructions: "Rate the discipline, clarity, and informative value of these git commit messages.",
          criteria: [
            "Chaotic or lazy: single-word, 'wip', 'asdf', 'fix bug', 'oops' with no context",
            "Bare minimum: short and generic messages like 'update', 'css fixes'",
            "Good: descriptive commits explaining what was changed and why",
            "Exemplary: conventional commits with scope, clear rationale, or issue references",
          ],
        },
      },
    };

    const res = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return fallbackCommitHygiene(commitMessages);
    }

    const data = await res.json();
    const rawScore = data.answers?.hygieneScore?.score;
    const scoreVal = typeof rawScore === "number" ? rawScore : 1;
    const qualityPercentage = Math.round(Math.min(100, Math.max(10, ((scoreVal + 1) / 4) * 100)));

    return {
      aiEvaluated: true,
      score: scoreVal + 1,
      qualityPercentage,
    };
  } catch (err) {
    logger.warn("TypeSafe", `Commit hygiene evaluation fallback: ${err.message}`);
    return fallbackCommitHygiene(commitMessages);
  }
}

function fallbackCommitHygiene(commitMessages = []) {
  const lazyKeywords = ["fix", "wip", "update", "asdasd", "pls work", "test", "oops", "clean", "done", "minor", "temp"];
  let lazyCount = 0;
  commitMessages.forEach((msg) => {
    const lower = (msg || "").toLowerCase();
    if (lazyKeywords.some((k) => lower === k || lower.startsWith(`${k} `) || lower.endsWith(` ${k}`))) {
      lazyCount++;
    }
  });

  const quality = commitMessages.length > 0
    ? Math.max(10, Math.round(100 - (lazyCount / commitMessages.length) * 80))
    : 30;

  return {
    aiEvaluated: false,
    score: Math.max(1, Math.min(4, Math.round((quality / 100) * 4))),
    qualityPercentage: quality,
  };
}

module.exports = {
  isTypeSafeConfigured,
  evaluateContactTicket,
  evaluateCommitHygiene,
};
