import {
  createToast as pkgCreateToast,
  toastPromise as pkgToastPromise,
  dismiss as pkgDismiss,
  setDefaultColors as pkgSetDefaultColors,
  setDefaultMessages as pkgSetDefaultMessages,
} from "customizable-toast-notification";

export const TOAST_COLORS = {
  success: "#00E676",
  error: "#FF3D3D",
  warning: "#FFB700",
  info: "#FF6B00",
  fire: "#FF4500",
  darkBg: "#141414",
  textLight: "#FFFFFF",
};

const BASE_DEFAULTS = {
  position: "top-center",
  borderRadius: "12px",
  animationDuration: "0.35s",
  animationEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
  backgroundColor: TOAST_COLORS.darkBg,
  textColor: TOAST_COLORS.textLight,
  progressPosition: "bottom",
  progressHeight: "3px",
  pauseOnHover: true,
  showProgressBar: true,
};

export function createToast(options = {}) {
  const type = options.type || "info";
  const progressColor =
    options.progressColor || TOAST_COLORS[type] || TOAST_COLORS.info;

  const merged = {
    ...BASE_DEFAULTS,
    progressColor,
    ...options,
  };

  return pkgCreateToast(merged);
}

export function toastPromise(promiseOrFn, messages = {}, options = {}) {
  const mergedOptions = {
    ...BASE_DEFAULTS,
    progressColor: TOAST_COLORS.info,
    ...options,
  };

  return pkgToastPromise(promiseOrFn, messages, mergedOptions);
}

export const dismiss = pkgDismiss;
export const setDefaultColors = pkgSetDefaultColors;
export const setDefaultMessages = pkgSetDefaultMessages;

export const toast = {
  success(message, extra = {}) {
    return createToast({
      type: "success",
      message,
      progressColor: TOAST_COLORS.success,
      duration: 3200,
      showProgressBar: true,
      ...extra,
    });
  },

  error(message, extra = {}) {
    return createToast({
      type: "error",
      message,
      progressColor: TOAST_COLORS.error,
      showCloseButton: true,
      showProgressBar: true,
      duration: 5500,
      ...extra,
    });
  },

  warning(message, extra = {}) {
    return createToast({
      type: "warning",
      message,
      progressColor: TOAST_COLORS.warning,
      showProgressBar: true,
      showCloseButton: true,
      duration: 4800,
      ...extra,
    });
  },

  info(message, extra = {}) {
    return createToast({
      type: "info",
      message,
      progressColor: TOAST_COLORS.info,
      duration: 4000,
      showCloseButton: true,
      showProgressBar: true,
      ...extra,
    });
  },

  fire(message, extra = {}) {
    return createToast({
      type: "info",
      message,
      progressColor: TOAST_COLORS.fire,
      duration: 4200,
      showCloseButton: true,
      showProgressBar: true,
      ...extra,
    });
  },

  promise(promiseOrFn, messages = {}, options = {}) {
    return toastPromise(promiseOrFn, messages, options);
  },

  proNudge(message, onCtaClick, ctaLabel = "See Plans ⚡") {
    return createToast({
      type: "info",
      message,
      progressColor: TOAST_COLORS.info,
      duration: 6500,
      showCloseButton: true,
      showProgressBar: true,
      cta: {
        label: ctaLabel,
        onClick: onCtaClick,
        autoClose: true,
      },
    });
  },

  rateLimit(seconds, onLoginClick) {
    const timeText = seconds ? `${seconds}s` : "a moment";
    return createToast({
      type: "warning",
      message: `⏱ Rate limit active. Wait ${timeText} or log in to unlock 5,000 req/hr quota!`,
      progressColor: TOAST_COLORS.warning,
      duration: 7000,
      showCloseButton: true,
      showProgressBar: true,
      ...(onLoginClick && {
        cta: {
          label: "Login via GitHub ↗",
          onClick: onLoginClick,
          autoClose: true,
        },
      }),
    });
  },

  copy(message = "📋 Copied to clipboard!", extra = {}) {
    return createToast({
      type: "success",
      message,
      progressColor: TOAST_COLORS.success,
      duration: 3000,
      showProgressBar: true,
      ...extra,
    });
  },

  battleComplete(winner, extra = {}) {
    return createToast({
      type: "success",
      message: winner
        ? `⚔️ Battle complete! @${winner} scored higher on the roast meter!`
        : "⚔️ Battle complete! It's a draw — equally roasted.",
      progressColor: TOAST_COLORS.fire,
      duration: 4500,
      showProgressBar: true,
      ...extra,
    });
  },

  paymentSuccess(extra = {}) {
    return createToast({
      type: "success",
      message: "⚡ Welcome to GitRoast Pro! AI roasts unlocked. ☢️ Nuclear mode ready.",
      progressColor: TOAST_COLORS.fire,
      duration: 6500,
      showProgressBar: true,
      ...extra,
    });
  },

  paymentError(
    message = "Payment failed. No money was deducted. Please try again.",
    extra = {}
  ) {
    return createToast({
      type: "error",
      message,
      progressColor: TOAST_COLORS.error,
      showCloseButton: true,
      showProgressBar: true,
      duration: 8000,
      ...extra,
    });
  },

  dismiss() {
    return pkgDismiss();
  },
};

export default toast;
