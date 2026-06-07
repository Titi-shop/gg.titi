export type AuthorizeBody = {
  paymentIntentId?: string;
  payment_intent_id?: string;

  piPaymentId?: string;
  pi_payment_id?: string;
};

export type AuthorizeInput = {
  userId: string;
  authorizationHeader: string;
  body: AuthorizeBody;
};

export type AuthorizeResult = {
  success: true;
};
