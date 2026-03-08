// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: packages/shared/openapi/openapi.yaml
// Generator: frontend/scripts/generate_api_client.py

import type { AxiosInstance, AxiosRequestConfig } from "axios";

export type ApiMessage = { message: string; };
export type ErrorDetail = { code: string; message: string; details?: Record<string, unknown>[] | null; };
export type ErrorResponse = { error: ErrorDetail; };
export type ConsentInput = { policy_type: "privacy" | "terms"; policy_version: string; };
export type SignupRequest = { email: string; password: string; full_name?: string | null; phone?: string | null; jurisdiction_code?: string; consents: ConsentInput[]; };
export type SignupResponse = { message: string; };
export type LoginRequest = { email: string; password: string; };
export type RefreshRequest = { refresh_token: string; };
export type LogoutRequest = { refresh_token: string; };
export type EmailVerificationRequest = { token: string; };
export type PasswordResetRequest = { email: string; };
export type PasswordResetConfirmRequest = { token: string; new_password: string; };
export type RecoveryRequest = { email: string; mode: "primary_email" | "backup_email" | "trusted_contact"; trusted_contact_email?: string | null; };
export type RecoveryAssistRequest = { approval_token: string; };
export type RecoveryConfirmRequest = { recovery_token: string; new_password: string; };
export type JurisdictionConfirmRequest = { jurisdiction_code: string; };
export type RecoveryRequestResponse = { message: string; recovery_token?: string | null; approval_token?: string | null; };
export type RecoveryAssistResponse = { message: string; };
export type UserSessionResponse = { id: string; email: string; email_verified: boolean; };
export type TokenPair = { access_token: string; access_token_expires_at: string; refresh_token: string; refresh_token_expires_at: string; };
export type UploadInitRequest = { doc_type: string; size_bytes: number; content_type?: string; sha256?: string | null; };
export type UploadInitResponse = { document_id: string; version_id: string; version_no: number; object_key: string; upload_url: string; upload_url_expires_in_seconds: number; plaintext_dek_b64: string; kms_key_id: string; };
export type ScanDispatchResponse = { version_id: string; status: string; };
export type DocumentDownloadResponse = { download_url: string; expires_in_seconds: number; };
export type GrantCreateRequest = { trusted_contact_id: string; granted_reason?: string | null; expires_in_hours?: number | null; };
export type ExportJobResponse = { id: string; status: "queued" | "processing" | "ready" | "failed" | "expired"; };
export type ExportTokenResponse = { one_time_token: string; expires_at: string; };
export type ExportDownloadResponse = { download_url: string; expires_in_seconds: number; one_time_token?: string | null; };
export type PacketGenerateRequest = { platform: string; };
export type PacketJobResponse = { id: string; status: "queued" | "running" | "ready" | "failed"; platform: string; };
export type PaymentCheckoutRequest = { amount_paise: number; currency?: string; };
export type PaymentCheckoutResponse = { order_id: string; amount_paise: number; currency: string; status: "created" | "authorized" | "captured" | "failed" | "refunded"; };
export type PaymentWebhookRequest = { event_id?: string | null; order_id: string; payment_id?: string | null; status: string; event_sequence: number; };
export type PaymentWebhookResponse = { accepted: boolean; processed: boolean; reason: string; status?: string | null; };
export type PaymentStatusResponse = { order_id: string; payment_id?: string | null; status: "created" | "authorized" | "captured" | "failed" | "refunded"; event_sequence: number; };
export type LegalPolicyCreateRequest = { policy_type: "privacy" | "terms"; version: string; effective_from: string; checksum: string; is_active?: boolean; };
export type LegalPolicyResponse = { id: string; policy_type: "privacy" | "terms"; version: string; effective_from: string; is_active: boolean; checksum: string; };
export type TrustedContactCreateRequest = { name: string; email: string; role: "viewer" | "packet_access" | "recovery_assist"; recovery_enabled?: boolean; };
export type TrustedContactInviteRequest = { force_reissue?: boolean; };
export type TrustedContactResponse = { id: string; name: string; email: string; role: "viewer" | "packet_access" | "recovery_assist"; status: "pending" | "active" | "revoked"; };
export type InventoryCreateRequest = { platform: string; category: string; username_hint?: string | null; importance_level?: number; };
export type InventoryResponse = { id: string; platform: string; category: string; username_hint?: string | null; importance_level: number; };

export interface ConfirmJurisdictionArgs {
  body: JurisdictionConfirmRequest;
}

export interface LoginArgs {
  body: LoginRequest;
}

export interface LogoutArgs {
  body: LogoutRequest;
}

export interface PasswordResetConfirmArgs {
  body: PasswordResetConfirmRequest;
}

export interface PasswordResetRequestArgs {
  body: PasswordResetRequest;
}

export interface RecoveryAssistArgs {
  body: RecoveryAssistRequest;
}

export interface RecoveryConfirmArgs {
  body: RecoveryConfirmRequest;
}

export interface RecoveryRequestArgs {
  body: RecoveryRequest;
}

export interface RefreshSessionArgs {
  body: RefreshRequest;
}

export interface SignupArgs {
  body: SignupRequest;
}

export interface VerifyEmailArgs {
  body: EmailVerificationRequest;
}

export interface InitDocumentUploadArgs {
  body: UploadInitRequest;
}

export interface QueueDocumentScanArgs {
  versionId: string;
}

export interface SoftDeleteDocumentArgs {
  documentId: string;
}

export interface GetDocumentDownloadUrlArgs {
  documentId: string;
  trustedContactId?: string;
}

export interface CreateDocumentGrantArgs {
  documentId: string;
  body: GrantCreateRequest;
}

export interface InitDocumentVersionUploadArgs {
  documentId: string;
  body: UploadInitRequest;
}

export interface GetExportStatusArgs {
  exportJobId: string;
}

export interface OwnerExportDownloadArgs {
  exportJobId: string;
}

export interface TokenExportDownloadArgs {
  exportJobId: string;
  token: string;
}

export interface IssueExportTokenArgs {
  exportJobId: string;
}

export interface CreateInventoryAccountArgs {
  body: InventoryCreateRequest;
}

export interface CreatePolicyArgs {
  body: LegalPolicyCreateRequest;
}

export interface CreatePacketJobArgs {
  body: PacketGenerateRequest;
}

export interface GetPacketJobArgs {
  packetJobId: string;
}

export interface CreateCheckoutArgs {
  body: PaymentCheckoutRequest;
}

export interface PaymentWebhookArgs {
  xRazorpaySignature: string;
  body: PaymentWebhookRequest;
}

export interface GetPaymentArgs {
  orderId: string;
}

export interface CreateTrustedContactArgs {
  body: TrustedContactCreateRequest;
}

export interface AcceptTrustedContactInviteArgs {
  token: string;
}

export interface RevokeTrustedContactArgs {
  trustedContactId: string;
}

export interface InviteTrustedContactArgs {
  trustedContactId: string;
  body: TrustedContactInviteRequest;
}

export class VarasaanApiClient {
  public constructor(private readonly http: AxiosInstance) {}

  private async request<TResponse>(config: AxiosRequestConfig): Promise<TResponse> {
    const response = await this.http.request<TResponse>(config);
    return response.data;
  }

  public async confirmJurisdiction(args: ConfirmJurisdictionArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/jurisdiction/confirm`,
      data: args.body,
    });
  }

  public async login(args: LoginArgs, config: AxiosRequestConfig = {}): Promise<TokenPair> {
    return this.request<TokenPair>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/login`,
      data: args.body,
    });
  }

  public async logout(args: LogoutArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/logout`,
      data: args.body,
    });
  }

  public async logoutAll(config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/logout-all`,
    });
  }

  public async currentUser(config: AxiosRequestConfig = {}): Promise<UserSessionResponse> {
    return this.request<UserSessionResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/auth/me`,
    });
  }

  public async passwordResetConfirm(args: PasswordResetConfirmArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/password-reset/confirm`,
      data: args.body,
    });
  }

  public async passwordResetRequest(args: PasswordResetRequestArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/password-reset/request`,
      data: args.body,
    });
  }

  public async recoveryAssist(args: RecoveryAssistArgs, config: AxiosRequestConfig = {}): Promise<RecoveryAssistResponse> {
    return this.request<RecoveryAssistResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/recovery/assist`,
      data: args.body,
    });
  }

  public async recoveryConfirm(args: RecoveryConfirmArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/recovery/confirm`,
      data: args.body,
    });
  }

  public async recoveryRequest(args: RecoveryRequestArgs, config: AxiosRequestConfig = {}): Promise<RecoveryRequestResponse> {
    return this.request<RecoveryRequestResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/recovery/request`,
      data: args.body,
    });
  }

  public async refreshSession(args: RefreshSessionArgs, config: AxiosRequestConfig = {}): Promise<TokenPair> {
    return this.request<TokenPair>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/refresh`,
      data: args.body,
    });
  }

  public async signup(args: SignupArgs, config: AxiosRequestConfig = {}): Promise<SignupResponse> {
    return this.request<SignupResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/signup`,
      data: args.body,
    });
  }

  public async verifyEmail(args: VerifyEmailArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/auth/verify-email`,
      data: args.body,
    });
  }

  public async initDocumentUpload(args: InitDocumentUploadArgs, config: AxiosRequestConfig = {}): Promise<UploadInitResponse> {
    return this.request<UploadInitResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/documents/uploads/init`,
      data: args.body,
    });
  }

  public async queueDocumentScan(args: QueueDocumentScanArgs, config: AxiosRequestConfig = {}): Promise<ScanDispatchResponse> {
    return this.request<ScanDispatchResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/documents/versions/${encodeURIComponent(String(args.versionId))}/scan`,
    });
  }

  public async softDeleteDocument(args: SoftDeleteDocumentArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "DELETE",
      url: `/api/v1/documents/${encodeURIComponent(String(args.documentId))}`,
    });
  }

  public async getDocumentDownloadUrl(args: GetDocumentDownloadUrlArgs, config: AxiosRequestConfig = {}): Promise<DocumentDownloadResponse> {
    return this.request<DocumentDownloadResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/documents/${encodeURIComponent(String(args.documentId))}/download`,
      params: { "trusted_contact_id": args.trustedContactId },
    });
  }

  public async createDocumentGrant(args: CreateDocumentGrantArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/documents/${encodeURIComponent(String(args.documentId))}/grants`,
      data: args.body,
    });
  }

  public async initDocumentVersionUpload(args: InitDocumentVersionUploadArgs, config: AxiosRequestConfig = {}): Promise<UploadInitResponse> {
    return this.request<UploadInitResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/documents/${encodeURIComponent(String(args.documentId))}/versions/init`,
      data: args.body,
    });
  }

  public async createExportJob(config: AxiosRequestConfig = {}): Promise<ExportJobResponse> {
    return this.request<ExportJobResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/exports`,
    });
  }

  public async getExportStatus(args: GetExportStatusArgs, config: AxiosRequestConfig = {}): Promise<ExportJobResponse> {
    return this.request<ExportJobResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/exports/${encodeURIComponent(String(args.exportJobId))}`,
    });
  }

  public async ownerExportDownload(args: OwnerExportDownloadArgs, config: AxiosRequestConfig = {}): Promise<ExportDownloadResponse> {
    return this.request<ExportDownloadResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/exports/${encodeURIComponent(String(args.exportJobId))}/download`,
    });
  }

  public async tokenExportDownload(args: TokenExportDownloadArgs, config: AxiosRequestConfig = {}): Promise<ExportDownloadResponse> {
    return this.request<ExportDownloadResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/exports/${encodeURIComponent(String(args.exportJobId))}/download-by-token`,
      params: { "token": args.token },
    });
  }

  public async issueExportToken(args: IssueExportTokenArgs, config: AxiosRequestConfig = {}): Promise<ExportTokenResponse> {
    return this.request<ExportTokenResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/exports/${encodeURIComponent(String(args.exportJobId))}/token`,
    });
  }

  public async listInventoryAccounts(config: AxiosRequestConfig = {}): Promise<InventoryResponse[]> {
    return this.request<InventoryResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/inventory/accounts`,
    });
  }

  public async createInventoryAccount(args: CreateInventoryAccountArgs, config: AxiosRequestConfig = {}): Promise<InventoryResponse> {
    return this.request<InventoryResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/inventory/accounts`,
      data: args.body,
    });
  }

  public async listPolicies(config: AxiosRequestConfig = {}): Promise<LegalPolicyResponse[]> {
    return this.request<LegalPolicyResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/legal/policies`,
    });
  }

  public async createPolicy(args: CreatePolicyArgs, config: AxiosRequestConfig = {}): Promise<LegalPolicyResponse> {
    return this.request<LegalPolicyResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/legal/policies`,
      data: args.body,
    });
  }

  public async createPacketJob(args: CreatePacketJobArgs, config: AxiosRequestConfig = {}): Promise<PacketJobResponse> {
    return this.request<PacketJobResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/packets`,
      data: args.body,
    });
  }

  public async getPacketJob(args: GetPacketJobArgs, config: AxiosRequestConfig = {}): Promise<PacketJobResponse> {
    return this.request<PacketJobResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/packets/${encodeURIComponent(String(args.packetJobId))}`,
    });
  }

  public async createCheckout(args: CreateCheckoutArgs, config: AxiosRequestConfig = {}): Promise<PaymentCheckoutResponse> {
    return this.request<PaymentCheckoutResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/payments/checkout`,
      data: args.body,
    });
  }

  public async paymentWebhook(args: PaymentWebhookArgs, config: AxiosRequestConfig = {}): Promise<PaymentWebhookResponse> {
    return this.request<PaymentWebhookResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/payments/webhook`,
      headers: { ...(config.headers ?? {}), "X-Razorpay-Signature": args.xRazorpaySignature },
      data: args.body,
    });
  }

  public async getPayment(args: GetPaymentArgs, config: AxiosRequestConfig = {}): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/payments/${encodeURIComponent(String(args.orderId))}`,
    });
  }

  public async listTrustedContacts(config: AxiosRequestConfig = {}): Promise<TrustedContactResponse[]> {
    return this.request<TrustedContactResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/trusted-contacts`,
    });
  }

  public async createTrustedContact(args: CreateTrustedContactArgs, config: AxiosRequestConfig = {}): Promise<TrustedContactResponse> {
    return this.request<TrustedContactResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/trusted-contacts`,
      data: args.body,
    });
  }

  public async acceptTrustedContactInvite(args: AcceptTrustedContactInviteArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/trusted-contacts/invite/accept`,
      params: { "token": args.token },
    });
  }

  public async revokeTrustedContact(args: RevokeTrustedContactArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "DELETE",
      url: `/api/v1/trusted-contacts/${encodeURIComponent(String(args.trustedContactId))}`,
    });
  }

  public async inviteTrustedContact(args: InviteTrustedContactArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "POST",
      url: `/api/v1/trusted-contacts/${encodeURIComponent(String(args.trustedContactId))}/invite`,
      data: args.body,
    });
  }

  public async healthz(config: AxiosRequestConfig = {}): Promise<{ status: "ok"; }> {
    return this.request<{ status: "ok"; }>({
      ...config,
      method: "GET",
      url: `/healthz`,
    });
  }

}
