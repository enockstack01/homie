import { useState } from "react";
import type { Project } from "../lib/api";

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  drawing: boolean;
  onStartDrawing: () => void;
  pendingAoi: GeoJSON.Polygon | null;
  onSaveProject: (name: string) => void;
  onCancelDrawing: () => void;
}

export function ProjectPanel({
  projects,
  activeProjectId,
  onSelect,
  drawing,
  onStartDrawing,
  pendingAoi,
  onSaveProject,
  onCancelDrawing,
}: Props) {
  const [name, setName] = useState("");

  return (
    <section className="panel">
      <h2>Project</h2>
      {!drawing && !pendingAoi && (
        <button onClick={onStartDrawing}>+ New project (draw AOI)</button>
      )}
      {drawing && (
        <p className="hint">Click on the map to place vertices, double-click to close the polygon.</p>
      )}
      {pendingAoi && (
        <div className="stack">
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="row">
            <button
              onClick={() => {
                if (name.trim()) {
                  onSaveProject(name.trim());
                  setName("");
                }
              }}
              disabled={!name.trim()}
            >
              Save project
            </button>
            <button className="secondary" onClick={onCancelDrawing}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <ul className="list">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              className={p.id === activeProjectId ? "list-item active" : "list-item"}
              onClick={() => onSelect(p.id)}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
