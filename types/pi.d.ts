export {};

declare global {
  interface PiInitOptions {
    version: string;
    sandbox: boolean;
  }

  interface PiAuthResult {
    accessToken: string;
    user: {
      uid: string;
      username: string;
    };
  }

  interface PiPaymentData {
    amount: number;
    memo?: string;
    metadata?: Record<string, unknown>;
  }

  interface PiPaymentCallbacks {
    onReadyForServerApproval: (paymentId: string) => void;
    onReadyForServerCompletion: (paymentId: string, txid: string) => void;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }

  interface Window {
    Pi?: {
      init: (options: PiInitOptions) => void; // ❗ KHÔNG optional
      authenticate: (scopes: string[]) => Promise<PiAuthResult>;
      createPayment: (
        data: PiPaymentData,
        callbacks: PiPaymentCallbacks
      ) => Promise<void>;
      logout?: () => void;
    };
  }
}
