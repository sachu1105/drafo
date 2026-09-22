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
  practice_name: string;
  phone: string;
  logo_url: string | null;
  /** Only superusers see the admin link; a self-registered account never does. */
  is_staff: boolean;
};
