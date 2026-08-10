import { BASEMAPS } from "./basemaps";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function BasemapSwitcher({ value, onChange }: Props) {
  return (
    <div className="map-control basemap-switcher">
      {BASEMAPS.map((b) => (
        <button
          key={b.id}
          className={b.id === value ? "basemap-btn active" : "basemap-btn"}
          onClick={() => onChange(b.id)}
          title={b.name}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
