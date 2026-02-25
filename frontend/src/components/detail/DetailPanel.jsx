import { useRef } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { downloadJson } from "../../utils/format";
import { STAGE_LABEL } from "../../utils/mock";
import { MediaPreview } from "./MediaPreview";
import { MomentsSearch } from "./MomentsSearch";
import { Architecture } from "./Architecture";
import { PipelineGraph } from "./PipelineGraph";
import { PipelineEvents } from "./PipelineEvents";

function fmtMs(ms) {
  if (ms === null || ms === undefined) return "--";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function DetailPanel({ asset, onRerun, onSearch, onMomentJump }) {
  const videoRef = useRef(null);

  if (!asset) {
    return (
      <Card>
        <div className="emptyBig">Select an asset to preview transcript & moments.</div>
      </Card>
    );
  }

  function handleJump(sec) {
    const target = Math.max(0, Number(sec) || 0);

    if (videoRef.current) {
      videoRef.current.currentTime = target;
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked. Controls stay available.
      });
    }

    onMomentJump(target);
  }

  return (
    <Card>
      <div className="detailTop">
        <div className="detailInfo">
          <div className="detailTitle" title={asset.name}>{asset.name}</div>
          <div className="detailSub">
            Pipeline: <b>{STAGE_LABEL[asset.stage] || asset.stage}</b> • transcript chunks: <b>{asset.transcriptCount || 0}</b>
          </div>
          <div className="metricRow">
            <span className="metric">Upload: {fmtMs(asset.timings?.uploadMs)}</span>
            <span className="metric">Transcribe: {fmtMs(asset.timings?.transcribeMs)}</span>
            <span className="metric">Embed: {fmtMs(asset.timings?.embedMs)}</span>
            <span className="metric">Search: {fmtMs(asset.timings?.lastSearchMs)}</span>
          </div>
        </div>

        <div className="detailActions">
          <Button onClick={onRerun}>Refresh status</Button>
          <Button
            variant="primary"
            onClick={() =>
              downloadJson("clipquest_asset.json", {
                schema: "clipquest-live/v1",
                asset: {
                  id: asset.id,
                  backend_asset_id: asset.backendAssetId,
                  name: asset.name,
                  stage: asset.stage,
                  progress: asset.progress,
                  transcript_count: asset.transcriptCount,
                  embedding_count: asset.embeddingCount,
                },
                timings: asset.timings,
                events: asset.events || [],
                moments: asset.moments,
              })
            }
          >
            Export JSON
          </Button>
        </div>
      </div>

      <PipelineGraph asset={asset} />
      <PipelineEvents events={asset.events} />
      <MediaPreview asset={asset} videoRef={videoRef} />
      <MomentsSearch asset={asset} onSearch={onSearch} onJump={handleJump} />
      <Architecture />
    </Card>
  );
}
