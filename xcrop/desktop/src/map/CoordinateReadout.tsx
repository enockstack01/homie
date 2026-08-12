interface Props {
  lngLat: { lng: number; lat: number } | null;
}

export function CoordinateReadout({ lngLat }: Props) {
  if (!lngLat) return null;
  return (
    <div className="map-control-panel coord-readout">
      {lngLat.lat.toFixed(5)}, {lngLat.lng.toFixed(5)}
    </div>
  );
}
