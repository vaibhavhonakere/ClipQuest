import { useEffect, useMemo, useRef, useState } from "react";
import { isMediaFile, newAssetFromFile } from "../utils/mock";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const POLL_MS = 3000;

function nowIso() {
  return new Date().toISOString();
}

function makeEvent(kind, message) {
  return {
    id: `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`,
    at: nowIso(),
    kind,
    message,
  };
}

function withEvent(asset, kind, message) {
  const nextEvents = [makeEvent(kind, message), ...(asset.events || [])].slice(0, 50);
  return { ...asset, events: nextEvents };
}

function makeLocalAsset(file) {
  const id = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const isVideo = /^(video)\//i.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
  const queuedAt = Date.now();

  const base = {
    id,
    backendAssetId: null,
    storageKey: null,
    file,
    name: file.name,
    size: file.size,
    type: file.type || (isVideo ? "video/*" : "audio/*"),
    createdAt: nowIso(),
    stage: "UPLOADING",
    backendStatus: "UPLOADING",
    progress: 8,
    previewUrl: isVideo ? URL.createObjectURL(file) : null,
    moments: [],
    transcriptCount: 0,
    embeddingCount: 0,
    searchLoading: false,
    searchError: null,
    searchQuery: "",
    error: null,
    events: [],
    timings: {
      queuedAt,
      uploadAcceptedAt: null,
      transcribedAt: null,
      embeddedAt: null,
      uploadMs: null,
      transcribeMs: null,
      embedMs: null,
      lastSearchMs: null,
    },
  };

  return withEvent(base, "info", `Queued upload for ${file.name}`);
}

function hydrateMockAsset(file) {
  const mock = newAssetFromFile(file);
  const t0 = Date.now();
  return {
    ...mock,
    backendAssetId: null,
    storageKey: null,
    backendStatus: mock.stage,
    transcriptCount: mock.moments.length,
    embeddingCount: mock.moments.length,
    searchLoading: false,
    searchError: null,
    searchQuery: "",
    error: null,
    events: [makeEvent("success", "Sim mode: asset ready")],
    timings: {
      queuedAt: t0,
      uploadAcceptedAt: t0,
      transcribedAt: t0,
      embeddedAt: t0,
      uploadMs: 120,
      transcribeMs: 2800,
      embedMs: 1400,
      lastSearchMs: null,
    },
  };
}

function mapBackendStatus(status, currentProgress) {
  if (status === "ERROR") return { stage: "ERROR", progress: 0 };
  if (status === "UPLOADED") return { stage: "TRANSCRIBING", progress: Math.max(currentProgress, 34) };
  if (status === "TRANSCRIBED") return { stage: "EMBEDDING", progress: Math.max(currentProgress, 72) };
  if (status === "EMBEDDED") return { stage: "READY", progress: 100 };
  return { stage: "TRANSCRIBING", progress: Math.max(currentProgress, 24) };
}

function statusMessage(status) {
  if (status === "UPLOADED") return "Upload stored in MinIO, waiting for transcription worker";
  if (status === "TRANSCRIBED") return "Transcription Worker finished transcript generation";
  if (status === "EMBEDDED") return "Embedding Worker finished vector indexing. Search unlocked";
  return `Backend status changed: ${status}`;
}

function toMomentRows(searchResponse, assetId) {
  const source = (searchResponse?.ranges?.length ? searchResponse.ranges : searchResponse?.hits) || [];
  return source.map((m, i) => {
    const startMs = Number(m.start_time || 0);
    const endMs = Number(m.end_time || 0);
    const distance = typeof m.best_distance === "number" ? m.best_distance : m.distance;
    const score = typeof distance === "number" ? Math.max(0, 1 - distance) : 0.7;
    return {
      id: `${assetId}-${i}-${startMs}`,
      t0: Math.floor(startMs / 1000),
      t1: Math.floor(endMs / 1000),
      text: m.text || "",
      score,
    };
  });
}

function applyFailureIfNeeded(asset, status, failureMode) {
  if (failureMode === "transcribe" && status === "UPLOADED") {
    return {
      triggered: true,
      next: withEvent(
        {
          ...asset,
          stage: "ERROR",
          backendStatus: "ERROR",
          error: "Simulated failure in Transcription Worker",
          progress: 0,
        },
        "error",
        "Failure simulation triggered: Transcription Worker"
      ),
    };
  }

  if (failureMode === "embed" && status === "TRANSCRIBED") {
    return {
      triggered: true,
      next: withEvent(
        {
          ...asset,
          stage: "ERROR",
          backendStatus: "ERROR",
          error: "Simulated failure in Embedding Worker",
          progress: 0,
        },
        "error",
        "Failure simulation triggered: Embedding Worker"
      ),
    };
  }

  return { triggered: false, next: asset };
}

export function useAssets() {
  const [assets, setAssets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [simulate, setSimulate] = useState(false);
  const [failureMode, setFailureMode] = useState("none");

  const inputRef = useRef(null);
  const assetsRef = useRef(assets);
  const failureModeRef = useRef(failureMode);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    failureModeRef.current = failureMode;
  }, [failureMode]);

  const active = useMemo(() => assets.find((a) => a.id === activeId) || null, [assets, activeId]);

  useEffect(() => {
    if (!activeId && assets.length) setActiveId(assets[0].id);
  }, [assets, activeId]);

  useEffect(() => {
    if (simulate) return;

    let cancelled = false;

    const tick = async () => {
      const toPoll = assetsRef.current.filter(
        (a) => a.backendAssetId && a.stage !== "READY" && a.stage !== "ERROR"
      );
      if (!toPoll.length) return;

      const settled = await Promise.all(
        toPoll.map(async (asset) => {
          try {
            const res = await fetch(`${API_BASE}/assets/${asset.backendAssetId}/status`);
            if (!res.ok) throw new Error(`status ${res.status}`);
            const payload = await res.json();
            return { localId: asset.id, ok: true, payload };
          } catch (err) {
            return {
              localId: asset.id,
              ok: false,
              error: err instanceof Error ? err.message : "status polling failed",
            };
          }
        })
      );

      if (cancelled) return;

      let consumedFailure = false;

      setAssets((prev) =>
        prev.map((asset) => {
          const hit = settled.find((entry) => entry.localId === asset.id);
          if (!hit) return asset;

          if (!hit.ok) {
            if (asset.stage === "ERROR") return asset;
            return withEvent(
              {
                ...asset,
                stage: "ERROR",
                backendStatus: "ERROR",
                error: hit.error,
                progress: 0,
              },
              "error",
              `Status polling failed: ${hit.error}`
            );
          }

          const status = hit.payload.status;
          const simulated = applyFailureIfNeeded(asset, status, failureModeRef.current);
          if (simulated.triggered) {
            consumedFailure = true;
            return simulated.next;
          }

          const mapped = mapBackendStatus(status, asset.progress);
          let next = {
            ...asset,
            stage: mapped.stage,
            backendStatus: status,
            progress: mapped.progress,
            transcriptCount: hit.payload.transcript_count || 0,
            embeddingCount: hit.payload.embedding_count || 0,
          };

          if (status !== asset.backendStatus) {
            next = withEvent(next, "info", statusMessage(status));

            const now = Date.now();
            if (status === "TRANSCRIBED" && !next.timings.transcribedAt) {
              const from = next.timings.uploadAcceptedAt || next.timings.queuedAt;
              next = {
                ...next,
                timings: {
                  ...next.timings,
                  transcribedAt: now,
                  transcribeMs: from ? Math.max(0, now - from) : null,
                },
              };
            }
            if (status === "EMBEDDED" && !next.timings.embeddedAt) {
              const from = next.timings.transcribedAt || next.timings.uploadAcceptedAt || next.timings.queuedAt;
              next = {
                ...next,
                timings: {
                  ...next.timings,
                  embeddedAt: now,
                  embedMs: from ? Math.max(0, now - from) : null,
                },
              };
            }
          }

          return next;
        })
      );

      if (consumedFailure) setFailureMode("none");
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [simulate]);

  async function uploadToBackend(localId, file) {
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed: ${res.status}`);
      }

      const payload = await res.json();
      const now = Date.now();
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== localId) return a;
          return withEvent(
            {
              ...a,
              backendAssetId: payload.asset_id,
              storageKey: payload.storage_key,
              stage: "TRANSCRIBING",
              backendStatus: "UPLOADED",
              progress: 24,
              timings: {
                ...a.timings,
                uploadAcceptedAt: now,
                uploadMs: a.timings.queuedAt ? Math.max(0, now - a.timings.queuedAt) : null,
              },
            },
            "success",
            `Upload accepted by API. asset_id ${payload.asset_id.slice(0, 8)}…`
          );
        })
      );
    } catch (err) {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== localId) return a;
          return withEvent(
            {
              ...a,
              stage: "ERROR",
              backendStatus: "ERROR",
              error: err instanceof Error ? err.message : "Upload failed",
              progress: 0,
            },
            "error",
            `Upload failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
        })
      );
    }
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(isMediaFile);
    if (!files.length) return;

    if (simulate) {
      setAssets((prev) => {
        const next = [...prev];
        for (const f of files) next.unshift(hydrateMockAsset(f));
        return next;
      });
      return;
    }

    const locals = files.map(makeLocalAsset);
    setAssets((prev) => [...locals, ...prev]);
    for (let i = 0; i < files.length; i += 1) {
      uploadToBackend(locals[i].id, files[i]);
    }
  }

  async function searchActive(query) {
    if (!active || !active.backendAssetId) return;

    const q = query.trim();
    const started = performance.now();

    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== active.id) return a;
        return {
          ...a,
          searchLoading: true,
          searchError: null,
          searchQuery: query,
          events: q ? [makeEvent("info", `Search requested: "${q}"`), ...(a.events || [])].slice(0, 50) : a.events,
        };
      })
    );

    if (!q) {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === active.id ? { ...a, searchLoading: false, moments: [], searchQuery: "" } : a
        )
      );
      return;
    }

    try {
      const url = new URL(`${API_BASE}/search`);
      url.searchParams.set("asset_id", active.backendAssetId);
      url.searchParams.set("q", q);
      url.searchParams.set("k", "8");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Search failed: ${res.status}`);
      }

      const payload = await res.json();
      const moments = toMomentRows(payload, active.backendAssetId);
      const took = Math.round(performance.now() - started);

      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== active.id) return a;
          return withEvent(
            {
              ...a,
              searchLoading: false,
              searchError: null,
              moments,
              searchQuery: query,
              timings: { ...a.timings, lastSearchMs: took },
            },
            "success",
            `Search returned ${moments.length} result${moments.length === 1 ? "" : "s"} in ${took} ms`
          );
        })
      );
    } catch (err) {
      const took = Math.round(performance.now() - started);
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== active.id) return a;
          return withEvent(
            {
              ...a,
              searchLoading: false,
              searchError: err instanceof Error ? err.message : "Search failed",
              timings: { ...a.timings, lastSearchMs: took },
            },
            "error",
            `Search failed in ${took} ms: ${err instanceof Error ? err.message : "unknown error"}`
          );
        })
      );
    }
  }

  function noteMomentJump(seconds) {
    if (!active) return;
    setAssets((prev) =>
      prev.map((a) => (a.id === active.id ? withEvent(a, "info", `Jumped preview to ${seconds}s`) : a))
    );
  }

  function clearAll() {
    setAssets((prev) => {
      for (const a of prev) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      return [];
    });
    setActiveId(null);
  }

  function removeAsset(id) {
    setAssets((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a?.previewUrl) URL.revokeObjectURL(a.previewUrl);
      const next = prev.filter((x) => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function rerunActive() {
    if (!active) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === active.id
          ? withEvent(
              {
                ...a,
                stage: "UPLOADED",
                backendStatus: "UPLOADED",
                progress: 24,
                moments: [],
                error: null,
              },
              "info",
              "Manual status refresh requested"
            )
          : a
      )
    );
  }

  return {
    assets,
    active,
    activeId,
    simulate,
    failureMode,
    inputRef,

    setActiveId,
    setSimulate,
    setFailureMode,

    addFiles,
    clearAll,
    removeAsset,
    rerunActive,
    searchActive,
    noteMomentJump,
  };
}
