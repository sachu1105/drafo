export type Approval = {
  id: number;
  approved_by_name: string;
  approved_at: string;
};

export type Comment = {
  id: number;
  author_type: "architect" | "client";
  author_name: string;
  body: string;
  created_at: string;
};

export type DrawingVersion = {
  id: number;
  version_number: number;
  file_name: string;
  file_size: number;
  notes: string;
  uploaded_at: string;
  is_pdf: boolean;
  file_url: string;
  preview_url: string | null;
  approval: Approval | null;
  comments?: Comment[];
  comment_count: number;
};

export type DrawingSet = {
  id: number;
  title: string;
  order: number;
  created_at: string;
  version_count: number;
  current_version: DrawingVersion | null;
  is_approved: boolean;
  versions?: DrawingVersion[];
};

export type MaterialCategory =
  | "flooring"
  | "sanitary"
  | "electrical"
  | "paint"
  | "joinery"
  | "hardware"
  | "furniture"
  | "other";

/**
 * One picture of a material. A tile is a colour, a finish, an edge and how it
 * reads across a whole floor, and one photograph answers about one of those.
 */
export type MaterialPhoto = {
  id: number;
  url: string;
};

export type Material = {
  id: number;
  category: MaterialCategory;
  category_label: string;
  name: string;
  brand: string;
  /** In the order the architect sent them. The first is the thumbnail. */
  photos: MaterialPhoto[];
  /** The bill behind the price, if one was attached. PDF, PNG or JPG. */
  invoice_url: string | null;
  invoice_name: string;
  price: string | null;
  unit: string;
  notes: string;
  selected_at: string | null;
  created_at: string;
};

/**
 * A unit a material can be priced in. Managed in the Django admin, offered in
 * the materials form, and never enforced -- `Material.unit` is free text.
 */
export type Unit = {
  id: number;
  label: string;
};

export type TaxRate = {
  id: number;
  label: string;
  percent: string;
};

export type InvoiceKind = "estimate" | "invoice";
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

/**
 * One row of an invoice.
 *
 * `milestone` and `material` say where the line came from, so the builder can
 * warn that a stage has already been billed. The words and figures are the
 * invoice's own: editing them never reaches back into the project.
 */
export type InvoiceLine = {
  id?: number;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  tax_percent: string;
  order?: number;
  milestone?: number | null;
  material?: number | null;
  /** Worked out by the server. Never sent. */
  amount?: string;
  tax_amount?: string;
  total?: string;
};

/**
 * A bill, or an estimate of one.
 *
 * Nearly every field is a copy of something that lives elsewhere -- the
 * practice name, its address and GSTIN, the client's details. That is the
 * point: an invoice records what was sent on a particular day, so changing a
 * billing address next year must not restate invoices already paid.
 */
export type Invoice = {
  id: number;
  kind: InvoiceKind;
  kind_label: string;
  status: InvoiceStatus;
  status_label: string;
  number: string;
  issued_on: string;
  due_on: string | null;
  from_name: string;
  from_address: string;
  from_gstin: string;
  from_phone: string;
  from_email: string;
  from_bank: string;
  to_name: string;
  to_address: string;
  to_phone: string;
  to_email: string;
  to_gstin: string;
  notes: string;
  terms: string;
  lines: InvoiceLine[];
  subtotal: string;
  tax_total: string;
  total: string;
  client_url: string;
  project_name: string;
  created_at: string;
};

/** The invoice as a row in the list: enough to find it, not to print it. */
export type InvoiceSummary = {
  id: number;
  kind: InvoiceKind;
  kind_label: string;
  status: InvoiceStatus;
  status_label: string;
  number: string;
  issued_on: string;
  due_on: string | null;
  to_name: string;
  total: string;
  client_url: string;
};

/** The invoice as the person paying it reads it. No id, no status. */
export type ClientInvoice = Omit<
  Invoice,
  "id" | "status" | "status_label" | "client_url" | "created_at"
> & {
  logo_url: string | null;
};

export type Milestone = {
  id: number;
  title: string;
  amount: string;
  order: number;
  is_paid: boolean;
  paid_on: string | null;
  created_at: string;
};

export type Practice = {
  practice_name: string;
  phone: string;
  logo_url: string | null;
};

export type ClientProject = {
  name: string;
  client_name: string;
  address: string;
  status: "active" | "on_hold" | "completed";
  updated_at: string;
  practice: Practice;
  drawing_sets: DrawingSet[];
  materials: Material[];
  milestones: Milestone[];
};

export type Project = {
  id: number;
  name: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  address: string;
  status: "active" | "on_hold" | "completed";
  access_token: string;
  client_url: string;
  drawing_set_count: number;
  material_count: number;
  milestone_count: number;
  awaiting_approval_count: number;
  created_at: string;
  updated_at: string;
};

export type Architect = {
  id: number;
  email: string;
  /**
   * Whether they have clicked the link we emailed them. Nothing is gated on
   * it -- an unverified account works exactly like a verified one. It is
   * shown on the profile screen so a typo'd address is findable before a
   * client approval goes missing.
   */
  email_verified: boolean;

  // --- the person ---
  full_name: string;
  profession: string;
  bio: string;
  avatar_url: string | null;
  /** full_name, or the practice name when they have not given one. */
  display_name: string;

  // --- the practice: the letterhead the client sees ---
  practice_name: string;
  logo_url: string | null;

  // --- contact ---
  phone: string;
  location: string;
  website: string;

  // --- the shareable card ---
  /** The band across the top of the card. Not the logo. */
  cover_url: string | null;
  card_slug: string;
  card_url: string | null;
  card_is_public: boolean;

  // --- billing: what goes at the top of an invoice ---
  /** The practice's own GST number. Stamped onto each invoice as it is made. */
  gstin: string;
  billing_address: string;
  bank_details: string;
  /** What a new invoice line starts at. Null means the practice charges none. */
  default_tax_percent: string | null;
  invoice_terms: string;

  /** Only superusers see the admin link; a self-registered account never does. */
  is_staff: boolean;
};

/**
 * The card as anyone holding the link reads it.
 *
 * A narrower shape than Architect on purpose: no id, no card_is_public, and
 * nothing that would let the page be edited from the outside.
 */
export type ProfileCard = {
  name: string;
  profession: string;
  practice_name: string;
  bio: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  avatar_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
  card_slug: string;
};
