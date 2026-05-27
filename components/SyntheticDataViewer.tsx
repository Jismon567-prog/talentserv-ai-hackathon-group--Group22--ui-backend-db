"use client";

/**
 * SyntheticDataViewer
 * -------------------
 * Tabbed view over the four synthetic-data collections: Patients, Users,
 * Visits, Encounters. Each tab shows the per-record count and a Copy-as-JSON
 * action for that subset. Designed to fit inside the dashboard's
 * "Synthetic Data" results tab.
 *
 * Sub-cards (PatientCard, UserCard, VisitRow, EncounterRow) are intentionally
 * tolerant of missing fields — the lenient Stage 4 schema permits the LLM to
 * omit anything, so every renderer falls back gracefully.
 */

import {
  Activity,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useState } from "react";

import type {
  Encounter,
  Patient,
  SyntheticData,
  User as OpenMrsUser,
  Visit,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";

import { CopyButton } from "./CopyButton";

type CollectionId = "patients" | "users" | "visits" | "encounters";

interface CollectionTab {
  id: CollectionId;
  label: string;
  icon: typeof UserIcon;
}

const COLLECTION_TABS: CollectionTab[] = [
  { id: "patients", label: "Patients", icon: UserIcon },
  { id: "users", label: "Users", icon: Users },
  { id: "visits", label: "Visits", icon: Activity },
  { id: "encounters", label: "Encounters", icon: Stethoscope },
];

export interface SyntheticDataViewerProps {
  data: SyntheticData;
}

export function SyntheticDataViewer({ data }: SyntheticDataViewerProps) {
  // Open the first non-empty tab so the user doesn't land on an empty state.
  const initial = (COLLECTION_TABS.find(
    (t) => (data[t.id] as unknown[]).length > 0,
  )?.id ?? "patients") as CollectionId;
  const [active, setActive] = useState<CollectionId>(initial);

  const counts: Record<CollectionId, number> = {
    patients: data.patients.length,
    users: data.users.length,
    visits: data.visits.length,
    encounters: data.encounters.length,
  };

  const copyTarget: unknown = data[active];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {COLLECTION_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-border bg-background text-muted-foreground hover:border-blue-300 hover:text-blue-700",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    isActive ? "bg-blue-700 text-white" : "bg-muted",
                  )}
                >
                  {counts[id]}
                </span>
              </button>
            );
          })}
        </div>
        <CopyButton
          label="Copy JSON"
          getText={() => JSON.stringify(copyTarget, null, 2)}
          variant="ghost"
        />
      </div>

      {active === "patients" && <PatientsPanel patients={data.patients} />}
      {active === "users" && <UsersPanel users={data.users} />}
      {active === "visits" && <VisitsPanel visits={data.visits} />}
      {active === "encounters" && (
        <EncountersPanel encounters={data.encounters} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panels (per tab)
// ---------------------------------------------------------------------------

function EmptyState({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
      No {what} generated for this requirement.
    </div>
  );
}

function PatientsPanel({ patients }: { patients: Patient[] }) {
  if (patients.length === 0) return <EmptyState what="patients" />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {patients.map((p, i) => (
        <PatientCard key={p.id ?? `patient-${i}`} patient={p} />
      ))}
    </div>
  );
}

function UsersPanel({ users }: { users: OpenMrsUser[] }) {
  if (users.length === 0) return <EmptyState what="users" />;
  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
      {users.map((u, i) => (
        <UserCard key={u.id ?? u.username ?? `user-${i}`} user={u} />
      ))}
    </div>
  );
}

function VisitsPanel({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) return <EmptyState what="visits" />;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {visits.map((v, i) => (
        <VisitRow key={v.id ?? `visit-${i}`} visit={v} />
      ))}
    </ul>
  );
}

function EncountersPanel({ encounters }: { encounters: Encounter[] }) {
  if (encounters.length === 0) return <EmptyState what="encounters" />;
  return (
    <ul className="space-y-2">
      {encounters.map((e, i) => (
        <EncounterRow key={e.id ?? `encounter-${i}`} encounter={e} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sub-cards
// ---------------------------------------------------------------------------

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">
            {patient.name ?? "Unnamed patient"}
          </div>
          <div className="text-xs text-muted-foreground">
            {[patient.gender, patient.birthdate].filter(Boolean).join(" · ") ||
              "No demographics"}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <ShieldCheck className="h-3 w-3" />
          Synthetic
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {patient.identifier && (
          <div>
            <span className="text-muted-foreground">ID: </span>
            <span className="font-mono">{patient.identifier}</span>
          </div>
        )}
        {patient.id && (
          <div className="text-[10px] text-muted-foreground">
            ref: <span className="font-mono">{patient.id}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ user }: { user: OpenMrsUser }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-sm font-medium">
        {user.fullName ?? user.username ?? "Unnamed user"}
      </div>
      {user.username && (
        <div className="font-mono text-xs text-muted-foreground">
          @{user.username}
        </div>
      )}
      {user.role && (
        <div className="mt-2">
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
            {user.role}
          </span>
        </div>
      )}
    </div>
  );
}

function VisitRow({ visit }: { visit: Visit }) {
  return (
    <li className="flex items-center justify-between gap-3 bg-background p-3 text-xs">
      <div className="flex items-center gap-2">
        {visit.status && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              visitStatusClass(visit.status),
            )}
          >
            {visit.status}
          </span>
        )}
        {visit.patientId && (
          <span className="text-muted-foreground">
            patient: <span className="font-mono">{visit.patientId}</span>
          </span>
        )}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">
        {visit.visitDate ?? "—"}
      </div>
    </li>
  );
}

function EncounterRow({ encounter }: { encounter: Encounter }) {
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between text-xs">
        {encounter.type ? (
          <span className="rounded bg-violet-100 px-2 py-0.5 font-medium text-violet-700">
            {encounter.type}
          </span>
        ) : (
          <span className="text-muted-foreground">Encounter</span>
        )}
        {encounter.encounterDate && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {encounter.encounterDate}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {encounter.patientId && (
          <span>
            patient: <span className="font-mono">{encounter.patientId}</span>
          </span>
        )}
        {encounter.visitId && (
          <span>
            visit: <span className="font-mono">{encounter.visitId}</span>
          </span>
        )}
        {encounter.provider && (
          <span>
            provider: <span className="font-mono">{encounter.provider}</span>
          </span>
        )}
      </div>
      {encounter.notes && (
        <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          {encounter.notes}
        </div>
      )}
    </li>
  );
}

function visitStatusClass(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "open" || s === "in-progress")
    return "bg-emerald-100 text-emerald-700";
  if (s === "closed" || s === "completed" || s === "discharged")
    return "bg-zinc-100 text-zinc-700";
  if (s === "scheduled" || s === "pending")
    return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-700";
}
