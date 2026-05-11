import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UIElement {
  type: string;
  name: string;
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  enabled: boolean;
}

function getUIAScript(): string {
  // Use $$ as escape for $, then replace at runtime to avoid TS template literal conflicts
  return `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-UIAXml {
    param($$element, $$depth = 0)
    if ($$depth -gt 10) { return "" }
    $$name = $$element.Current.Name
    $$ctrlType = $$element.Current.LocalizedControlType
    $$rect = $$element.Current.BoundingRectangle
    $$autoId = $$element.Current.AutomationId
    $$isEnabled = $$element.Current.IsEnabled
    $$isOffscreen = $$element.Current.IsOffscreen
    $$indent = "  " * $$depth
    $$xml = "" + $$indent + "<Element"
    if ($$name) { $$xml += " Name='" + [System.Security.SecurityElement]::Escape($$name) + "'" }
    $$xml += " Type='" + [System.Security.SecurityElement]::Escape($$ctrlType) + "'"
    if ($$autoId) { $$xml += " Id='" + [System.Security.SecurityElement]::Escape($$autoId) + "'" }
    $$xml += " Enabled='$$isEnabled' Visible='" + (-not $$isOffscreen) + "'"
    if ($$rect -and $$rect.Width -gt 0 -and $$rect.Height -gt 0) {
        $$xml += " X='" + $$rect.Left + "' Y='" + $$rect.Top + "' Width='" + $$rect.Width + "' Height='" + $$rect.Height + "'"
    }
    $$walker = [System.Windows.Automation.TreeWalker]::ContentViewWalker
    $$child = $$walker.GetFirstChild($$element)
    if ($$child -eq $$null) {
        $$xml += " /"
    } else {
        $$count = 0
        while ($$child -ne $$null -and $$count -lt 150) {
            $$xml += "\`r\`n"
            $$childXml = Get-UIAXml $$child ($$depth + 1)
            if ($$childXml.Trim().Length -gt 0) { $$xml += $$childXml }
            $$child = $$walker.GetNextSibling($$child)
            $$count++
        }
        $$xml += "\`r" + $$indent + "</Element>"
    }
    return $$xml
}

$$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($$focused -eq $$null) { Write-Output "<UIRoot/>"; exit }
$$xml = "<UIRoot>"
$$xml += (Get-UIAXml $$focused 1)
$$xml += "</UIRoot>"
Write-Output $$xml
`.replace(/\$\$/g, '$');
}

export class UIElementExtractor {

  private writeScript(script: string): string {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `jarvis_uia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ps1`);
    fs.writeFileSync(tmpFile, script, 'utf8');
    return tmpFile;
  }

  private execScript(script: string): string {
    const tmpFile = this.writeScript(script);
    try {
      return execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { encoding: 'utf8', timeout: 15000 }
      );
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { }
    }
  }

  async extract(): Promise<UIElement[]> {
    try {
      const xml = await this.getUIAsXML();
      return this.parseUIElementsFromXML(xml);
    } catch (error) {
      console.error('[UIExtractor] UIA extraction failed, falling back to Win32:', error);
      return this.getActiveWindowInfo();
    }
  }

  async getUIAsXML(): Promise<string> {
    return this.execScript(getUIAScript());
  }

  private parseUIElementsFromXML(xml: string): UIElement[] {
    const elements: UIElement[] = [];
    const regex = /<Element\s+([^>]*?)\s*(\/?>)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(xml)) !== null) {
      const attrs = match[1];
      const name = this.extractAttr(attrs, 'Name');
      const type = this.extractAttr(attrs, 'Type') || 'Unknown';
      const id = this.extractAttr(attrs, 'Id');
      const enabled = this.extractAttr(attrs, 'Enabled') !== 'False';
      const visible = this.extractAttr(attrs, 'Visible') !== 'False';
      const x = parseInt(this.extractAttr(attrs, 'X')) || 0;
      const y = parseInt(this.extractAttr(attrs, 'Y')) || 0;
      const width = parseInt(this.extractAttr(attrs, 'Width')) || 0;
      const height = parseInt(this.extractAttr(attrs, 'Height')) || 0;

      elements.push({
        type, name, id,
        x, y, width, height,
        visible, enabled,
      });
    }

    return elements;
  }

  private extractAttr(attrs: string, name: string): string {
    const regex = new RegExp(`${name}='([^']*)'`);
    const match = regex.exec(attrs);
    return match ? match[1] : '';
  }

  private async getActiveWindowInfo(): Promise<UIElement[]> {
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
$rect = New-Object Win32+RECT
[Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
@{
  Window = $sb.ToString()
  X = $rect.Left
  Y = $rect.Top
  Width = $rect.Right - $rect.Left
  Height = $rect.Bottom - $rect.Top
} | ConvertTo-Json
`;

    try {
      const stdout = this.execScript(ps);
      const info = JSON.parse(stdout);
      return [{
        type: 'Window',
        name: info.Window || 'Active Window',
        x: info.X || 0,
        y: info.Y || 0,
        width: info.Width || 800,
        height: info.Height || 600,
        visible: true,
        enabled: true,
      }];
    } catch {
      return [{
        type: 'Unknown',
        name: 'Unknown Window',
        x: 0, y: 0, width: 800, height: 600,
        visible: true, enabled: true,
      }];
    }
  }

  describeUI(xmlOrElements: string | UIElement[]): string {
    if (typeof xmlOrElements === 'string') {
      const elements = this.parseUIElementsFromXML(xmlOrElements);
      return this.formatUIDescription(elements);
    }
    return this.formatUIDescription(xmlOrElements);
  }

  private formatUIDescription(elements: UIElement[]): string {
    if (elements.length === 0) {
      return 'No UI elements detected';
    }

    const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);

    const elementList = sorted
      .filter(el => el.name && el.name.trim())
      .slice(0, 40)
      .map(el => {
        const centerX = el.x + Math.floor(el.width / 2);
        const centerY = el.y + Math.floor(el.height / 2);
        const attr = el.id ? ` id="${el.id}"` : '';
        return `  <${el.type} name="${el.name}"${attr} rect=(${el.x},${el.y},${el.width}x${el.height}) center=(${centerX},${centerY}) enabled=${el.enabled}/>`;
      })
      .join('\n');

    const mainWindow = sorted.find(el => el.type === 'Window');
    const summary = mainWindow
      ? `Active window: "${mainWindow.name}" at (${mainWindow.x},${mainWindow.y}) ${mainWindow.width}x${mainWindow.height}`
      : 'No main window found';

    return `${summary}\nUI Elements (${sorted.length}):\n${elementList}`;
  }

  findElement(elements: UIElement[], target: string): UIElement | null {
    const targetLower = target.toLowerCase();
    for (const el of elements) {
      if (el.name && el.name.toLowerCase().includes(targetLower)) {
        return el;
      }
    }
    return null;
  }

  async takeScreenshot(): Promise<Buffer | null> {
    const timestamp = Date.now();
    const screenshotPath = path.join(os.tmpdir(), `jarvis_screenshot_${timestamp}.png`);

    const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save('${screenshotPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
if (Test-Path '${screenshotPath.replace(/\\/g, '\\\\')}') { Write-Output 'OK' } else { Write-Output 'FAIL' }
`;

    try {
      this.execScript(ps);
      if (fs.existsSync(screenshotPath)) {
        const buffer = fs.readFileSync(screenshotPath);
        try { fs.unlinkSync(screenshotPath); } catch { }
        return buffer;
      }
      return null;
    } catch (error) {
      console.error('[UIExtractor] Screenshot error:', error);
      return null;
    }
  }
}
