export type Tri = "yes" | "no" | "unsure";

export interface Group {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

/** Row from the member_statuses() RPC: never includes anyone's answers. */
export interface MemberStatus {
  member_id: string;
  display_name: string;
  submitted: boolean;
  is_me: boolean;
}

export interface Area {
  id: string;
  name: string;
}

export interface MemberConstraints {
  member_id: string;
  max_rent_share: number;
  needs_lift: boolean;
  needs_parking: boolean;
  min_bathrooms: number;
  needs_pet_friendly: boolean;
  nice_to_haves: string[];
  submitted_at: string | null;
}

export interface AreaRating {
  member_id: string;
  area_id: string;
  acceptable: boolean;
}

export interface Listing {
  id: string;
  area_id: string;
  total_rent: number;
  floor: number;
  url: string | null;
  lift: Tri;
  parking: Tri;
  /** null means "Not sure" */
  bathrooms: number | null;
  pet_friendly: Tri;
  features: Partial<Record<string, Tri>>;
  notes: string | null;
  added_by: string;
  created_at: string;
}

export type ActionState = { error?: string; message?: string } | undefined;
