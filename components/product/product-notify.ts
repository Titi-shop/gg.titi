export function showMessage(
  message: string
) {
  window.dispatchEvent(
    new CustomEvent(
      "global-alert",
      {
        detail: message,
      }
    )
  );
}
