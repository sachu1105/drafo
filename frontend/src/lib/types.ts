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

export type Material = {
  id: number;
  category: MaterialCategory;
  category_label: string;
  name: string;
  brand: string;
  photo_url: string | null;
  /** The bill behind the price, if one was attached. PDF, PNG or JPG. */
  invoice_url: string | null;
  invoice_name: string;
  price: string | null;
  unit: string;
  notes: string;
  selected_at: string | null;
  created_at: string;
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
