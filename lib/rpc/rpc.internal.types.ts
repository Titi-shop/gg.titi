export type JsonObj = Record<string, unknown>;

export type RpcEnvelope = {
  jsonrpc?: string;
  id?: string | number;
  result?: JsonObj;
  error?: {
    code?: number;
    message?: string;
  };
};
