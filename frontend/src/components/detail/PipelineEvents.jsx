function fmt(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString([], { hour12: false });
}

export function PipelineEvents({ events }) {
  const list = events || [];

  return (
    <div className="eventsCard">
      <div className="sectionTitle">Live event feed</div>
      {list.length === 0 ? (
        <div className="empty">No events yet. Upload an asset to start the feed.</div>
      ) : (
        <div className="eventsList">
          {list.map((e) => (
            <div key={e.id} className={`eventRow event-${e.kind || "info"}`}>
              <span className="eventTime">{fmt(e.at)}</span>
              <span className="eventMsg">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
