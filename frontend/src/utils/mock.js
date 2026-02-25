export const STAGE_LABEL = {
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  TRANSCRIBING: "Transcribing (Whisper)",
  EMBEDDING: "Embedding (Vector Worker)",
  INDEXING: "Indexing (Search)",
  READY: "Ready",
  ERROR: "Error",
};

export function isMediaFile(f) {
  const okType = /^(video|audio)\//i.test(f.type);
  const okExt = /\.(mp4|mov|m4a|mp3|wav|webm)$/i.test(f.name);
  return okType || okExt;
}

function makeMockMoments(seed) {
  const base = [
    { t0: 12, t1: 27, text: "Intro: explains the goal and constraints." },
    { t0: 41, t1: 58, text: "Kafka topics and worker flow." },
    { t0: 76, t1: 92, text: "Whisper transcription + timestamps." },
    { t0: 110, t1: 128, text: "Embedding segments into vectors." },
    { t0: 142, t1: 162, text: "Indexing vectors + metadata." },
    { t0: 176, t1: 192, text: "Search → jump to the right moment." },
  ];
  return base.map((m, i) => ({
    id: `${seed}-${i}`,
    ...m,
    text: `${m.text} (${seed})`,
    score: Math.max(0.62, 0.95 - i * 0.05),
  }));
}

export function newAssetFromFile(file) {
  const aid = `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  const isVideo = /^(video)\//i.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
  const previewUrl = isVideo ? URL.createObjectURL(file) : null;

  return {
    id: aid,
    file,
    name: file.name,
    size: file.size,
    type: file.type || (isVideo ? "video/*" : "audio/*"),
    createdAt: new Date().toISOString(),
    stage: "UPLOADED",
    progress: 0,
    previewUrl,
    moments: makeMockMoments(file.name.replace(/\W+/g, "_").slice(0, 18)),
  };
}
