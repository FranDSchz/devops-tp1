export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in_progress" | "resolved" | "closed";

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncidentBody {
  title: string;
  service: string;
  severity: Severity;
}

export interface UpdateIncidentBody {
  title?: string;
  service?: string;
  severity?: Severity;
  status?: Status;
}
