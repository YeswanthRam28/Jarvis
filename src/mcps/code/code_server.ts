export interface CodeResult {
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
}

export class CodeServer {
  async runScript(language: string, code: string): Promise<CodeResult> {
    const startTime = Date.now();

    try {
      if (language === 'javascript' || language === 'js' || language === 'node') {
        const output: string[] = [];

        const sandbox = {
          print: (...args: unknown[]) => output.push(args.map((a) => String(a)).join(' ')),
          printf: (...args: unknown[]) => output.push(args.map((a) => String(a)).join(' ')),
          console: {
            log: (...args: unknown[]) => output.push(args.map((a) => String(a)).join(' ')),
            error: (...args: unknown[]) =>
              output.push('ERROR: ' + args.map((a) => String(a)).join(' ')),
            warn: (...args: unknown[]) =>
              output.push('WARN: ' + args.map((a) => String(a)).join(' ')),
          },
          setTimeout: global.setTimeout,
          setInterval: global.setInterval,
          clearTimeout: global.clearTimeout,
          clearInterval: global.clearInterval,
          Math,
          Date,
          JSON,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Map,
          Set,
          Promise,
        };

        try {
          const fn = new Function(
            'sandbox',
            `
            with (sandbox) {
              ${code}
            }
          `
          );
          fn(sandbox);

          return {
            success: true,
            output: output.join('\n'),
            duration_ms: Date.now() - startTime,
          };
        } catch (err) {
          return {
            success: false,
            output: output.join('\n'),
            error: String(err),
            duration_ms: Date.now() - startTime,
          };
        }
      }

      if (language === 'python' || language === 'python3') {
        return {
          success: false,
          output: '',
          error: 'Python execution not available. Please install python-shell package.',
          duration_ms: Date.now() - startTime,
        };
      }

      return {
        success: false,
        output: '',
        error: `Unsupported language: ${language}. Supported: javascript, js, node`,
        duration_ms: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: String(err),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  async calculate(expression: string): Promise<CodeResult> {
    const startTime = Date.now();

    try {
      const cleanExpr = expression.replace(/what is|calculate/gi, '').trim();
      const result = new Function(`"use strict"; return (${cleanExpr})`)();
      return {
        success: true,
        output: String(result) + ' (calculated)',
        duration_ms: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: String(err),
        duration_ms: Date.now() - startTime,
      };
    }
  }
}
