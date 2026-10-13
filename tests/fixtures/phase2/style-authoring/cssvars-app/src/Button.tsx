export function Button() {
  return (
    <div>
      <button style={{ borderRadius: "var(--radius-sm)", padding: "var(--spacing-md)" }}>Small</button>
      <button style={{ borderRadius: "var(--radius-md)", padding: "var(--spacing-md)" }}>Medium</button>
      <button style={{ borderRadius: "var(--radius-lg)", padding: "var(--spacing-md)" }}>Large</button>
    </div>
  );
}
