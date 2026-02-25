import { Button } from "../ui/Button";

export function Header({ simulate, failureMode, onToggleSim, onCycleFailure, onUpload }) {
  const failLabel =
    failureMode === "none"
      ? "Failure sim: OFF"
      : failureMode === "transcribe"
        ? "Failure sim: Transcribe"
        : "Failure sim: Embed";

  return (
    <div className="headerRow">
      <div>
        <div className="pill">
          <span className="dot" />
          An Easy Semantic Search Engine for Your Media Assets
        </div>

        <h1 className="title">
          <span className="grad">ClipQuest</span>
        </h1>

        <p className="subtitle">
          Upload media → ingest to MinIO → transcription worker processes audio → embedding worker indexes meaning → semantic search from Postgres.
        </p>
      </div>

      <div className="headerActions">
        <Button onClick={onToggleSim}>{simulate ? "Mode: UI Sim" : "Mode: Live Backend"}</Button>
        <Button onClick={onCycleFailure}>{failLabel}</Button>
        <Button variant="primary" onClick={onUpload}>Upload media</Button>
      </div>
    </div>
  );
}
