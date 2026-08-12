const ORCHESTRATOR_BASE = "http://127.0.0.1:8756";

export interface Project {
  id: string;
  name: string;
  aoi_geojson: GeoJSON.Polygon;
  created_at: string;
}

export interface CropRange {
  min: number;
  optimal_min: number;
  optimal_max: number;
  max: number;
}

export interface CropProfile {
  id: string;
  name: string;
  annual_rainfall_mm: CropRange;
  mean_temp_c: CropRange;
  elevation_m: CropRange;
  max_slope_percent: number;
}

export interface CriterionWeights {
  annual_rainfall_mm: number;
  mean_temp_c: number;
  elevation_m: number;
}

export interface PointResult {
  lat: number;
  lon: number;
  elevation_m: number;
  slope_percent: number;
  annual_rainfall_mm: number | null;
  mean_temp_c: number | null;
  criterion_scores: Record<string, number>;
  suitability_score: number;
  suitability_class: string;
  limiting_factor: string | null;
  bounds: [number, number, number, number] | null;
}

export interface RunResult {
  id: string;
  project_id: string;
  project_name?: string; // present on /runs (dashboard history), absent on /analyze's own direct response
  crop_id: string;
  result: {
    points: PointResult[];
    summary: {
      mean_suitability: number;
      class_distribution: Record<string, number>;
      dominant_limiting_factor: string | null;
    };
    crop_name: string;
    weights_used: CriterionWeights;
  };
  created_at: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Account {
  id: string;
  email: string | null;
  role: string;
  status: string;
  organization_name: string | null;
  credit_balance: number;
  preferred_model_id: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORCHESTRATOR_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  createProject: (name: string, aoi_geojson: GeoJSON.Polygon) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify({ name, aoi_geojson }) }),
  listRuns: (projectId: string) => request<RunResult[]>(`/projects/${projectId}/runs`),
  listAllRuns: (limit = 200) => request<RunResult[]>(`/runs?limit=${limit}`),

  listCrops: () => request<CropProfile[]>("/crops"),
  createCrop: (profile: CropProfile) =>
    request<CropProfile>("/crops", { method: "POST", body: JSON.stringify(profile) }),
  updateCrop: (id: string, profile: CropProfile) =>
    request<CropProfile>(`/crops/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(profile) }),
  deleteCrop: (id: string) => request<{ deleted: string }>(`/crops/${encodeURIComponent(id)}`, { method: "DELETE" }),

  getWeights: () => request<CriterionWeights>("/weights"),
  setWeights: (weights: CriterionWeights) =>
    request<CriterionWeights>("/weights", { method: "PUT", body: JSON.stringify(weights) }),

  analyze: (project_id: string, crop_id: string) =>
    request<RunResult>("/analyze", { method: "POST", body: JSON.stringify({ project_id, crop_id }) }),

  chat: (messages: ChatTurn[], run_id?: string) =>
    request<{ reply: string; deducted_credits: number; remaining_credits: number }>("/chat", {
      method: "POST",
      body: JSON.stringify({ messages, run_id }),
    }),

  getSettings: () => request<{ homie_api_base: string; has_api_key: boolean }>("/settings"),
  putSettings: (homie_api_key: string, homie_api_base?: string) =>
    request<{ saved: boolean; error?: string; account?: Account }>("/settings", {
      method: "PUT",
      body: JSON.stringify({ homie_api_key, homie_api_base }),
    }),
  getAccount: () => request<Account>("/settings/account"),
  clearSettings: () => request<{ cleared: boolean }>("/settings", { method: "DELETE" }),
};
