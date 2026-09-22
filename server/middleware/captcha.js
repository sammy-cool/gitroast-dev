const { logger } = require("../utils/logger");

async function verifyCaptcha(req, res, next) {
  if (req.user) {
    return next();
  }

  const projectId = process.env.RECAPTCHA_PROJECT_ID;
  const apiKey = process.env.RECAPTCHA_API_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const siteKey = process.env.RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!projectId && !secretKey && !apiKey) {
    return next();
  }

  const token = req.headers["x-captcha-token"];

  if (!token) {
    return res.status(403).json({
      error: "CAPTCHA_REQUIRED",
      message: "Human verification required. Please try again or log in with GitHub.",
    });
  }

  try {
    let isValid = false;
    let score = 1.0;
    let errorDetails = null;

    if (projectId) {
      const keyParam = apiKey || secretKey;
      const enterpriseUrl = keyParam
        ? `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(keyParam)}`
        : `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments`;

      const requestBody = {
        event: {
          token,
          siteKey: siteKey || undefined,
        },
      };

      const googleRes = await fetch(enterpriseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000),
      });

      const data = await googleRes.json();

      if (data.tokenProperties) {
        isValid = data.tokenProperties.valid === true;
        score = data.riskAnalysis?.score ?? 1.0;
        errorDetails = data.tokenProperties.invalidReason;
      } else {
        logger.warn("Captcha", "reCAPTCHA Enterprise assessment returned unexpected response", { data });
        isValid = false;
        errorDetails = data.error?.message || "ASSESSMENT_ERROR";
      }
    } else {
      const googleRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await googleRes.json();
      isValid = data.success === true;
      score = data.score !== undefined ? data.score : 1.0;
      errorDetails = data["error-codes"];
    }

    if (!isValid || score < 0.5) {
      logger.warn("Captcha", "Verification failed or bot score too low", {
        isValid,
        score,
        details: errorDetails,
      });
      return res.status(403).json({
        error: "CAPTCHA_FAILED",
        message: "Bot verification failed. Please log in with GitHub to roast without restrictions.",
      });
    }

    return next();
  } catch (err) {
    logger.error("Captcha", "Google verification network error (failing open)", {
      message: err.message,
    });
    return next();
  }
}

module.exports = { verifyCaptcha };
