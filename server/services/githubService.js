const BASE_URL = "https://api.github.com";

function getHeaders(userToken = null) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitRoast-App",
  };

  const token = userToken || process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  return headers;
}

async function githubFetch(endpoint, userToken = null) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: getHeaders(userToken),
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 403) {
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining === "0") {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
  }

  if (res.status === 404) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!res.ok) {
    throw new Error(`GITHUB_API_ERROR_${res.status}`);
  }

  return res.json();
}

async function fetchProfile(username, userToken) {
  return githubFetch(`/users/${encodeURIComponent(username)}`, userToken);
}

async function fetchRepos(username, userToken = null, isOwnProfileAndPro = false) {
  const endpoint = isOwnProfileAndPro
    ? `/user/repos?sort=pushed&per_page=100&visibility=all`
    : `/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&type=public`;
  return githubFetch(endpoint, userToken);
}

async function fetchRecentCommits(username, repos, userToken) {
  const ownRepos = repos.filter((r) => !r.fork);

  if (ownRepos.length === 0) return [];

  const mostActive = ownRepos[0];

  try {
    const commits = await githubFetch(
      `/repos/${encodeURIComponent(username)}/${encodeURIComponent(mostActive.name)}/commits?per_page=15`,
      userToken,
    );
    return commits
      .map((c) => c.commit?.message?.split("\n")[0]?.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function checkReadmeQuality(username, repos, userToken) {
  const sorted = [...repos].sort(
    (a, b) => b.stargazers_count - a.stargazers_count,
  );
  const topRepo = sorted[0];

  if (!topRepo) return { exists: false, length: 0 };

  try {
    const readme = await githubFetch(
      `/repos/${encodeURIComponent(username)}/${encodeURIComponent(topRepo.name)}/readme`,
      userToken,
    );
    const content = Buffer.from(readme.content, "base64").toString("utf-8");
    return {
      exists: true,
      length: content.length,
      isEmpty: content.length < 200,
      repoName: topRepo.name,
    };
  } catch {
    return { exists: false, length: 0, isEmpty: true, repoName: topRepo?.name };
  }
}

function analyzeRepos(repos) {
  const ownRepos = repos.filter((r) => !r.fork);
  const totalOwn = ownRepos.length;

  const abandoned = ownRepos.filter((r) => {
    const created = new Date(r.created_at);
    const pushed = new Date(r.pushed_at);
    const daysDiff = (pushed - created) / (1000 * 60 * 60 * 24);
    return daysDiff < 1;
  });

  const languageMap = {};
  ownRepos.forEach((r) => {
    if (r.language) {
      languageMap[r.language] = (languageMap[r.language] || 0) + 1;
    }
  });

  const languages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  const noDescription = ownRepos.filter((r) => !r.description).length;

  const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

  return {
    totalOwn,
    totalForks: repos.length - totalOwn,
    abandonedCount: abandoned.length,
    abandonedPct:
      totalOwn > 0 ? Math.round((abandoned.length / totalOwn) * 100) : 0,
    languages,
    topLanguage: languages[0] || "Nothing",
    noDescription,
    totalStars,
  };
}

function analyzeCommits(commits) {
  if (commits.length === 0) {
    return {
      total: 0,
      shameList: [],
      qualityScore: 0,
    };
  }

  const shamePatterns = [
    /fix/i,
    /fixed/i,
    /wip/i,
    /test/i,
    /asdf/i,
    /aaa+/i,
    /lol/i,
    /idk/i,
    /pls/i,
    /please/i,
    /final/i,
    /last/i,
    /real/i,
    /ok$/i,
    /done/i,
    /stuff/i,
    /things/i,
    /update/i,
    /changes/i,
    /commit/i,
    /work/i,
    /trying/i,
    /help/i,
  ];

  const shameCommits = commits.filter((msg) =>
    shamePatterns.some((p) => p.test(msg)),
  );

  const qualityScore = Math.round(
    ((commits.length - shameCommits.length) / commits.length) * 100,
  );

  return {
    total: commits.length,
    shameList: shameCommits.slice(0, 5),
    qualityScore,
  };
}

function getJoinYear(profile) {
  return new Date(profile.created_at).getFullYear();
}

function calculateRoastScore(repoAnalysis, commitAnalysis, readme) {
  if (repoAnalysis.totalOwn === 0) {
    return 15;
  }

  let score = 100;

  score -= Math.min(35, Math.round(repoAnalysis.abandonedPct * 0.35));

  const commitPenalty = 100 - commitAnalysis.qualityScore;
  score -= Math.round(commitPenalty * 0.3);

  if (!readme.exists) score -= 20;
  else if (readme.isEmpty) score -= 12;

  const descPenalty =
    repoAnalysis.totalOwn > 0
      ? repoAnalysis.noDescription / repoAnalysis.totalOwn
      : 0;
  score -= Math.round(descPenalty * 15);

  return Math.max(1, Math.min(99, score));
}

function getGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  if (score >= 25) return "F";
  return "F-";
}

function generateBioContrast(profile, repoAnalysis, commitAnalysis) {
  const bio = (profile.bio || "").trim();
  const lowerBio = bio.toLowerCase();

  let claimed = bio;
  let reality = "";
  let verdict = "";

  if (!bio) {
    claimed = "Stealth Mode Stealth Engineer";
    reality = `Zero bio provided. Profile holds ${repoAnalysis.totalOwn} repositories with ${repoAnalysis.totalStars} total stars.`;
    verdict = "LinkedIn: Visionary Builder | GitHub: Zero trace of code evidence";
  } else if (lowerBio.includes("full stack") || lowerBio.includes("fullstack")) {
    claimed = "Full-Stack Software Wizard";
    reality = `${repoAnalysis.topLanguage} heavy (${repoAnalysis.totalOwn} repos), with ${repoAnalysis.abandonedPct}% project abandonment rate.`;
    verdict = "Resume: End-to-end full stack developer | GitHub: Mostly frontend CSS debugging and forgotten repos";
  } else if (lowerBio.includes("senior") || lowerBio.includes("lead") || lowerBio.includes("architect")) {
    claimed = bio.length > 50 ? bio.slice(0, 47) + "..." : bio;
    const worstCommit = commitAnalysis.shameList[0] || "fix";
    reality = `Code hygiene rated at ${commitAnalysis.qualityScore}%. Top architectural commit: "${worstCommit}".`;
    verdict = "LinkedIn: Principal System Architect | GitHub: Pushing untested hotfixes straight to master";
  } else if (lowerBio.includes("ai") || lowerBio.includes("ml") || lowerBio.includes("machine learning") || lowerBio.includes("data")) {
    claimed = "AI / ML Pioneer";
    reality = "Imports numpy and scikit-learn once, followed by 12 commits of 'adjust hyperparameters pls'.";
    verdict = "Resume: Deep Learning Researcher | GitHub: Wrapper around OpenAI API keys";
  } else if (lowerBio.includes("open source") || lowerBio.includes("contributor") || lowerBio.includes("oss")) {
    claimed = "Open Source Evangelist";
    reality = `${repoAnalysis.totalForks} forks collected, but only ${repoAnalysis.totalStars} stars earned in return.`;
    verdict = "Resume: Active Open Source Core Contributor | GitHub: Typo fixes in README files";
  } else if (lowerBio.includes("student") || lowerBio.includes("learner") || lowerBio.includes("enthusiast")) {
    claimed = bio.length > 50 ? bio.slice(0, 47) + "..." : bio;
    reality = `${repoAnalysis.abandonedCount} tutorial repositories abandoned the moment the YouTube video ended.`;
    verdict = "Resume: Passionate Lifelong Learner | GitHub: Cemetery of incomplete clone tutorials";
  } else {
    claimed = bio.length > 50 ? bio.slice(0, 47) + "..." : bio;
    if (repoAnalysis.abandonedPct > 50) {
      reality = `${repoAnalysis.abandonedPct}% of projects abandoned within 24 hours of repo creation.`;
      verdict = "Resume: Results-Oriented Delivery Machine | GitHub: Repository Graveyard Caretaker";
    } else if (commitAnalysis.qualityScore < 45) {
      const worst = commitAnalysis.shameList[0] || "wip";
      reality = `Commit quality is ${commitAnalysis.qualityScore}%. Documented commit history includes "${worst}".`;
      verdict = "Resume: Clean Code & Best Practices | GitHub: 'git push --force' into production";
    } else {
      reality = `${repoAnalysis.totalStars} stars across ${repoAnalysis.totalOwn} repositories with ${repoAnalysis.topLanguage} stack.`;
      verdict = "Resume: Industry Impact Leader | GitHub: Well-hidden behind private organization repos";
    }
  }

  return {
    bio: bio || "No bio provided.",
    claimed,
    reality,
    verdict,
  };
}

async function analyzeProfile(
  username,
  userToken = null,
  authUsername = null,
  isPro = false,
) {
  const isOwnProfileAndPro = Boolean(
    isPro &&
      authUsername &&
      username.toLowerCase() === authUsername.toLowerCase(),
  );

  const [profile, repos] = await Promise.all([
    fetchProfile(username, userToken),
    fetchRepos(username, userToken, isOwnProfileAndPro),
  ]);

  if (profile.type === "Organization") {
    const orgErr = new Error("ORGANIZATION_NOT_SUPPORTED");
    orgErr.code = "ORGANIZATION_NOT_SUPPORTED";
    throw orgErr;
  }

  const [commits, readme] = await Promise.all([
    fetchRecentCommits(username, repos, userToken),
    checkReadmeQuality(username, repos, userToken),
  ]);

  const repoAnalysis = analyzeRepos(repos);
  const commitAnalysis = analyzeCommits(commits);
  const score = calculateRoastScore(repoAnalysis, commitAnalysis, readme);
  const grade = getGrade(score);
  const isGhost = repoAnalysis.totalOwn === 0;

  const stats = [
    {
      label: "Commit Quality",
      value: isGhost ? "0%" : `${commitAnalysis.qualityScore}%`,
      bad: isGhost || commitAnalysis.qualityScore < 50,
      note: isGhost
        ? "No commits recorded"
        : commitAnalysis.qualityScore < 30
          ? "Below panic threshold"
          : commitAnalysis.qualityScore < 60
            ? "Room for improvement"
            : "Not bad actually",
    },
    {
      label: "README Score",
      value: isGhost ? "0%" : readme.exists ? (readme.isEmpty ? "8%" : "72%") : "0%",
      bad: isGhost || !readme.exists || readme.isEmpty,
      note: isGhost
        ? "No repos to document"
        : !readme.exists
          ? "Does not exist"
          : readme.isEmpty
            ? "Technically exists"
            : "Actually has content",
    },
    {
      label: "Repo Survival",
      value: isGhost ? "0%" : `${100 - repoAnalysis.abandonedPct}%`,
      bad: isGhost || repoAnalysis.abandonedPct > 50,
      note: isGhost
        ? "0 public repos created"
        : `${repoAnalysis.abandonedCount} of ${repoAnalysis.totalOwn} abandoned`,
    },
    {
      label: "Shame Index",
      value: isGhost ? "100%" : `${100 - commitAnalysis.qualityScore}%`,
      bad: true,
      note: isGhost
        ? "Ghost account detected"
        : repoAnalysis.topLanguage !== "Nothing"
          ? `${repoAnalysis.topLanguage} still in prod`
          : "No code found",
    },
  ];

  const bioContrast = generateBioContrast(profile, repoAnalysis, commitAnalysis);

  return {
    username,
    score,
    grade,
    joinYear: getJoinYear(profile),
    totalRepos: profile.public_repos,
    followers: profile.followers,
    following: profile.following,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    location: profile.location,
    shameCommits: commitAnalysis.shameList,
    stats,
    repoAnalysis,
    commitAnalysis,
    readme,
    bioContrast,
    _raw: {
      topLanguage: repoAnalysis.topLanguage,
      languages: repoAnalysis.languages,
      abandonedCount: repoAnalysis.abandonedCount,
      totalOwn: repoAnalysis.totalOwn,
      commitQuality: commitAnalysis.qualityScore,
      hasReadme: readme.exists,
      totalStars: repoAnalysis.totalStars,
    },
  };
}

async function analyzeWrapped(
  username,
  year = 2025,
  userToken = null,
  authUsername = null,
  isPro = false,
) {
  const targetYear = parseInt(year, 10) || 2025;
  const isOwnProfileAndPro = Boolean(
    isPro &&
      authUsername &&
      username.toLowerCase() === authUsername.toLowerCase(),
  );

  const [profile, repos] = await Promise.all([
    fetchProfile(username, userToken),
    fetchRepos(username, userToken, isOwnProfileAndPro),
  ]);

  const ownRepos = (repos || []).filter((r) => !r.fork);
  const reposCreatedInYear = ownRepos.filter((r) => {
    return new Date(r.created_at).getFullYear() === targetYear;
  });
  const reposPushedInYear = ownRepos.filter((r) => {
    return new Date(r.pushed_at).getFullYear() === targetYear;
  });

  let mostAbandonedRepo = null;
  if (reposCreatedInYear.length > 0) {
    const sorted = [...reposCreatedInYear].sort((a, b) => {
      const lifeA = new Date(a.pushed_at) - new Date(a.created_at);
      const lifeB = new Date(b.pushed_at) - new Date(b.created_at);
      return lifeA - lifeB;
    });
    const candidate = sorted[0];
    const daysAlive = Math.max(
      0,
      Math.round(
        (new Date(candidate.pushed_at) - new Date(candidate.created_at)) /
          (1000 * 60 * 60 * 24),
      ),
    );
    mostAbandonedRepo = {
      name: candidate.name,
      description:
        candidate.description || "No description provided (abandoned in stealth)",
      daysAlive,
      language: candidate.language || "Unknown",
      stars: candidate.stargazers_count || 0,
      note:
        daysAlive === 0
          ? "Abandoned on day 1"
          : `Abandoned after ${daysAlive} day${daysAlive === 1 ? "" : "s"}`,
    };
  } else if (ownRepos.length > 0) {
    const oldestPushed = [...ownRepos].sort(
      (a, b) => new Date(a.pushed_at) - new Date(b.pushed_at),
    )[0];
    mostAbandonedRepo = {
      name: oldestPushed.name,
      description:
        oldestPushed.description || `Zero new repos created in ${targetYear}`,
      daysAlive: 0,
      language: oldestPushed.language || "None",
      stars: oldestPushed.stargazers_count || 0,
      note: `No new projects launched in ${targetYear}`,
    };
  } else {
    mostAbandonedRepo = {
      name: "none",
      description: `Didn't even start a repo in ${targetYear}`,
      daysAlive: 0,
      language: "None",
      stars: 0,
      note: "Zero repo ambition detected",
    };
  }

  const commitDates = [];
  const commitMessages = [];
  const reposToInspect = reposPushedInYear.slice(0, 4);

  const commitPromises = reposToInspect.map(async (repo) => {
    try {
      const endpoint = `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/commits?author=${encodeURIComponent(username)}&since=${targetYear}-01-01T00:00:00Z&until=${targetYear}-12-31T23:59:59Z&per_page=100`;
      const res = await githubFetch(endpoint, userToken);
      if (Array.isArray(res)) {
        return res
          .map((c) => ({
            date: c.commit?.author?.date || c.commit?.committer?.date,
            message: c.commit?.message?.split("\n")[0]?.trim(),
          }))
          .filter((c) => c.date);
      }
    } catch {
      return [];
    }
    return [];
  });

  const commitResults = await Promise.all(commitPromises);
  commitResults.flat().forEach((c) => {
    commitDates.push(c.date);
    if (c.message) commitMessages.push(c.message);
  });

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthlyCounts = Array(12).fill(0);

  commitDates.forEach((d) => {
    const dt = new Date(d);
    if (dt.getFullYear() === targetYear) {
      monthlyCounts[dt.getMonth()]++;
    }
  });

  const totalCommits = commitDates.length;

  let minMonthIdx = 0;
  for (let i = 1; i < 12; i++) {
    if (monthlyCounts[i] < monthlyCounts[minMonthIdx]) minMonthIdx = i;
  }

  const worstMonthName = monthNames[minMonthIdx];
  const worstMonthCount = monthlyCounts[minMonthIdx];
  const worstMonth = {
    month: worstMonthName,
    commits: worstMonthCount,
    comment:
      worstMonthCount === 0
        ? `0 commits — touched grass or went into hibernation`
        : `${worstMonthCount} commit${worstMonthCount === 1 ? "" : "s"} — minimal vital signs detected`,
  };

  const uniqueDays = Array.from(
    new Set(
      commitDates
        .map((d) => new Date(d).toISOString().slice(0, 10))
        .filter((d) => d.startsWith(`${targetYear}`))
    )
  ).sort();

  let bestStreak = 0;
  let currentStreak = 0;
  let bestStreakEnd = null;

  if (uniqueDays.length > 0) {
    currentStreak = 1;
    bestStreak = 1;
    bestStreakEnd = uniqueDays[0];

    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = new Date(uniqueDays[i - 1]);
      const curr = new Date(uniqueDays[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
          bestStreakEnd = uniqueDays[i];
        }
      } else {
        currentStreak = 1;
      }
    }
  }

  const streakDiedOn = bestStreakEnd
    ? new Date(bestStreakEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : `Never started in ${targetYear}`;

  let nightCommits = 0;
  let weekendCommits = 0;
  commitDates.forEach((d) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const hour = dt.getHours();
    if (day === 0 || day === 6) weekendCommits++;
    if (hour >= 23 || hour < 5) nightCommits++;
  });

  const commitAnalysis = analyzeCommits(commitMessages);
  const repoAnalysis = analyzeRepos(repos || []);

  let archetype = "";
  let archetypeEmoji = "⚡";
  let archetypeDesc = "";

  if (totalCommits === 0 && reposCreatedInYear.length === 0) {
    archetype = "The Ghost";
    archetypeEmoji = "👻";
    archetypeDesc =
      "Registered on GitHub, vanished without a trace. Commits: purely theoretical.";
  } else if (reposCreatedInYear.length >= 4 && mostAbandonedRepo?.daysAlive <= 3) {
    archetype = "The Chronic Starter";
    archetypeEmoji = "🚀";
    archetypeDesc = `Started ${reposCreatedInYear.length} projects in ${targetYear}. Finished approximately zero. A true visionary of abandoned ideas.`;
  } else if (nightCommits > 0 && nightCommits / Math.max(1, totalCommits) > 0.4) {
    archetype = "The Midnight Patcher";
    archetypeEmoji = "🌙";
    archetypeDesc =
      "Only codes when reasonable humans sleep. Powered by caffeine, dark mode, and commit regret.";
  } else if (weekendCommits > 0 && weekendCommits / Math.max(1, totalCommits) > 0.45) {
    archetype = "The Weekend Warrior";
    archetypeEmoji = "🏖️";
    archetypeDesc =
      "Zero work-life balance detected. Pushes code on Sundays at 2am because relaxation is terrifying.";
  } else if (commitAnalysis.qualityScore < 35 && commitMessages.length >= 3) {
    archetype = "The Single-Word Committer";
    archetypeEmoji = "📝";
    archetypeDesc =
      "'fix', 'test', 'wip', 'done', 'asdf'. The poetry of an unbothered developer.";
  } else if (ownRepos.length >= 20 && profile.public_repos > 30) {
    archetype = "The Digital Hoarder";
    archetypeEmoji = "📦";
    archetypeDesc =
      "Forked half of GitHub, starred everything, finished nothing. Storing repos for the apocalypse.";
  } else if (bestStreak >= 10) {
    archetype = "The Suspiciously Diligent";
    archetypeEmoji = "🟢";
    archetypeDesc = `A streak of ${bestStreak} consecutive days. Either deeply dedicated or running a cron job to keep the squares green.`;
  } else {
    archetype = "The Pragmatic Procrastinator";
    archetypeEmoji = "🎯";
    archetypeDesc =
      "Commits strictly when deadlines loom or guilt becomes physically unbearable.";
  }

  const annualScore = Math.max(
    10,
    Math.min(
      99,
      calculateRoastScore(repoAnalysis, commitAnalysis, {
        exists: true,
        isEmpty: false,
      }),
    ),
  );
  const annualGrade = getGrade(annualScore);

  const annualRoast = `In ${targetYear}, @${username} logged ${totalCommits} commits, survived a best streak of ${bestStreak} day${bestStreak === 1 ? "" : "s"} before completely giving up on ${streakDiedOn}, and crowned "${mostAbandonedRepo.name}" as their most abandoned project. Verdict: ${archetype}.`;

  return {
    year: targetYear,
    username,
    avatarUrl: profile.avatar_url,
    totalCommits,
    worstMonth,
    bestStreak,
    streakDiedOn,
    mostAbandonedRepo,
    archetype,
    archetypeEmoji,
    archetypeDesc,
    annualScore,
    annualGrade,
    monthlyCommits: monthNames.map((name, i) => ({
      month: name,
      count: monthlyCounts[i],
    })),
    annualRoast,
  };
}

module.exports = { analyzeProfile, analyzeWrapped };
