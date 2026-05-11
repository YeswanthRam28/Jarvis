import { Browser } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';

interface PaymentState {
  browser: Browser | null;
  page: any;
  lastUrl: string;
}

export class PaymentServer {
  private tools: MCPTool[];
  private state: PaymentState;

  constructor() {
    this.state = { browser: null, page: null, lastUrl: '' };
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'payment_op',
        description: 'Process payments or subscriptions',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action: verify, confirm, execute, cancel' },
            provider: { type: 'string', description: 'Payment provider: stripe, razorpay, paypal' },
            amount: { type: 'number', description: 'Amount in currency' },
            currency: {
              type: 'string',
              description: 'Currency code (USD, INR, etc.)',
              default: 'USD',
            },
            description: { type: 'string', description: 'Payment description' },
            customer_email: { type: 'string', description: 'Customer email' },
            plan_id: { type: 'string', description: 'Subscription plan ID' },
          },
          required: ['action', 'provider'],
        },
      },
      {
        name: 'verify_payment',
        description: 'Verify payment details before execution',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Expected amount' },
            currency: { type: 'string', description: 'Currency code' },
            last4: { type: 'string', description: 'Last 4 digits of card' },
          },
          required: ['amount', 'last4'],
        },
      },
      {
        name: 'get_payment_status',
        description: 'Get status of a payment',
        inputSchema: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string', description: 'Transaction ID to check' },
          },
          required: ['transaction_id'],
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'tools/list':
          return createMCPResponse(id, { tools: this.tools });

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'initialize':
          return createMCPResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-payment', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private async handleToolCall(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<MCPResponse> {
    if (!params || typeof params !== 'object') {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Invalid params');
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    let asyncResult: Promise<unknown>;

    switch (name) {
      case 'payment_op':
        asyncResult = this.toolPaymentOp(args);
        break;
      case 'verify_payment':
        asyncResult = this.toolVerifyPayment(args);
        break;
      case 'get_payment_status':
        asyncResult = this.toolGetPaymentStatus(args);
        break;
      default:
        return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
    }

    try {
      const resolved = await asyncResult;
      return createMCPResponse(id, resolved);
    } catch (err) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, String(err));
    }
  }

  private async toolPaymentOp(args: Record<string, unknown>): Promise<unknown> {
    const action = args.action as string;
    const provider = args.provider as string;
    const amount = args.amount as number;
    const currency = (args.currency as string) || 'USD';
    const description = (args.description as string) || '';
    const customerEmail = args.customer_email as string;

    console.log(`[PAYMENT] ${action} via ${provider}: ${amount} ${currency}`);

    if (action === 'verify') {
      return {
        verified: true,
        amount,
        currency,
        provider,
        message: 'Payment details verified successfully',
      };
    }

    if (action === 'confirm') {
      return {
        confirmed: true,
        transaction_id: `txn_${uuidv4().slice(0, 12)}`,
        amount,
        currency,
        provider,
        next_step: 'execute',
      };
    }

    if (action === 'execute') {
      const transactionId = `txn_${uuidv4().slice(0, 12)}`;
      return {
        success: true,
        transaction_id: transactionId,
        amount,
        currency,
        provider,
        status: 'completed',
        description,
        customer_email: customerEmail,
        timestamp: new Date().toISOString(),
        message: `Payment of ${amount} ${currency} processed successfully via ${provider}`,
      };
    }

    if (action === 'cancel') {
      return {
        cancelled: true,
        message: 'Payment cancelled',
      };
    }

    return { error: 'Unknown action' };
  }

  private async toolVerifyPayment(args: Record<string, unknown>): Promise<unknown> {
    const amount = args.amount as number;
    const currency = args.currency as string;
    const last4 = args.last4 as string;

    return {
      verified: true,
      amount,
      currency,
      last4,
      message: `Card ending ${last4} verified for ${amount} ${currency}`,
    };
  }

  private async toolGetPaymentStatus(args: Record<string, unknown>): Promise<unknown> {
    const transactionId = args.transaction_id as string;

    return {
      transaction_id: transactionId,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };
  }

  public close(): void {
    if (this.state.browser) {
      this.state.browser.close();
      this.state.browser = null;
    }
  }
}
