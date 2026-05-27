/**
 * Deterministic synthetic OpenMRS fixtures from test cases.
 * Skips the Stage 4 LLM round-trip (~10–20s saved per run).
 */

import { COMMON_ROLES } from "./openmrs-reference";
import type { SyntheticData, TestCase } from "./schemas";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function buildSyntheticData(testCases: TestCase[]): SyntheticData {
  if (testCases.length === 0) {
    return {
      patients: [],
      users: [],
      visits: [],
      encounters: [],
      generationNotes: "No test cases — empty fixture set.",
    };
  }

  const roles = unique(
    testCases.flatMap((tc) => tc.openmrsRelevant.roles ?? []),
  ).slice(0, 3);
  const roleFallback = roles[0] ?? COMMON_ROLES[0] ?? "Registration Clerk";

  const users = (roles.length > 0 ? roles : [roleFallback]).map((role, i) => ({
    id: `U${String(i + 1).padStart(3, "0")}`,
    username: role.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, ""),
    role,
    fullName: `${role} Test User`,
  }));

  const patientCount = Math.min(3, Math.max(1, Math.ceil(testCases.length / 4)));
  const patients = Array.from({ length: patientCount }, (_, i) => {
    const n = i + 1;
    return {
      id: `P${String(n).padStart(3, "0")}`,
      name: `Synthia Testington ${n}`,
      gender: n % 2 === 0 ? "F" : "M",
      birthdate: `198${n}-0${n}-15`,
      identifier: `TEST-${String(100000 + n)}`,
      synthetic: true as const,
    };
  });

  const needsVisit = testCases.some((tc) =>
    tc.openmrsRelevant.entities.some((e) =>
      ["Visit", "Encounter", "Obs"].includes(e),
    ),
  );

  const visits = needsVisit
    ? patients.slice(0, 2).map((p, i) => ({
        id: `V${String(i + 1).padStart(3, "0")}`,
        patientId: p.id,
        visitDate: "2026-01-15",
        status: "Active",
      }))
    : [];

  const needsEncounter = testCases.some((tc) =>
    tc.openmrsRelevant.entities.some((e) => ["Encounter", "Obs"].includes(e)),
  );

  const encounters =
    needsEncounter && visits.length > 0
      ? visits.slice(0, 2).map((v, i) => ({
          id: `E${String(i + 1).padStart(3, "0")}`,
          patientId: v.patientId,
          visitId: v.id,
          type: "Consultation",
          encounterDate: "2026-01-15",
          provider: users[0]?.fullName ?? "Provider Test",
        }))
      : [];

  return {
    patients,
    users,
    visits,
    encounters,
    generationNotes:
      "Generated locally from test case roles and entities (no LLM call). All identifiers use TEST- prefix.",
  };
}
