import { useMemo, useState } from "react";
import { MomentCard } from "./MomentCard";

const QUICK_PROMPTS = [
  "Best time to eat out during the day",
  "How do I make a reservation at New York's Empire State Building restaurant?",
  "What are the 5 most volatile stock in the S&P 500?"
];

function confidenceText(score) {
  if (score >= 0.75) return "Very high confidence";
  if (score >= 0.62) return "High confidence";
  if (score >= 0.5) return "Medium confidence";
  return "Low confidence";
}

export function MomentsSearch({ asset, onSearch, onJump }) {
  const [query, setQuery] = useState("");

  if (!asset) return null;

  const canSearch = asset.stage === "READY" && !!asset.backendAssetId;

  const ranked = useMemo(
    () => [...(asset.moments || [])].sort((a, b) => b.score - a.score),
    [asset.moments]
  );
  const recommended = ranked.slice(0, 3);
  const recommendedIds = new Set(recommended.map((m) => m.id));

  function runQuery(text) {
    setQuery(text);
    onSearch(text);
  }

  return (
    <>
      <div className="searchRow">
        <div className="sectionTitle">Search for Anything</div>
        <div className="searchControls">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: explain kafka flow, mention whisper timestamps, vector indexing"
            disabled={!canSearch || asset.searchLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) onSearch(query);
            }}
          />
          <button
            className="jump"
            onClick={() => onSearch(query)}
            disabled={!canSearch || asset.searchLoading || !query.trim()}
          >
            {asset.searchLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="promptRow">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            className="promptChip"
            disabled={!canSearch || asset.searchLoading}
            onClick={() => runQuery(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {!canSearch && (
        <div className="empty">Finish processing first. Search unlocks once embedding is complete.</div>
      )}

      {asset.searchError && <div className="empty">Search failed: {asset.searchError}</div>}

      {canSearch && !asset.searchLoading && recommended.length > 0 && (
        <div className="recoCard">
          <div className="recoTitle">Recommended first looks</div>
          <div className="recoList">
            {recommended.map((m, idx) => (
              <button key={m.id} className="recoItem" onClick={() => onJump(m.t0)}>
                <span className="recoRank">#{idx + 1}</span>
                <span className="recoText">{m.text.slice(0, 90)}{m.text.length > 90 ? "..." : ""}</span>
                <span className="recoScore">{m.score.toFixed(2)} • {confidenceText(m.score)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="moments">
        {asset.moments.map((m) => (
          <MomentCard key={m.id} m={m} onJump={onJump} highlight={recommendedIds.has(m.id)} />
        ))}

        {canSearch && !asset.searchLoading && query.trim() && asset.moments.length === 0 && !asset.searchError && (
          <div className="empty">No matches yet. Try a broader phrase.</div>
        )}
      </div>
    </>
  );
}
