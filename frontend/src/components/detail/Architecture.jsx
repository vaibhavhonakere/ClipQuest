export function Architecture() {
  return (
    <div className="arch">
      <div className="sectionTitle">Pipeline architecture</div>
      <div className="archGrid">
        <div className="archBox"><b>Storage + bus</b><div>MinIO + Kafka events for asset processing</div></div>
        <div className="archBox"><b>Workers</b><div>Transcription Worker → Embedding Worker</div></div>
        <div className="archBox"><b>Whisper</b><div>segment timestamps + transcript chunks</div></div>
        <div className="archBox"><b>Search API</b><div>pgvector similarity + ranked semantic hits</div></div>
      </div>
      <div className="foot">UI polls live backend status and unlocks search when embeddings are ready.</div>
    </div>
  );
}
