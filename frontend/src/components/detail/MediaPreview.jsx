export function MediaPreview({ asset, videoRef }) {
  if (!asset) return null;

  if (asset.previewUrl) {
    return (
      <div className="media">
        <video ref={videoRef} src={asset.previewUrl} controls />
      </div>
    );
  }

  return <div className="mediaStub">Audio asset — preview stubbed.</div>;
}
