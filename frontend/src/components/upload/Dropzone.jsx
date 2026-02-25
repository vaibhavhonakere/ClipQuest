import { Card } from "../ui/Card";

export function Dropzone({ dragActive, assetsCount, onDrop, onDragOver, onDragLeave }) {
  return (
    <Card className={`dropzone ${dragActive ? "dropzoneActive" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="dropRow">
        <div>
          <div className="dropTitle">Drag & drop media</div>
          <div className="dropSub">Live flow: FastAPI → MinIO → Kafka workers → pgvector search.</div>
        </div>
        <div className="dropCount">Assets: <b>{assetsCount}</b></div>
      </div>
    </Card>
  );
}
