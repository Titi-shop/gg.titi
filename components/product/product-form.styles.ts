export const inputClass =
  "w-full border p-2 rounded transition-colors";

export const inputStyle = {
  background: "var(--card-bg)",
  color: "var(--foreground)",
  borderColor: "var(--nav-border)",
};

export const cardStyle = {
  background: "var(--card-bg)",
  color: "var(--foreground)",
  borderColor: "var(--nav-border)",
};

export const errorBorderClass =
  "border-red-500";

export const imageUploadStyle = (
  hasError: boolean
) => ({
  background: "var(--card-bg)",
  borderColor: hasError
    ? "#ef4444"
    : "var(--nav-border)",
  color: "var(--foreground)",
});

export const detailUploadStyle = {
  background: "var(--card-bg)",
  borderColor: "var(--nav-border)",
  color: "var(--foreground)",
};

export const loadingStyle = {
  color: "var(--foreground)",
};

export const imageBorderStyle = {
  borderColor: "var(--nav-border)",
};

export const removeButtonStyle = {
  background: "rgba(0,0,0,.65)",
  color: "#fff",
};

export const submitButtonStyle = (
  submitting: boolean,
  isDark: boolean
) => ({
  background: submitting
    ? "var(--text-muted)"
    : "var(--color-primary)",

  color: isDark
    ? "#000"
    : "#fff",

  opacity: submitting
    ? 0.7
    : 1,
});
