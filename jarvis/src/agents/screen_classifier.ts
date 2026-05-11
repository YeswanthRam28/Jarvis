export interface ScreenClassification {
  appName: string | null;
  isTargetApp: boolean;
  canProceed: boolean;
  nextAction: string | null;
}

export class ScreenClassifier {
  
  classify(screenshot: Buffer | null, windowTitle: string, uiElements: any[]): ScreenClassification {
    // Classify based on window title and UI elements
    const targetApps = ['whatsapp', 'telegram', 'discord', 'mail', 'outlook', 'notepad', 'spotify'];
    
    const titleLower = windowTitle.toLowerCase();
    const matchedApp = targetApps.find(app => titleLower.includes(app));

    return {
      appName: matchedApp || (windowTitle || 'Unknown'),
      isTargetApp: !!matchedApp,
      canProceed: true,
      nextAction: null,
    };
  }

  getTargetAppFromTask(task: string): string | null {
    const taskLower = task.toLowerCase();
    
    const appMap: Record<string, string[]> = {
      'whatsapp': ['whatsapp', 'whatsapp web'],
      'telegram': ['telegram'],
      'discord': ['discord'],
      'email': ['mail', 'outlook', 'gmail'],
      'notepad': ['notepad', 'text editor'],
      'spotify': ['spotify', 'music'],
    };

    for (const [app, keywords] of Object.entries(appMap)) {
      if (keywords.some(kw => taskLower.includes(kw))) {
        return app;
      }
    }

    return null;
  }

  isAppOpen(classification: ScreenClassification, targetApp: string): boolean {
    if (!targetApp) return true;
    return classification.appName?.toLowerCase().includes(targetApp.toLowerCase()) || false;
  }
}