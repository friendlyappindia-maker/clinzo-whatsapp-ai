export type UserRole = 'ADMIN' | 'HOSPITAL_ADMIN' | 'HOSPITAL_COORDINATOR' | 'DOCTOR';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  registration_number?: string;
  phone?: string;
  hospital_id?: number;
  specialization?: string;
  specializations?: HospitalSpecialization[];
  qualifications?: string;
  experience?: string;
  profile_photo?: string;
}

export interface HospitalSpecialization {
  id: number;
  hospital_id: number;
  name: string;
}

export interface Hospital {
  id: number;
  name: string;
  registration_number: string;
  address: string;
  city: string;
  contact_person: string;
  phone: string;
  email: string;
  google_maps_link?: string;
  specializations?: string; // Keep for legacy if needed, but we'll use structured ones
  profile_photo?: string;
}

export type ReferralStatus = 
  | 'CREATED'
  | 'ARRIVED'
  | 'MEDICATION_DONE'
  | 'PACKAGE_PROPOSAL'
  | 'SURGERY_RECOMMENDED'
  | 'SURGERY_SCHEDULED'
  | 'FOLLOW_UP_SURGERY'
  | 'SURGERY_LOST'
  | 'SURGERY_COMPLETED'
  | 'SCHEDULED'
  | 'FOLLOW_UP'
  | 'REVISIT'
  | 'CASE_CLOSED';

export interface Referral {
  id: number;
  patient_name: string;
  patient_mobile: string;
  referring_doctor_id: number;
  hospital_id: number;
  specialist_name?: string;
  specialty?: string;
  status: ReferralStatus;
  diagnosis_summary?: string;
  procedure_recommended?: string;
  treatment_plan?: string;
  surgery_date?: string;
  package_cost?: number;
  discount_value?: number;
  discount_allocation?: 'PATIENT' | 'NGO' | 'RETAINED';
  ngo_id?: number;
  created_at: string;
  updated_at: string;
  hospital_name?: string;
  doctor_name?: string;
  ngo_name?: string;
}

export interface NGO {
  id: number;
  name: string;
  description: string;
}
