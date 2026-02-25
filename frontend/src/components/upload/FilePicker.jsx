export function FilePicker({ inputRef, onPick }) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept="video/*,audio/*,.mp4,.mov,.webm,.mp3,.m4a,.wav"
      style={{ display: "none" }}
      onChange={(e) => onPick(e.target.files)}
    />
  );
}
