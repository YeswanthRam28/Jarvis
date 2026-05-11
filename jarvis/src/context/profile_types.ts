export interface Contact {
  whatsapp?: string;
  email?: string;
  phone?: string;
}

export interface Contacts {
  [name: string]: Contact;
}

export interface ResumeProfile {
  name: string;
  skills: string[];
  resume_path: string;
  cover_letter_template?: string;
}

export interface AppCredentials {
  stored_session?: boolean;
  oauth?: boolean;
  token_stored?: boolean;
}

export interface AppCredentialStore {
  [app: string]: AppCredentials;
}

export interface LearnedPreferences {
  [key: string]: unknown;
}

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  success: boolean;
}

export interface UserProfile {
  identity: {
    name: string;
    email: string;
    phone: string;
  };
  contacts: Contacts;
  preferences: {
    internship_favourites: string[];
    internship_fields: string[];
    internship_location: string;
    [key: string]: unknown;
  };
  resume_profile: ResumeProfile;
  app_credentials: AppCredentialStore;
  learned_preferences: LearnedPreferences;
  command_history: CommandHistoryEntry[];
}

export const DEFAULT_PROFILE: UserProfile = {
  identity: {
    name: "User",
    email: "",
    phone: "",
  },
  contacts: {},
  preferences: {
    internship_favourites: [],
    internship_fields: [],
    internship_location: "remote",
  },
  resume_profile: {
    name: "",
    skills: [],
    resume_path: "",
  },
  app_credentials: {},
  learned_preferences: {},
  command_history: [],
};
