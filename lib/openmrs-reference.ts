/**
 * OpenMRS Domain Reference
 * ------------------------
 * Single source of truth for OpenMRS concepts, roles, workflows, and privacy
 * rules used by the AI test-automation agent.
 *
 * Why this file exists:
 *  - Test cases, synthetic data, and automation skeletons must all be grounded
 *    in the *real* OpenMRS data model (Patient, Visit, Encounter, Obs, ...).
 *  - The agent prompts and the Zod schemas (`lib/schemas.ts`) reference the
 *    constants here so naming stays consistent end-to-end.
 *  - Privacy/security rules below are enforced as guardrails — the agent must
 *    never emit PHI and must always assume role/privilege checks.
 *
 * Conventions:
 *  - Every collection is declared `as const` so TypeScript can derive precise
 *    string-literal unions (used by Zod enums downstream).
 *  - Identifiers loosely follow OpenMRS REST / core conventions; they are
 *    intentionally lightweight for prompt grounding, not a full ORM.
 *
 * References:
 *  - OpenMRS Data Model: https://wiki.openmrs.org/display/docs/Data+Model
 *  - OpenMRS REST API:   https://rest.openmrs.org
 */

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

/**
 * The canonical OpenMRS entities the agent reasons about.
 * Order roughly reflects the dependency graph (Patient before Visit, etc.).
 */
export const OPENMRS_ENTITIES = [
  "Patient",
  "PatientIdentifier",
  "Visit",
  "Encounter",
  "Obs",
  "User",
  "Role",
  "Privilege",
] as const;

export type OpenMrsEntity = (typeof OPENMRS_ENTITIES)[number];

/**
 * Lightweight, human-readable description of each entity. Used by the agent
 * when explaining test coverage and by the dashboard tooltips.
 *
 * Field lists below are the *minimum* fields the agent must populate when
 * generating synthetic data. They mirror the most-used columns in OpenMRS core
 * tables but are deliberately simplified.
 */
export const OPENMRS_ENTITY_DEFINITIONS: Record<
  OpenMrsEntity,
  {
    description: string;
    keyFields: readonly string[];
    /** OpenMRS REST resource path, useful when scaffolding API tests. */
    restResource: string;
  }
> = {
  Patient: {
    description:
      "A person receiving care. Composed of a Person (demographics) plus one or more PatientIdentifiers.",
    keyFields: [
      "uuid",
      "givenName",
      "familyName",
      "gender",
      "birthdate",
      "addresses",
      "identifiers",
    ],
    restResource: "/ws/rest/v1/patient",
  },
  PatientIdentifier: {
    description:
      "A typed identifier issued to a patient (e.g. OpenMRS ID, National ID). A patient may have several.",
    keyFields: [
      "uuid",
      "identifier",
      "identifierType",
      "location",
      "preferred",
    ],
    restResource: "/ws/rest/v1/patient/{patientUuid}/identifier",
  },
  Visit: {
    description:
      "A contiguous period during which a patient is at a location (Outpatient, Inpatient, Emergency, ...). Contains one or more Encounters.",
    keyFields: [
      "uuid",
      "patient",
      "visitType",
      "startDatetime",
      "stopDatetime",
      "location",
      "indication",
    ],
    restResource: "/ws/rest/v1/visit",
  },
  Encounter: {
    description:
      "A single clinical interaction within a Visit (Vitals, Consultation, Admission, Discharge, ...). Owns the Obs collected during that interaction.",
    keyFields: [
      "uuid",
      "patient",
      "visit",
      "encounterType",
      "encounterDatetime",
      "location",
      "providers",
      "form",
    ],
    restResource: "/ws/rest/v1/encounter",
  },
  Obs: {
    description:
      "A single observation: a Concept (question) paired with a typed value (numeric, coded, text, datetime, ...). Obs may be grouped.",
    keyFields: [
      "uuid",
      "concept",
      "value",
      "obsDatetime",
      "encounter",
      "person",
      "obsGroup",
    ],
    restResource: "/ws/rest/v1/obs",
  },
  User: {
    description:
      "An authenticated actor in the system. Wraps a Person and has one or more Roles.",
    keyFields: ["uuid", "username", "person", "roles", "retired"],
    restResource: "/ws/rest/v1/user",
  },
  Role: {
    description:
      "A named bundle of Privileges. Roles can inherit from other roles.",
    keyFields: ["uuid", "name", "description", "privileges", "inheritedRoles"],
    restResource: "/ws/rest/v1/role",
  },
  Privilege: {
    description:
      "An atomic permission (e.g. 'Add Patients', 'View Encounters'). Granted to Roles, never directly to Users.",
    keyFields: ["uuid", "name", "description"],
    restResource: "/ws/rest/v1/privilege",
  },
};

// ---------------------------------------------------------------------------
// Controlled vocabularies (visit/encounter/identifier types, genders, ...)
// ---------------------------------------------------------------------------

export const GENDERS = ["M", "F", "U"] as const;
export type Gender = (typeof GENDERS)[number];

/** Standard OpenMRS reference application visit types. */
export const VISIT_TYPES = [
  "Outpatient",
  "Inpatient",
  "Emergency",
  "Telehealth",
  "Home Visit",
] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

/** Standard OpenMRS reference application encounter types. */
export const ENCOUNTER_TYPES = [
  "Registration",
  "Vitals",
  "Consultation",
  "Admission",
  "Discharge",
  "Transfer",
  "Lab Order",
  "Lab Result",
  "Drug Order",
] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

/** Common identifier types seen in OpenMRS deployments. */
export const IDENTIFIER_TYPES = [
  "OpenMRS ID",
  "National ID",
  "MRN",
  "Old Identification Number",
  "Passport Number",
] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

/** Obs value data types (mirrors `concept.datatype`). */
export const OBS_VALUE_TYPES = [
  "numeric",
  "coded",
  "text",
  "boolean",
  "datetime",
] as const;
export type ObsValueType = (typeof OBS_VALUE_TYPES)[number];

// ---------------------------------------------------------------------------
// Roles & privileges
// ---------------------------------------------------------------------------

/**
 * Common application-level roles in an OpenMRS deployment.
 *
 * These are the roles the agent should generate tests *for*. They map onto
 * real-world clinic personas and each one has a distinct, minimally-scoped
 * set of privileges (principle of least privilege).
 */
export const COMMON_ROLES = [
  "Registration Clerk",
  "Nurse",
  "Clinician",
  "Doctor",
  "Administrator",
] as const;
export type CommonRole = (typeof COMMON_ROLES)[number];

/**
 * Canonical OpenMRS privilege names referenced in tests. Not exhaustive —
 * extend as new flows are covered. Naming follows OpenMRS core conventions
 * ("Verb Resource", title-cased).
 */
export const PRIVILEGES = [
  // Patient
  "Add Patients",
  "Edit Patients",
  "View Patients",
  "Delete Patients",
  // Visit
  "Add Visits",
  "Edit Visits",
  "View Visits",
  "Delete Visits",
  // Encounter
  "Add Encounters",
  "Edit Encounters",
  "View Encounters",
  "Delete Encounters",
  // Obs
  "Add Observations",
  "Edit Observations",
  "View Observations",
  // Users / RBAC
  "Manage Users",
  "Manage Roles",
  "Manage Privileges",
  // System
  "View Audit Log",
  "Manage Concepts",
] as const;
export type Privilege = (typeof PRIVILEGES)[number];

/**
 * Default privilege bundles per role. Used by the synthetic-data generator
 * (to create realistic User+Role rows) and by RBAC negative tests (to assert
 * that a Nurse cannot, say, Manage Users).
 *
 * Keep this conservative: it should match what a *real* clinic would assign.
 */
export const ROLE_PRIVILEGES: Record<CommonRole, readonly Privilege[]> = {
  "Registration Clerk": [
    "Add Patients",
    "Edit Patients",
    "View Patients",
    "Add Visits",
    "View Visits",
  ],
  Nurse: [
    "View Patients",
    "View Visits",
    "Add Encounters",
    "Edit Encounters",
    "View Encounters",
    "Add Observations",
    "Edit Observations",
    "View Observations",
  ],
  Clinician: [
    "View Patients",
    "View Visits",
    "Add Encounters",
    "Edit Encounters",
    "View Encounters",
    "Add Observations",
    "Edit Observations",
    "View Observations",
  ],
  Doctor: [
    "View Patients",
    "Edit Patients",
    "Add Visits",
    "Edit Visits",
    "View Visits",
    "Add Encounters",
    "Edit Encounters",
    "View Encounters",
    "Add Observations",
    "Edit Observations",
    "View Observations",
  ],
  Administrator: [
    // Administrators are deliberately *not* clinicians: they manage RBAC
    // and configuration but should not chart patient data in production.
    "View Patients",
    "Manage Users",
    "Manage Roles",
    "Manage Privileges",
    "View Audit Log",
    "Manage Concepts",
  ],
};

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

/**
 * High-level clinical workflows the agent must be able to test end-to-end.
 *
 * Each workflow lists the OpenMRS entities it touches plus the role(s) that
 * typically drive it. The agent uses this to:
 *   1. Pick the right persona when generating UI-driven Playwright tests.
 *   2. Decide which entities need synthetic data.
 *   3. Build traceability from requirement → workflow → test cases.
 */
export interface OpenMrsWorkflow {
  /** Stable kebab-case id; safe to use in URLs and filenames. */
  id: string;
  name: string;
  description: string;
  /** Roles that typically *initiate* this workflow. */
  primaryRoles: readonly CommonRole[];
  /** Ordered, high-level steps — not test steps. */
  steps: readonly string[];
  /** Entities touched, used for coverage reporting. */
  entitiesTouched: readonly OpenMrsEntity[];
}

export const OPENMRS_WORKFLOWS: readonly OpenMrsWorkflow[] = [
  {
    id: "patient-registration",
    name: "Patient Registration",
    description:
      "Register a new patient with demographics, identifiers, and address.",
    primaryRoles: ["Registration Clerk"],
    steps: [
      "Capture demographics (name, gender, birthdate)",
      "Generate or enter PatientIdentifier(s)",
      "Capture address and contact info",
      "Persist Patient and verify uniqueness of identifiers",
    ],
    entitiesTouched: ["Patient", "PatientIdentifier"],
  },
  {
    id: "outpatient-visit",
    name: "Outpatient Visit",
    description:
      "Start an Outpatient visit, record vitals and a consultation, then close the visit.",
    primaryRoles: ["Registration Clerk", "Nurse", "Clinician"],
    steps: [
      "Start a Visit of type Outpatient at a Location",
      "Create a Vitals Encounter with Obs (BP, HR, Temp, Weight)",
      "Create a Consultation Encounter with diagnoses",
      "End the Visit",
    ],
    entitiesTouched: ["Patient", "Visit", "Encounter", "Obs"],
  },
  {
    id: "inpatient-admission-discharge",
    name: "Inpatient Admission & Discharge",
    description:
      "Admit a patient, manage ward encounters, and discharge with summary.",
    primaryRoles: ["Doctor", "Nurse"],
    steps: [
      "Create Admission Encounter under an Inpatient Visit",
      "Record ongoing Vitals/Obs throughout the stay",
      "Capture orders (Lab Order, Drug Order)",
      "Create Discharge Encounter and stop the Visit",
    ],
    entitiesTouched: ["Patient", "Visit", "Encounter", "Obs"],
  },
  {
    id: "encounter-obs-recording",
    name: "Encounter & Observation Recording",
    description:
      "Record Obs (numeric/coded/text/datetime) against an Encounter, with grouping.",
    primaryRoles: ["Nurse", "Clinician", "Doctor"],
    steps: [
      "Open an existing Encounter",
      "Add Obs with proper Concept and typed value",
      "Group related Obs (e.g. blood pressure systolic + diastolic)",
      "Edit or void Obs with a reason",
    ],
    entitiesTouched: ["Encounter", "Obs"],
  },
  {
    id: "user-role-management",
    name: "User & Role Management",
    description:
      "Administer Users, Roles, and Privileges; enforce least-privilege.",
    primaryRoles: ["Administrator"],
    steps: [
      "Create a User and link to a Person",
      "Assign one or more Roles",
      "Adjust Role privileges and inheritance",
      "Retire or unretire users",
    ],
    entitiesTouched: ["User", "Role", "Privilege"],
  },
  {
    id: "audit-and-reporting",
    name: "Auditing & Reporting",
    description:
      "Review audit trail of who did what to which patient record, and when.",
    primaryRoles: ["Administrator"],
    steps: [
      "Filter audit log by user, date range, or patient",
      "Verify create/update/void actions are recorded",
      "Export audit slice for compliance review",
    ],
    entitiesTouched: ["User", "Patient", "Encounter", "Obs"],
  },
] as const;

export type OpenMrsWorkflowId = (typeof OPENMRS_WORKFLOWS)[number]["id"];

// ---------------------------------------------------------------------------
// Test categories
// ---------------------------------------------------------------------------

/**
 * The six test categories the agent must produce for *every* requirement.
 *
 * Definitions are written tightly so the model has unambiguous guidance:
 *   - Functional  → happy-path business rules
 *   - Negative    → invalid inputs / failure paths
 *   - Validation  → field-level validation rules (formats, ranges, required)
 *   - Security    → authn/authz, RBAC, injection, tampering
 *   - Privacy     → PHI handling, masking, minimum-necessary disclosure
 *   - Audit       → traceability and audit-log assertions
 */
export const TEST_CATEGORIES = [
  "Functional",
  "Negative",
  "Validation",
  "Security",
  "Privacy",
  "Audit",
] as const;
export type TestCategory = (typeof TEST_CATEGORIES)[number];

export const TEST_CATEGORY_GUIDANCE: Record<TestCategory, string> = {
  Functional:
    "Happy-path scenarios that prove the requirement works end-to-end across the OpenMRS entities involved.",
  Negative:
    "Invalid inputs, missing required fields, conflicting state, and downstream failure handling.",
  Validation:
    "Field-level rules: required, format (dates, identifiers, phone), ranges (vitals), allowed enum values.",
  Security:
    "Authentication, RBAC (role + privilege), CSRF, IDOR, SQL/NoSQL injection, session handling.",
  Privacy:
    "PHI is never exposed beyond minimum necessary; correct masking, redaction, and consent enforcement.",
  Audit:
    "Every create/update/void produces an audit-log entry with actor, timestamp, entity, and action.",
};

export const TEST_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type TestPriority = (typeof TEST_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Privacy & security rules (guardrails)
// ---------------------------------------------------------------------------

/**
 * Fields considered Protected Health Information (PHI) / PII in this context.
 * The agent MUST treat these as fake-only and the synthetic-data generator
 * MUST never emit values that resemble real-world records.
 */
export const PHI_FIELDS = [
  "givenName",
  "familyName",
  "middleName",
  "birthdate",
  "address",
  "phone",
  "email",
  "nationalId",
  "passportNumber",
  "mrn",
] as const;
export type PhiField = (typeof PHI_FIELDS)[number];

/**
 * Non-negotiable guardrails. These are enforced both by prompts (instructing
 * the model) and by validation (the Safety Checklist in the agent output).
 *
 * Each rule has a stable `id` so test results can reference it directly.
 */
export interface SafetyRule {
  id: string;
  title: string;
  description: string;
  /** "must" = hard requirement (blocks output); "should" = warning. */
  severity: "must" | "should";
}

export const PRIVACY_SECURITY_RULES: readonly SafetyRule[] = [
  {
    id: "no-real-phi",
    title: "No real PHI",
    description:
      "All patient names, identifiers, addresses, and contact info MUST be synthetic. Reject anything resembling a real person.",
    severity: "must",
  },
  {
    id: "synthetic-identifiers",
    title: "Synthetic identifiers only",
    description:
      "PatientIdentifier values must be obviously fake (e.g. prefixed with 'TEST-' or use OpenMRS check-digit algorithm with random source).",
    severity: "must",
  },
  {
    id: "rbac-enforced",
    title: "Role-based access enforced",
    description:
      "Every protected action must check the appropriate Privilege. Tests must include a negative case for an under-privileged Role.",
    severity: "must",
  },
  {
    id: "audit-trail-required",
    title: "Audit trail required",
    description:
      "Create, update, and void operations on Patient/Encounter/Obs must produce an audit entry. Generated tests must assert this.",
    severity: "must",
  },
  {
    id: "minimum-necessary",
    title: "Minimum-necessary disclosure",
    description:
      "List and detail views must not return PHI beyond what the workflow requires. Mask or omit otherwise.",
    severity: "should",
  },
  {
    id: "no-phi-in-logs",
    title: "No PHI in logs",
    description:
      "Application logs and error responses must not contain PHI. Tests should attempt to provoke PHI leakage and assert absence.",
    severity: "should",
  },
  {
    id: "session-and-csrf",
    title: "Session and CSRF protection",
    description:
      "Authenticated routes must require a valid session and CSRF token where applicable.",
    severity: "must",
  },
  {
    id: "input-sanitization",
    title: "Input sanitization",
    description:
      "Free-text fields (Obs text, addresses, names) must be sanitized against XSS and SQL/NoSQL injection.",
    severity: "must",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the privileges granted to a role, including inherited ones.
 * Today this is just a passthrough (we don't model inheritance yet), but
 * callers should use this function so future inheritance is transparent.
 */
export function getPrivilegesForRole(role: CommonRole): readonly Privilege[] {
  return ROLE_PRIVILEGES[role];
}

/** Returns true if a role currently holds a given privilege. */
export function roleHasPrivilege(
  role: CommonRole,
  privilege: Privilege,
): boolean {
  return getPrivilegesForRole(role).includes(privilege);
}

/** Lookup a workflow by its id. */
export function getWorkflow(
  id: OpenMrsWorkflowId,
): OpenMrsWorkflow | undefined {
  return OPENMRS_WORKFLOWS.find((w) => w.id === id);
}

/**
 * Convenience: every "must" safety rule. Useful when building the Safety
 * Checklist — these all need to pass before output is released.
 */
export const REQUIRED_SAFETY_RULES = PRIVACY_SECURITY_RULES.filter(
  (r) => r.severity === "must",
);
