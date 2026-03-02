import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SquarePaymentRequest {
  amount: number; // in smallest currency unit (cents)
  currency: string;
  source_id: string;
  idempotency_key: string;
}

export interface SquareRefundRequest {
  payment_id: string;
  amount: number;
  currency: string;
  idempotency_key: string;
  reason?: string;
}

export interface SquarePaymentResponse {
  payment: {
    id: string;
    status: string;
    receipt_url?: string;
    amount_money: { amount: number; currency: string };
  };
  errors?: Array<{ code: string; detail: string; category: string }>;
}

export interface SquareRefundResponse {
  refund: {
    id: string;
    status: string;
    amount_money: { amount: number; currency: string };
  };
  errors?: Array<{ code: string; detail: string; category: string }>;
}

@Injectable()
export class SquareService {
  private readonly logger = new Logger(SquareService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly locationId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'SQUARE_BASE_URL',
      'https://connect.squareupsandbox.com/v2',
    );
    this.accessToken = this.configService.get<string>('SQUARE_ACCESS_TOKEN', '');
    this.apiVersion = this.configService.get<string>('SQUARE_API_VERSION', '2026-01-22');
    this.locationId = this.configService.get<string>('SQUARE_LOCATION_ID', '');
  }

  private get headers() {
    return {
      'Square-Version': this.apiVersion,
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createPayment(req: SquarePaymentRequest): Promise<SquarePaymentResponse> {
    const body = {
      idempotency_key: req.idempotency_key,
      amount_money: {
        amount: req.amount,
        currency: req.currency,
      },
      source_id: req.source_id,
    };

    this.logger.log(`Creating Square payment: ${req.idempotency_key}`);

    const { data } = await firstValueFrom(
      this.httpService.post<SquarePaymentResponse>(
        `${this.baseUrl}/payments`,
        body,
        { headers: this.headers },
      ),
    );

    return data;
  }

  async refundPayment(req: SquareRefundRequest): Promise<SquareRefundResponse> {
    const body = {
      idempotency_key: req.idempotency_key,
      payment_id: req.payment_id,
      amount_money: {
        amount: req.amount,
        currency: req.currency,
      },
      reason: req.reason,
    };

    this.logger.log(`Creating Square refund for payment: ${req.payment_id}`);

    const { data } = await firstValueFrom(
      this.httpService.post<SquareRefundResponse>(
        `${this.baseUrl}/refunds`,
        body,
        { headers: this.headers },
      ),
    );

    return data;
  }

  async getPayment(paymentId: string): Promise<SquarePaymentResponse> {
    const { data } = await firstValueFrom(
      this.httpService.get<SquarePaymentResponse>(
        `${this.baseUrl}/payments/${paymentId}`,
        { headers: this.headers },
      ),
    );

    return data;
  }
}
