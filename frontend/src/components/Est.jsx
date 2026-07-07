// Renders a string, converting any inline "(estimated)" / "(est.)" marker the
// model emits into a subtle "EST." badge — signalling which figures are
// model estimates rather than confirmed facts.
export default function Est({ text }) {
  if (text === null || text === undefined) return null;
  const str = String(text);
  const parts = str.split(/\s*\((?:estimated|est\.?)\)/gi);
  if (parts.length === 1) return str;

  const nodes = [];
  parts.forEach((p, i) => {
    if (p) nodes.push(p);
    if (i < parts.length - 1) {
      nodes.push(
        <span className="est-badge" key={`e${i}`} title="Model estimate — not audited">
          est.
        </span>
      );
    }
  });
  return <>{nodes}</>;
}
