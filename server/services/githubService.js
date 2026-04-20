const BASE_URL = 'https://api.github.com'

function getHeaders(userToken = null) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitRoast-App',
    }

    const token = userToken || process.env.GITHUB_TOKEN
    if (token) {
        headers['Authorization'] = `token ${token}`
    }

    return headers
}

async function githubFetch(endpoint, userToken = null) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: getHeaders(userToken),
    })

    if (res.status === 403) {
        const remaining = res.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
            throw new Error('RATE_LIMIT_EXCEEDED')
        }
    }

    if (res.status === 404) {
        throw new Error('USER_NOT_FOUND')
    }

    if (!res.ok) {
        throw new Error(`GITHUB_API_ERROR_${res.status}`)
    }

    return res.json()
}

async function fetchProfile(username, userToken) {
    return githubFetch(`/users/${username}`, userToken)
}

async function fetchRepos(username, userToken) {
    const endpoint = userToken
        ? `/user/repos?sort=pushed&per_page=100&visibility=all`
        : `/users/${username}/repos?sort=pushed&per_page=100&type=public`
    return githubFetch(endpoint, userToken)
}

async function fetchRecentCommits(username, repos, userToken) {
    const ownRepos = repos.filter(r => !r.fork)

    if (ownRepos.length === 0) return []

    const mostActive = ownRepos[0]

    try {
        const commits = await githubFetch(
            `/repos/${username}/${mostActive.name}/commits?per_page=15`, userToken
        )
        return commits
            .map(c => c.commit?.message?.split('\n')[0]?.trim())
            .filter(Boolean)
    } catch {
        return []
    }
}

async function checkReadmeQuality(username, repos, userToken) {
    const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count)
    const topRepo = sorted[0]

    if (!topRepo) return { exists: false, length: 0 }

    try {
        const readme = await githubFetch(
            `/repos/${username}/${topRepo.name}/readme`, userToken
        )
        const content = Buffer.from(readme.content, 'base64').toString('utf-8')
        return {
            exists: true,
            length: content.length,
            isEmpty: content.length < 200,
            repoName: topRepo.name,
        }
    } catch {
        return { exists: false, length: 0, isEmpty: true, repoName: topRepo?.name }
    }
}

function analyzeRepos(repos) {
    const ownRepos = repos.filter(r => !r.fork)
    const totalOwn = ownRepos.length

    const abandoned = ownRepos.filter(r => {
        const created = new Date(r.created_at)
        const pushed = new Date(r.pushed_at)
        const daysDiff = (pushed - created) / (1000 * 60 * 60 * 24)
        return daysDiff < 1
    })

    const languageMap = {}
    ownRepos.forEach(r => {
        if (r.language) {
            languageMap[r.language] = (languageMap[r.language] || 0) + 1
        }
    })

    const languages = Object.entries(languageMap)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang)

    const noDescription = ownRepos.filter(r => !r.description).length

    const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0)

    return {
        totalOwn,
        totalForks: repos.length - totalOwn,
        abandonedCount: abandoned.length,
        abandonedPct: totalOwn > 0
            ? Math.round((abandoned.length / totalOwn) * 100)
            : 0,
        languages,
        topLanguage: languages[0] || 'Nothing',
        noDescription,
        totalStars,
    }
}

function analyzeCommits(commits) {
    if (commits.length === 0) {
        return {
            total: 0,
            shameList: [],
            qualityScore: 0,
        }
    }

    const shamePatterns = [
        /fix/i, /fixed/i, /wip/i, /test/i, /asdf/i,
        /aaa+/i, /lol/i, /idk/i, /pls/i, /please/i,
        /final/i, /last/i, /real/i, /ok$/i, /done/i,
        /stuff/i, /things/i, /update/i, /changes/i,
        /commit/i, /work/i, /trying/i, /help/i,
    ]

    const shameCommits = commits.filter(msg =>
        shamePatterns.some(p => p.test(msg))
    )

    const qualityScore = Math.round(
        ((commits.length - shameCommits.length) / commits.length) * 100
    )

    return {
        total: commits.length,
        shameList: shameCommits.slice(0, 5),
        qualityScore,
    }
}

function getJoinYear(profile) {
    return new Date(profile.created_at).getFullYear()
}

function calculateRoastScore(repoAnalysis, commitAnalysis, readme) {
    let score = 100

    score -= Math.min(35, Math.round(repoAnalysis.abandonedPct * 0.35))

    const commitPenalty = 100 - commitAnalysis.qualityScore
    score -= Math.round(commitPenalty * 0.30)

    if (!readme.exists) score -= 20
    else if (readme.isEmpty) score -= 12

    const descPenalty = repoAnalysis.totalOwn > 0
        ? (repoAnalysis.noDescription / repoAnalysis.totalOwn)
        : 0
    score -= Math.round(descPenalty * 15)

    return Math.max(1, Math.min(99, score))
}

function getGrade(score) {
    if (score >= 85) return 'A'
    if (score >= 70) return 'B'
    if (score >= 55) return 'C'
    if (score >= 40) return 'D'
    if (score >= 25) return 'F'
    return 'F-'
}

async function analyzeProfile(username, userToken = null) {
    const [profile, repos] = await Promise.all([
        fetchProfile(username, userToken),
        fetchRepos(username, userToken),
    ])

    const [commits, readme] = await Promise.all([
        fetchRecentCommits(username, repos, userToken),
        checkReadmeQuality(username, repos, userToken),
    ])

    const repoAnalysis = analyzeRepos(repos)
    const commitAnalysis = analyzeCommits(commits)
    const score = calculateRoastScore(repoAnalysis, commitAnalysis, readme)
    const grade = getGrade(score)

    const stats = [
        {
            label: 'Commit Quality',
            value: `${commitAnalysis.qualityScore}%`,
            bad: commitAnalysis.qualityScore < 50,
            note: commitAnalysis.qualityScore < 30
                ? 'Below panic threshold'
                : commitAnalysis.qualityScore < 60
                    ? 'Room for improvement'
                    : 'Not bad actually',
        },
        {
            label: 'README Score',
            value: readme.exists
                ? readme.isEmpty ? '8%' : '72%'
                : '0%',
            bad: !readme.exists || readme.isEmpty,
            note: !readme.exists
                ? 'Does not exist'
                : readme.isEmpty
                    ? 'Technically exists'
                    : 'Actually has content',
        },
        {
            label: 'Repo Survival',
            value: `${100 - repoAnalysis.abandonedPct}%`,
            bad: repoAnalysis.abandonedPct > 50,
            note: `${repoAnalysis.abandonedCount} of ${repoAnalysis.totalOwn} abandoned`,
        },
        {
            label: 'Shame Index',
            value: `${100 - commitAnalysis.qualityScore}%`,
            bad: true,
            note: repoAnalysis.topLanguage !== 'Nothing'
                ? `${repoAnalysis.topLanguage} still in prod`
                : 'No code found',
        },
    ]

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
        _raw: {
            topLanguage: repoAnalysis.topLanguage,
            languages: repoAnalysis.languages,
            abandonedCount: repoAnalysis.abandonedCount,
            totalOwn: repoAnalysis.totalOwn,
            commitQuality: commitAnalysis.qualityScore,
            hasReadme: readme.exists,
            totalStars: repoAnalysis.totalStars,
        },
    }
}

module.exports = { analyzeProfile }
