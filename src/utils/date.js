// Format time for display
/**
 * @param {string | number | Date} dateTime
 */
export function formatTime(dateTime) {
  return new Date(dateTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {string | number | Date} dateTime
 */
export function formatDate(dateTime) {
  const date = new Date(dateTime);
  const today = new Date();
  const tomorrow = new Date(today);
  const yesterday = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "tomorrow";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "yesterday";
  } else {
    const diffMs = date.getTime() - today.getTime();
    const diffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return diffMs > 0 ? `in ${diffDays} days` : `${diffDays} days ago`;
  }
}
