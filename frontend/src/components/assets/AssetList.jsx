import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { AssetCard } from "./AssetCard";

export function AssetList({ assets, activeId, onSelect, onClear, onRemove }) {
  return (
    <Card>
      <div className="cardTop">
        <div className="cardTitle">Library</div>
        <Button onClick={onClear}>Clear</Button>
      </div>

      {assets.length === 0 ? (
        <div className="empty">Upload a file to populate the library.</div>
      ) : (
        <div className="list">
          {assets.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              active={a.id === activeId}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
