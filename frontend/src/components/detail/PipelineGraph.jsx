function nodeStates(asset) {
  if (!asset) return {};

  const failed = asset.stage === "ERROR";
  const failAt = !asset.backendAssetId ? "ingest" : asset.transcriptCount > 0 ? "embed" : "transcribe";

  const isReady = asset.stage === "READY";
  const isEmbedding = asset.stage === "EMBEDDING";
  const isTranscribing = asset.stage === "TRANSCRIBING" || asset.stage === "UPLOADED";
  const isUploading = asset.stage === "UPLOADING";

  return {
    ingest: failed && failAt === "ingest" ? "error" : isUploading ? "active" : "done",
    transcribe: failed && failAt === "transcribe" ? "error" : isTranscribing ? "active" : isEmbedding || isReady ? "done" : "pending",
    embed: failed && failAt === "embed" ? "error" : isEmbedding ? "active" : isReady ? "done" : "pending",
    search: failed ? "pending" : isReady ? "done" : "pending",
  };
}

function Node({ title, subtitle, state }) {
  return (
    <div className={`graphNode node-${state}`}>
      <div className="nodeIconWrap">
        <div className="nodeIcon" />
        {state === "active" && <div className="nodeSpinner" />}
      </div>
      <div>
        <div className="nodeTitle">{title}</div>
        <div className="nodeSub">{subtitle}</div>
      </div>
    </div>
  );
}

function Edge({ state }) {
  return <div className={`graphEdge edge-${state}`} />;
}

export function PipelineGraph({ asset }) {
  if (!asset) return null;
  const s = nodeStates(asset);

  return (
    <div className="graphCard">
      <div className="sectionTitle">Pipeline graph</div>
      <div className="graphFlow">
        <Node
          title="Ingest Service"
          subtitle={asset.backendAssetId ? `asset_id ${asset.backendAssetId.slice(0, 8)}…` : "Uploading to MinIO"}
          state={s.ingest}
        />
        <Edge state={s.transcribe === "done" ? "done" : s.transcribe === "active" ? "active" : "pending"} />
        <Node
          title="Transcription Worker"
          subtitle={asset.transcriptCount ? `${asset.transcriptCount} transcript chunks` : "Whisper transcription"}
          state={s.transcribe}
        />
        <Edge state={s.embed === "done" ? "done" : s.embed === "active" ? "active" : "pending"} />
        <Node
          title="Embedding Worker"
          subtitle={asset.embeddingCount ? `${asset.embeddingCount} embeddings` : "Vector generation"}
          state={s.embed}
        />
        <Edge state={s.search === "done" ? "done" : "pending"} />
        <Node
          title="Search Service"
          subtitle={asset.stage === "READY" ? "Semantic search unlocked" : "Waiting for embeddings"}
          state={s.search}
        />
      </div>
      {asset.stage === "ERROR" && <div className="graphError">Pipeline failed: {asset.error || "unknown error"}</div>}
    </div>
  );
}
