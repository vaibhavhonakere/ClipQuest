import { Badge } from "../ui/Badge";
import { Progress } from "../ui/Progress";
import { humanBytes } from "../../utils/format";
import { STAGE_LABEL } from "../../utils/mock";

export function AssetCard({ asset, active, onSelect, onRemove }) {
  const jobId = (asset.backendAssetId || asset.id || "").slice(0, 8);

  return (
    <button className={`assetCard ${active ? "assetCardActive" : ""}`} onClick={() => onSelect(asset.id)}>
      <div className="assetTop">
        <div className="assetMain">
          <div className="assetName" title={asset.name}>{asset.name}</div>
          <div className="assetMeta">
            {humanBytes(asset.size)} • {asset.type.includes("video") ? "Video" : "Audio"}
          </div>
        </div>
        <Badge>{STAGE_LABEL[asset.stage] || asset.stage}</Badge>
      </div>

      <div className="assetProgress">
        <Progress value={asset.progress} />
        <div className="assetProgressMeta">
          <span>job_id: {jobId}…</span>
          <span>{Math.round(asset.progress)}%</span>
        </div>
      </div>

      {asset.error && <div className="assetError">{asset.error}</div>}

      <span
        className="remove"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(asset.id);
        }}
      >
        Remove
      </span>
    </button>
  );
}
