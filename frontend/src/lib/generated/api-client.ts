// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: packages/shared/openapi/openapi.yaml
// Generator: frontend/scripts/generate_api_client.py

import type { AxiosInstance, AxiosRequestConfig } from "axios";

export type ApiMessage = { message: string; };
export type ErrorDetail = { code: string; message: string; details?: Record<string, unknown>[] | null; };
export type ErrorResponse = { error: ErrorDetail; };
export type ConsentInput = { policy_type: "privacy" | "terms"; policy_version: string; };
export type SignupRequest = { email: string; password: string; full_name?: string | null; phone?: string | null; jurisdiction_code?: string; consents: ConsentInput[]; };
export type SignupResponse = { message: string; verification_token?: string | null; };
export type LoginRequest = { email: string; password: string; };
export type RefreshRequest = { refresh_token?: string | null; };
export type LogoutRequest = { refresh_token?: string | null; };
export type EmailVerificationRequest = { token: string; };
export type PasswordResetRequest = { email: string; };
export type PasswordResetConfirmRequest = { token: string; new_password: string; };
export type RecoveryRequest = { email: string; mode: "primary_email" | "backup_email" | "trusted_contact"; trusted_contact_email?: string | null; };
export type RecoveryAssistRequest = { approval_token: string; };
export type RecoveryConfirmRequest = { recovery_token: string; new_password: string; };
export type JurisdictionConfirmRequest = { jurisdiction_code: string; };
export type RecoveryRequestResponse = { message: string; recovery_token?: string | null; approval_token?: string | null; };
export type RecoveryAssistResponse = { message: string; };
export type CsrfTokenResponse = { csrf_token: string; };
export type UserSessionResponse = { id: string; email: string; email_verified: boolean; };
export type HeartbeatUpsertRequest = { cadence: "monthly" | "quarterly"; enabled: boolean; };
export type HeartbeatResponse = { configured: boolean; enabled: boolean; cadence?: "monthly" | "quarterly" | null; status: "unconfigured" | "active" | "paused" | "overdue" | "escalated"; last_checked_in_at?: string | null; next_expected_at?: string | null; next_action_at?: string | null; escalation_level: number; executor_notified_at?: string | null; recovery_contact_count: number; };
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
export type PaymentCheckoutResponse = { order_id: string; provider: string; provider_order_id: string; checkout_key_id?: string | null; amount_paise: number; currency: string; status: "created" | "authorized" | "captured" | "failed" | "refunded"; };
export type PaymentWebhookRequest = { event_id?: string | null; order_id: string; payment_id?: string | null; status: string; event_sequence: number; };
export type PaymentWebhookResponse = { accepted: boolean; processed: boolean; reason: string; status?: string | null; };
export type PaymentStatusResponse = { order_id: string; payment_id?: string | null; status: "created" | "authorized" | "captured" | "failed" | "refunded"; event_sequence: number; };
export type LegalPolicyCreateRequest = { policy_type: "privacy" | "terms"; version: string; effective_from: string; checksum: string; is_active?: boolean; };
export type LegalPolicyResponse = { id: string; policy_type: "privacy" | "terms"; version: string; effective_from: string; is_active: boolean; checksum: string; };
export type CaseStatus = "activation_pending" | "active" | "closed";
export type CaseTaskStatus = "not_started" | "in_progress" | "submitted" | "waiting" | "resolved" | "escalated";
export type CaseTaskStatusCounts = { not_started: number; in_progress: number; submitted: number; waiting: number; resolved: number; escalated: number; };
export type CaseSummaryResponse = { id: string; owner_user_id: string; owner_name: string; owner_email: string; status: CaseStatus; death_certificate_document_id?: string | null; death_certificate_version_id?: string | null; activated_at?: string | null; closed_at?: string | null; created_at: string; updated_at: string; task_count: number; task_status_counts: CaseTaskStatusCounts; };
export type CaseActivationUploadInitRequest = { size_bytes: number; content_type: "application/pdf"; sha256?: string | null; };
export type CaseActivationUploadInitResponse = { document_id: string; version_id: string; version_no: number; object_key: string; upload_url: string; upload_url_expires_in_seconds: number; plaintext_dek_b64: string; kms_key_id: string; doc_type: "death_certificate"; };
export type CaseActivationConfirmRequest = { document_id: string; version_id: string; };
export type CaseTaskResponse = { id: string; case_id: string; inventory_account_id?: string | null; platform: string; category: string; priority: number; status: CaseTaskStatus; notes?: string | null; reference_number?: string | null; submitted_date?: string | null; evidence_count: number; evidence_document_id?: string | null; created_at: string; updated_at: string; };
export type CaseTaskPatchRequest = { notes?: string | null; status?: CaseTaskStatus | null; reference_number?: string | null; submitted_date?: string | null; };
export type CaseTaskEvidenceUploadInitRequest = { file_name: string; size_bytes: number; content_type: "application/pdf" | "image/png" | "image/jpeg"; sha256?: string | null; };
export type CaseTaskEvidenceUploadInitResponse = { evidence_id: string; document_id: string; version_id: string; version_no: number; object_key: string; upload_url: string; upload_url_expires_in_seconds: number; plaintext_dek_b64: string; kms_key_id: string; doc_type: "case_task_evidence"; };
export type CaseTaskEvidenceResponse = { id: string; document_id: string; file_name: string; content_type: string; document_state: string; scan_status?: string | null; scan_summary?: string | null; created_at: string; download_available: boolean; };
export type CaseActivityEventResponse = { timestamp: string; event_type: string; task_id?: string | null; evidence_id?: string | null; actor_label: string; message: string; };
export type CaseReportSummaryResponse = { case_id: string; owner_name: string; owner_email: string; status: CaseStatus; activated_at?: string | null; generated_at: string; total_tasks: number; resolved_task_count: number; escalated_task_count: number; clean_evidence_count: number; };
export type CaseReportTaskRowResponse = { id: string; platform: string; category: string; priority: number; status: CaseTaskStatus; notes?: string | null; reference_number?: string | null; submitted_date?: string | null; evidence_count: number; clean_evidence_count: number; };
export type CaseReportEvidenceReferenceResponse = { evidence_id: string; task_id: string; platform: string; category: string; file_name: string; content_type: string; created_at: string; };
export type CaseReportResponse = { summary: CaseReportSummaryResponse; task_rows: CaseReportTaskRowResponse[]; clean_evidence_references: CaseReportEvidenceReferenceResponse[]; activity_timeline: CaseActivityEventResponse[]; report_ready: boolean; warnings: string[]; };
export type TrustedContactCreateRequest = { name: string; email: string; role: "executor" | "viewer" | "packet_access" | "recovery_assist"; recovery_enabled?: boolean; };
export type TrustedContactInviteRequest = { force_reissue?: boolean; };
export type TrustedContactResponse = { id: string; name: string; email: string; role: "executor" | "viewer" | "packet_access" | "recovery_assist"; status: "pending" | "active" | "revoked"; };
export type InventoryCreateRequest = { platform: string; category: string; username_hint?: string | null; importance_level?: number; };
export type InventoryResponse = { id: string; platform: string; category: string; username_hint?: string | null; importance_level: number; };
export type PasswordResetRequestResponse = { message: string; reset_token?: string | null; };
export type TrustedContactInviteResponse = { message: string; invite_token?: string | null; };
export type InventoryUpdateRequest = { platform: string; category: string; username_hint?: string | null; importance_level: number; };
export type DocumentVersionStatusResponse = { id: string; document_id: string; version_no: number; state: string; object_key: string; size_bytes: number; sha256?: string | null; created_at: string; scan_status?: string | null; scan_summary?: string | null; scan_failed_purge_at?: string | null; };
export type DocumentSummaryResponse = { id: string; doc_type: string; state: string; current_version_id?: string | null; created_at: string; deleted_at?: string | null; current_version?: DocumentVersionStatusResponse; };
export type DocumentDetailResponse = DocumentSummaryResponse & { versions: DocumentVersionStatusResponse[]; };

export interface ConfirmJurisdictionArgs {
  body: JurisdictionConfirmRequest;
}

export interface LoginArgs {
  body: LoginRequest;
}

export interface LogoutArgs {
  body?: LogoutRequest;
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
  body?: RefreshRequest;
}

export interface SignupArgs {
  body: SignupRequest;
}

export interface VerifyEmailArgs {
  body: EmailVerificationRequest;
}

export interface GetCaseSummaryArgs {
  caseId: string;
}

export interface ActivateCaseArgs {
  caseId: string;
  body: CaseActivationConfirmRequest;
}

export interface GetCaseActivityArgs {
  caseId: string;
}

export interface InitCaseDeathCertificateUploadArgs {
  caseId: string;
  body: CaseActivationUploadInitRequest;
}

export interface GetCaseReportArgs {
  caseId: string;
}

export interface ListCaseTasksArgs {
  caseId: string;
  status?: CaseTaskStatus;
  platform?: string;
  category?: string;
  priority?: number;
}

export interface PatchCaseTaskArgs {
  caseId: string;
  taskId: string;
  body: CaseTaskPatchRequest;
}

export interface ListCaseTaskEvidenceArgs {
  caseId: string;
  taskId: string;
}

export interface InitCaseTaskEvidenceUploadArgs {
  caseId: string;
  taskId: string;
  body: CaseTaskEvidenceUploadInitRequest;
}

export interface GetCaseTaskEvidenceDownloadArgs {
  caseId: string;
  taskId: string;
  evidenceId: string;
}

export interface QueueCaseTaskEvidenceScanArgs {
  caseId: string;
  taskId: string;
  evidenceId: string;
}

export interface InitDocumentUploadArgs {
  body: UploadInitRequest;
}

export interface GetDocumentVersionArgs {
  versionId: string;
}

export interface QueueDocumentScanArgs {
  versionId: string;
}

export interface SoftDeleteDocumentArgs {
  documentId: string;
}

export interface GetDocumentArgs {
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

export interface UpsertHeartbeatArgs {
  body: HeartbeatUpsertRequest;
}

export interface CreateInventoryAccountArgs {
  body: InventoryCreateRequest;
}

export interface DeleteInventoryAccountArgs {
  accountId: string;
}

export interface UpdateInventoryAccountArgs {
  accountId: string;
  body: InventoryUpdateRequest;
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

  public async csrfToken(config: AxiosRequestConfig = {}): Promise<CsrfTokenResponse> {
    return this.request<CsrfTokenResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/auth/csrf`,
    });
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

  public async passwordResetRequest(args: PasswordResetRequestArgs, config: AxiosRequestConfig = {}): Promise<PasswordResetRequestResponse> {
    return this.request<PasswordResetRequestResponse>({
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

  public async listAccessibleCases(config: AxiosRequestConfig = {}): Promise<CaseSummaryResponse[]> {
    return this.request<CaseSummaryResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/cases`,
    });
  }

  public async getCaseSummary(args: GetCaseSummaryArgs, config: AxiosRequestConfig = {}): Promise<CaseSummaryResponse> {
    return this.request<CaseSummaryResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}`,
    });
  }

  public async activateCase(args: ActivateCaseArgs, config: AxiosRequestConfig = {}): Promise<CaseSummaryResponse> {
    return this.request<CaseSummaryResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/activate`,
      data: args.body,
    });
  }

  public async getCaseActivity(args: GetCaseActivityArgs, config: AxiosRequestConfig = {}): Promise<CaseActivityEventResponse[]> {
    return this.request<CaseActivityEventResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/activity`,
    });
  }

  public async initCaseDeathCertificateUpload(args: InitCaseDeathCertificateUploadArgs, config: AxiosRequestConfig = {}): Promise<CaseActivationUploadInitResponse> {
    return this.request<CaseActivationUploadInitResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/death-certificate/uploads/init`,
      data: args.body,
    });
  }

  public async getCaseReport(args: GetCaseReportArgs, config: AxiosRequestConfig = {}): Promise<CaseReportResponse> {
    return this.request<CaseReportResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/report`,
    });
  }

  public async listCaseTasks(args: ListCaseTasksArgs, config: AxiosRequestConfig = {}): Promise<CaseTaskResponse[]> {
    return this.request<CaseTaskResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks`,
      params: { "status": args.status, "platform": args.platform, "category": args.category, "priority": args.priority },
    });
  }

  public async patchCaseTask(args: PatchCaseTaskArgs, config: AxiosRequestConfig = {}): Promise<CaseTaskResponse> {
    return this.request<CaseTaskResponse>({
      ...config,
      method: "PATCH",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks/${encodeURIComponent(String(args.taskId))}`,
      data: args.body,
    });
  }

  public async listCaseTaskEvidence(args: ListCaseTaskEvidenceArgs, config: AxiosRequestConfig = {}): Promise<CaseTaskEvidenceResponse[]> {
    return this.request<CaseTaskEvidenceResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks/${encodeURIComponent(String(args.taskId))}/evidence`,
    });
  }

  public async initCaseTaskEvidenceUpload(args: InitCaseTaskEvidenceUploadArgs, config: AxiosRequestConfig = {}): Promise<CaseTaskEvidenceUploadInitResponse> {
    return this.request<CaseTaskEvidenceUploadInitResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks/${encodeURIComponent(String(args.taskId))}/evidence/uploads/init`,
      data: args.body,
    });
  }

  public async getCaseTaskEvidenceDownload(args: GetCaseTaskEvidenceDownloadArgs, config: AxiosRequestConfig = {}): Promise<DocumentDownloadResponse> {
    return this.request<DocumentDownloadResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks/${encodeURIComponent(String(args.taskId))}/evidence/${encodeURIComponent(String(args.evidenceId))}/download`,
    });
  }

  public async queueCaseTaskEvidenceScan(args: QueueCaseTaskEvidenceScanArgs, config: AxiosRequestConfig = {}): Promise<ScanDispatchResponse> {
    return this.request<ScanDispatchResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/cases/${encodeURIComponent(String(args.caseId))}/tasks/${encodeURIComponent(String(args.taskId))}/evidence/${encodeURIComponent(String(args.evidenceId))}/scan`,
    });
  }

  public async listDocuments(config: AxiosRequestConfig = {}): Promise<DocumentSummaryResponse[]> {
    return this.request<DocumentSummaryResponse[]>({
      ...config,
      method: "GET",
      url: `/api/v1/documents`,
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

  public async getDocumentVersion(args: GetDocumentVersionArgs, config: AxiosRequestConfig = {}): Promise<DocumentVersionStatusResponse> {
    return this.request<DocumentVersionStatusResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/documents/versions/${encodeURIComponent(String(args.versionId))}`,
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

  public async getDocument(args: GetDocumentArgs, config: AxiosRequestConfig = {}): Promise<DocumentDetailResponse> {
    return this.request<DocumentDetailResponse>({
      ...config,
      method: "GET",
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

  public async getHeartbeat(config: AxiosRequestConfig = {}): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>({
      ...config,
      method: "GET",
      url: `/api/v1/heartbeats/me`,
    });
  }

  public async upsertHeartbeat(args: UpsertHeartbeatArgs, config: AxiosRequestConfig = {}): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>({
      ...config,
      method: "PUT",
      url: `/api/v1/heartbeats/me`,
      data: args.body,
    });
  }

  public async checkInHeartbeat(config: AxiosRequestConfig = {}): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>({
      ...config,
      method: "POST",
      url: `/api/v1/heartbeats/me/check-in`,
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

  public async deleteInventoryAccount(args: DeleteInventoryAccountArgs, config: AxiosRequestConfig = {}): Promise<ApiMessage> {
    return this.request<ApiMessage>({
      ...config,
      method: "DELETE",
      url: `/api/v1/inventory/accounts/${encodeURIComponent(String(args.accountId))}`,
    });
  }

  public async updateInventoryAccount(args: UpdateInventoryAccountArgs, config: AxiosRequestConfig = {}): Promise<InventoryResponse> {
    return this.request<InventoryResponse>({
      ...config,
      method: "PUT",
      url: `/api/v1/inventory/accounts/${encodeURIComponent(String(args.accountId))}`,
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

  public async inviteTrustedContact(args: InviteTrustedContactArgs, config: AxiosRequestConfig = {}): Promise<TrustedContactInviteResponse> {
    return this.request<TrustedContactInviteResponse>({
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
