import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "../utils/logger";
import {
  UserProfile,
  DEFAULT_PROFILE,
  Contact,
  ResumeProfile,
} from "./profile_types";

export class ProfileManager {
  private static instance: ProfileManager;
  private profile: UserProfile | null = null;
  private profilePath: string;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
    const homeDir = os.homedir();
    this.profilePath = path.join(homeDir, ".jarvis", "profile.json");
  }

  public static getInstance(): ProfileManager {
    if (!ProfileManager.instance) {
      ProfileManager.instance = new ProfileManager();
    }
    return ProfileManager.instance;
  }

  public load(): UserProfile {
    if (this.profile) {
      return this.profile;
    }

    const profileDir = path.dirname(this.profilePath);

    if (!fs.existsSync(profileDir)) {
      this.logger.info(`Creating profile directory: ${profileDir}`);
      fs.mkdirSync(profileDir, { recursive: true });
    }

    if (!fs.existsSync(this.profilePath)) {
      this.logger.info(`Profile not found, creating default: ${this.profilePath}`);
      this.createDefaultProfile();
    }

    try {
      const fileContent = fs.readFileSync(this.profilePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      this.profile = this.validateAndMerge(parsed);
      this.logger.info("User profile loaded successfully");
      return this.profile;
    } catch (error) {
      this.logger.error(`Failed to load profile: ${error}`);
      this.createDefaultProfile();
      return this.profile!;
    }
  }

  private createDefaultProfile(): void {
    this.profile = { ...DEFAULT_PROFILE };
    this.save();
    this.logger.info("Default profile created");
  }

  private validateAndMerge(raw: Partial<UserProfile>): UserProfile {
    const validated: UserProfile = {
      identity: {
        name: raw.identity?.name || DEFAULT_PROFILE.identity.name,
        email: raw.identity?.email || DEFAULT_PROFILE.identity.email,
        phone: raw.identity?.phone || DEFAULT_PROFILE.identity.phone,
      },
      contacts: raw.contacts || {},
      preferences: {
        ...DEFAULT_PROFILE.preferences,
        ...raw.preferences,
      },
      resume_profile: {
        ...DEFAULT_PROFILE.resume_profile,
        ...raw.resume_profile,
      },
      app_credentials: raw.app_credentials || {},
      learned_preferences: raw.learned_preferences || {},
      command_history: raw.command_history || [],
    };

    return validated;
  }

  public save(): void {
    if (!this.profile) {
      this.logger.warn("No profile to save");
      return;
    }

    try {
      const dir = path.dirname(this.profilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileContent = JSON.stringify(this.profile, null, 2);
      fs.writeFileSync(this.profilePath, fileContent, "utf-8");
      this.logger.debug("Profile saved");
    } catch (error) {
      this.logger.error(`Failed to save profile: ${error}`);
      throw error;
    }
  }

  public getProfile(): UserProfile {
    if (!this.profile) {
      return this.load();
    }
    return this.profile;
  }

  public getIdentity(): UserProfile["identity"] {
    return this.getProfile().identity;
  }

  public updateIdentity(identity: Partial<UserProfile["identity"]>): void {
    const profile = this.getProfile();
    profile.identity = { ...profile.identity, ...identity };
    this.save();
  }

  public getContacts(): UserProfile["contacts"] {
    return this.getProfile().contacts;
  }

  public getContact(name: string): Contact | undefined {
    return this.getProfile().contacts[name];
  }

  public addContact(name: string, contact: Contact): void {
    const profile = this.getProfile();
    profile.contacts[name] = contact;
    this.save();
  }

  public removeContact(name: string): boolean {
    const profile = this.getProfile();
    if (profile.contacts[name]) {
      delete profile.contacts[name];
      this.save();
      return true;
    }
    return false;
  }

  public getPreferences(): UserProfile["preferences"] {
    return this.getProfile().preferences;
  }

  public getPreference<T>(key: string): T | undefined {
    const prefs = this.getProfile().preferences;
    return prefs[key] as T | undefined;
  }

  public setPreference<T>(key: string, value: T): void {
    const profile = this.getProfile();
    profile.preferences[key] = value;
    this.save();
  }

  public getResumeProfile(): UserProfile["resume_profile"] {
    return this.getProfile().resume_profile;
  }

  public updateResumeProfile(profile: Partial<ResumeProfile>): void {
    const userProfile = this.getProfile();
    userProfile.resume_profile = { ...userProfile.resume_profile, ...profile };
    this.save();
  }

  public getAppCredentials(): UserProfile["app_credentials"] {
    return this.getProfile().app_credentials;
  }

  public setAppCredential(app: string, credentials: UserProfile["app_credentials"][string]): void {
    const profile = this.getProfile();
    profile.app_credentials[app] = credentials;
    this.save();
  }

  public getLearnedPreferences(): UserProfile["learned_preferences"] {
    return this.getProfile().learned_preferences;
  }

  public learnPreference(key: string, value: unknown): void {
    const profile = this.getProfile();
    profile.learned_preferences[key] = value;
    this.save();
  }

  public addToHistory(command: string, success: boolean): void {
    const profile = this.getProfile();
    profile.command_history.push({
      command,
      timestamp: Date.now(),
      success,
    });

    if (profile.command_history.length > 100) {
      profile.command_history = profile.command_history.slice(-100);
    }

    this.save();
  }

  public getCommandHistory(limit = 20): UserProfile["command_history"] {
    const history = this.getProfile().command_history;
    return history.slice(-limit);
  }

  public reload(): UserProfile {
    this.profile = null;
    return this.load();
  }

  public getProfilePath(): string {
    return this.profilePath;
  }
}
