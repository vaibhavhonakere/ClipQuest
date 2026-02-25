import React from "react";
import "./styles.css";

import { useAssets } from "./state/useAssets";

import { AppShell } from "./components/layout/AppShell";
import { Background } from "./components/layout/Background";
import { Header } from "./components/layout/Header";
import { Grid } from "./components/layout/Grid";

import { FilePicker } from "./components/upload/FilePicker";
import { Dropzone } from "./components/upload/Dropzone";

import { AssetList } from "./components/assets/AssetList";
import { DetailPanel } from "./components/detail/DetailPanel";

export default function App() {
  const {
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
  } = useAssets();

  const [dragActive, setDragActive] = React.useState(false);

  function cycleFailureMode() {
    if (failureMode === "none") {
      setFailureMode("transcribe");
      return;
    }
    if (failureMode === "transcribe") {
      setFailureMode("embed");
      return;
    }
    setFailureMode("none");
  }

  return (
    <AppShell>
      <Background />

      <div className="container">
        <Header
          simulate={simulate}
          failureMode={failureMode}
          onToggleSim={() => setSimulate((v) => !v)}
          onCycleFailure={cycleFailureMode}
          onUpload={() => inputRef.current?.click()}
        />

        <FilePicker inputRef={inputRef} onPick={addFiles} />

        <Dropzone
          dragActive={dragActive}
          assetsCount={assets.length}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
        />

        <Grid
          left={
            <AssetList
              assets={assets}
              activeId={activeId}
              onSelect={setActiveId}
              onClear={clearAll}
              onRemove={removeAsset}
            />
          }
          right={
            <DetailPanel
              asset={active}
              onRerun={rerunActive}
              onSearch={searchActive}
              onMomentJump={noteMomentJump}
            />
          }
        />

        <div className="footer">ClipQuest live UI — upload, pipeline status, semantic search.</div>
      </div>
    </AppShell>
  );
}
