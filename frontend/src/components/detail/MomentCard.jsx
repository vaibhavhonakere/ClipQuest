import { fmtTime } from "../../utils/format";

function confidence(score) {
  if (score >= 0.75) return { label: "Best match", tone: "best" };
  if (score >= 0.62) return { label: "Strong match", tone: "strong" };
  if (score >= 0.5) return { label: "Possible match", tone: "possible" };
  return { label: "Low confidence", tone: "low" };
}

export function MomentCard({ m, onJump, highlight = false }) {
  const conf = confidence(m.score);

  return (
    <div className={`moment ${highlight ? "momentHighlight" : ""}`}>
      <div className="momentTop">
        <div className="momentMeta">
          <span className="chip">{fmtTime(m.t0)} → {fmtTime(m.t1)}</span>
          <span className="score">score {m.score.toFixed(2)}</span>
          <span className={`conf conf-${conf.tone}`}>{conf.label}</span>
        </div>
        <button className="jump" onClick={() => onJump(m.t0)}>Jump</button>
      </div>
      <div className="momentText">{m.text}</div>
    </div>
  );
}
