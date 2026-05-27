/**
 * Quick-start healthcare requirements for the dashboard.
 * Each story is written in clinical user-story form with OpenMRS-specific
 * acceptance criteria the agent can trace test cases back to.
 */

export type SampleIconId =
  | "user"
  | "stethoscope"
  | "activity"
  | "users"
  | "pill"
  | "shield-check"
  | "heart-pulse"
  | "clipboard"
  | "syringe"
  | "file-search";

export interface SampleRequirement {
  label: string;
  area: string;
  icon: SampleIconId;
  /** One-line tooltip for the quick-start chip. */
  hint: string;
  text: string;
}

export const SAMPLE_REQUIREMENTS: SampleRequirement[] = [
  {
    label: "Patient registration",
    area: "Registration",
    icon: "user",
    hint: "OPD registration, duplicate ID rejection, audit on create",
    text: "As a Registration Clerk at the OPD desk, I want to register a new outpatient with given name, family name, gender, birthdate, address, and a system-generated OpenMRS ID so the clinic can create visits and encounters. The system must reject duplicate identifiers, enforce required demographics, write an audit-log entry on creation, and never display full PHI to users without View Patient privilege.",
  },
  {
    label: "Visit creation",
    area: "Outpatient",
    icon: "stethoscope",
    hint: "Active visit, vitals encounter, triage queue",
    text: "As a Nurse at triage, I want to open a new Outpatient visit for an already-registered patient, attach the active OpenMRS identifier, select the OPD location, and record initial vital signs under a vitals encounter. The visit must remain active until explicitly closed, appear on the Clinician queue, and block vitals entry if no active visit exists.",
  },
  {
    label: "Inpatient admission",
    area: "Admission",
    icon: "activity",
    hint: "Ward admission, diagnosis, discharge workflow",
    text: "As an admitting Doctor on the ward, I want to convert an active Outpatient visit to an Inpatient admission with admission diagnosis (ICD-10 code), expected length of stay, ward, and bed assignment so nursing can record subsequent vitals and the discharge workflow can close the visit cleanly. Re-admission without discharge must be rejected.",
  },
  {
    label: "Vitals & obs",
    area: "Clinical",
    icon: "heart-pulse",
    hint: "Vitals obs, range validation, privilege checks",
    text: "As a Nurse during an active visit, I want to record temperature, pulse, respiratory rate, blood pressure, and SpO₂ as Observations on a Vitals encounter so the Clinician can review trends before consultation. Out-of-range values must trigger a validation warning, values must link to the correct patient and encounter, and historical vitals must not be editable without the Edit Observations privilege.",
  },
  {
    label: "Lab order",
    area: "Orders",
    icon: "clipboard",
    hint: "Lab order on active encounter, catalog validation",
    text: "As a Clinician during consultation, I want to place a laboratory order (test concept, urgency, specimen type, clinical indication) on the active encounter so the lab technician can collect and result it. The order must validate against the facility test catalog, require an active visit, surface a clear error if the patient has no active visit, and appear in the patient's encounter history with ordering provider attribution.",
  },
  {
    label: "Drug order",
    area: "Pharmacy",
    icon: "pill",
    hint: "Formulary dose, allergy conflict, Order Drugs privilege",
    text: "As a Clinician, I want to place a drug order for an Outpatient — drug concept, dose, route, frequency, duration, and indication — so the Pharmacist can dispense from the formulary. The system must block orders that conflict with documented drug allergies on the patient record, validate dose against the formulary, and require the Order Drugs privilege.",
  },
  {
    label: "Immunization",
    area: "Preventive",
    icon: "syringe",
    hint: "Vaccine admin, lot traceability, duplicate-day warning",
    text: "As a Nurse in the immunization clinic, I want to document a vaccine administration (vaccine concept, lot number, site, route, administering clinician, and next-dose due date) on the patient's active visit so public-health reporting can be generated. Duplicate same-day administrations for the same antigen must warn the user, and lot numbers must be captured for traceability.",
  },
  {
    label: "Role-based access",
    area: "RBAC",
    icon: "users",
    hint: "Role provisioning, privilege denial, audit on change",
    text: "As an Administrator, I want to provision a new Clinician user account, assign the Clinician role with minimum-necessary privileges, and verify they cannot access user-management or system-administration screens. Effective privileges must match assigned roles exactly, privilege elevation without audit must fail, and all role changes must produce audit-log entries.",
  },
  {
    label: "Patient search",
    area: "Discovery",
    icon: "file-search",
    hint: "Partial search, PHI masking, access logging",
    text: "As a Registration Clerk, I want to search for patients by identifier, given name, or family name with partial matching so I can avoid duplicate registration. Search results must apply field-level masking for users without full View Patient privilege, never return patients from other facilities when location scoping is enabled, and log search access when the patient record is opened.",
  },
  {
    label: "Audit log review",
    area: "Compliance",
    icon: "shield-check",
    hint: "Filter audit log, CSV export, privilege gate",
    text: "As an Administrator preparing for a compliance review, I want to filter the audit log by patient UUID, user, action type, and date range, then export the slice as CSV with actor, action, entity type, entity UUID, and timestamp columns. Export must require View Audit Log privilege, never include PHI beyond the patient UUID, and reject unbounded date-range queries without explicit confirmation.",
  },
];
