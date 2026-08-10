import { createToast } from "customizable-toast-notification";

const BASE = {
  position: "top-center",
};

export const toast = {
  success(message, extra = {}) {
    createToast({
      type: "success",
      message,
      position: BASE.position,
      showProgressBar: true,
      duration: 3000,
      ...extra,
    });
  },

  error(message, extra = {}) {
    createToast({
      type: "error",
      message,
      position: BASE.position,
      showCloseButton: true,
      duration: 5000,
      ...extra,
    });
  },

  warning(message, extra = {}) {
    createToast({
      type: "warning",
      message,
      position: BASE.position,
      showProgressBar: true,
      showCloseButton: true,
      duration: 5000,
      ...extra,
    });
  },

  info(message, extra = {}) {
    createToast({
      type: "info",
      message,
      position: BASE.position,
      duration: 4000,
      showCloseButton: true,
      ...extra,
    });
  },

  proNudge(message, onCtaClick, ctaLabel = "See Plans ⚡") {
    createToast({
      type: "info",
      message,
      position: BASE.position,
      duration: 6000,
      showCloseButton: true,
      showProgressBar: true,
      cta: {
        label: ctaLabel,
        onClick: onCtaClick,
        autoClose: true,
      },
    });
  },

  battleComplete(winner) {
    createToast({
      type: "success",
      message: winner
        ? `⚔️ Battle complete! @${winner} is the most roastable!`
        : "⚔️ Battle complete! It's a draw — equally shameful.",
      position: BASE.position,
      showProgressBar: true,
      duration: 4500,
    });
  },

  paymentSuccess() {
    createToast({
      type: "success",
      message: "⚡ You are now Pro! AI roasts unlocked. ☢️ Nuclear ready.",
      position: BASE.position,
      showProgressBar: true,
      duration: 6000,
    });
  },

  paymentError(message = "Payment failed. No money was deducted. Try again.") {
    createToast({
      type: "error",
      message,
      position: BASE.position,
      showCloseButton: true,
      duration: 8000,
    });
  },
};
