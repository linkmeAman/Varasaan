# Integration Checklist

- Updated on: 2026-03-21
- Scope: frontend-backend contract sync for `packages/shared/openapi/openapi.yaml`
- Result: contract, generated frontend client, cookie-auth flow, and backend route coverage are aligned for planning-mode and executor case flows.

## Endpoint-by-Endpoint Status

| Method | Path | Operation | Request Payload | Success Payload | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/healthz` | `healthz` | `-` | `object` | Contract + type sync | Synced |
| `GET` | `/api/v1/auth/csrf` | `csrfToken` | `-` | `CsrfTokenResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/signup` | `signup` | `SignupRequest` | `SignupResponse` | Integration test | Synced |
| `POST` | `/api/v1/auth/verify-email` | `verifyEmail` | `EmailVerificationRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/login` | `login` | `LoginRequest` | `TokenPair` + cookies | Integration test | Synced |
| `POST` | `/api/v1/auth/refresh` | `refreshSession` | `RefreshRequest?` | `TokenPair` + rotated cookies | Integration test | Synced |
| `POST` | `/api/v1/auth/logout` | `logout` | `LogoutRequest?` | `ApiMessage` + cleared cookies | Integration test | Synced |
| `POST` | `/api/v1/auth/logout-all` | `logoutAll` | `-` | `ApiMessage` + cleared cookies | Integration test | Synced |
| `POST` | `/api/v1/auth/password-reset/request` | `passwordResetRequest` | `PasswordResetRequest` | `PasswordResetRequestResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/password-reset/confirm` | `passwordResetConfirm` | `PasswordResetConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/request` | `recoveryRequest` | `RecoveryRequest` | `RecoveryRequestResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/assist` | `recoveryAssist` | `RecoveryAssistRequest` | `RecoveryAssistResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/confirm` | `recoveryConfirm` | `RecoveryConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/jurisdiction/confirm` | `confirmJurisdiction` | `JurisdictionConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `GET` | `/api/v1/auth/me` | `currentUser` | `-` | `UserSessionResponse` | Integration test | Synced |
| `GET` | `/api/v1/cases` | `listAccessibleCases` | `-` | `CaseSummaryResponse[]` | Integration test | Synced |
| `GET` | `/api/v1/cases/{caseId}` | `getCaseSummary` | `-` | `CaseSummaryResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/cases/{caseId}/death-certificate/uploads/init` | `initCaseDeathCertificateUpload` | `CaseActivationUploadInitRequest` | `CaseActivationUploadInitResponse` | Integration test | Synced |
| `POST` | `/api/v1/cases/{caseId}/activate` | `activateCase` | `CaseActivationConfirmRequest` | `CaseSummaryResponse` | Integration test | Synced |
| `GET` | `/api/v1/cases/{caseId}/tasks` | `listCaseTasks` | `status/platform/category/priority (query)` | `CaseTaskResponse[]` | Integration test | Synced |
| `PATCH` | `/api/v1/cases/{caseId}/tasks/{taskId}` | `patchCaseTask` | `CaseTaskPatchRequest` | `CaseTaskResponse` | Integration test | Synced |
| `GET` | `/api/v1/legal/policies` | `listPolicies` | `-` | `LegalPolicyResponse[]` | Contract + type sync | Synced |
| `POST` | `/api/v1/legal/policies` | `createPolicy` | `LegalPolicyCreateRequest` | `LegalPolicyResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/documents/uploads/init` | `initDocumentUpload` | `UploadInitRequest` | `UploadInitResponse` | Integration test | Synced |
| `POST` | `/api/v1/documents/{documentId}/versions/init` | `initDocumentVersionUpload` | `UploadInitRequest` | `UploadInitResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/documents/versions/{versionId}/scan` | `queueDocumentScan` | `-` | `ScanDispatchResponse` | Integration test | Synced |
| `GET` | `/api/v1/documents/{documentId}/download` | `getDocumentDownloadUrl` | `-` | `DocumentDownloadResponse` | Integration test | Synced |
| `POST` | `/api/v1/documents/{documentId}/grants` | `createDocumentGrant` | `GrantCreateRequest` | `ApiMessage` | Contract + type sync | Synced |
| `DELETE` | `/api/v1/documents/{documentId}` | `softDeleteDocument` | `-` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/exports` | `createExportJob` | `-` | `ExportJobResponse` | Integration test | Synced |
| `GET` | `/api/v1/exports/{exportJobId}` | `getExportStatus` | `-` | `ExportJobResponse` | Integration test | Synced |
| `POST` | `/api/v1/exports/{exportJobId}/token` | `issueExportToken` | `-` | `ExportTokenResponse` | Integration test | Synced |
| `GET` | `/api/v1/exports/{exportJobId}/download` | `ownerExportDownload` | `-` | `ExportDownloadResponse` | Contract + type sync | Synced |
| `GET` | `/api/v1/exports/{exportJobId}/download-by-token` | `tokenExportDownload` | `-` | `ExportDownloadResponse` | Integration test | Synced |
| `POST` | `/api/v1/packets` | `createPacketJob` | `PacketGenerateRequest` | `PacketJobResponse` | Contract + type sync | Synced |
| `GET` | `/api/v1/packets/{packetJobId}` | `getPacketJob` | `-` | `PacketJobResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/payments/checkout` | `createCheckout` | `PaymentCheckoutRequest` | `PaymentCheckoutResponse` | Integration test | Synced |
| `GET` | `/api/v1/payments/{orderId}` | `getPayment` | `-` | `PaymentStatusResponse` | Integration test | Synced |
| `POST` | `/api/v1/payments/webhook` | `paymentWebhook` | `PaymentWebhookRequest` | `PaymentWebhookResponse` | Integration test | Synced |
| `GET` | `/api/v1/trusted-contacts` | `listTrustedContacts` | `-` | `TrustedContactResponse[]` | Contract + type sync | Synced |
| `POST` | `/api/v1/trusted-contacts` | `createTrustedContact` | `TrustedContactCreateRequest` | `TrustedContactResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/trusted-contacts/{trustedContactId}/invite` | `inviteTrustedContact` | `TrustedContactInviteRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/trusted-contacts/invite/accept` | `acceptTrustedContactInvite` | `-` | `ApiMessage` | Contract + type sync | Synced |
| `DELETE` | `/api/v1/trusted-contacts/{trustedContactId}` | `revokeTrustedContact` | `-` | `ApiMessage` | Contract + type sync | Synced |
| `GET` | `/api/v1/inventory/accounts` | `listInventoryAccounts` | `-` | `InventoryResponse[]` | Contract + type sync | Synced |
| `POST` | `/api/v1/inventory/accounts` | `createInventoryAccount` | `InventoryCreateRequest` | `InventoryResponse` | Contract + type sync | Synced |

## Payload Compatibility

- Frontend payload/request-response types are regenerated from the same OpenAPI source into `frontend/src/lib/generated/api-client.ts` and `frontend/src/api/openapi-types.ts`.
- Browser clients use credentialed cookies plus double-submit CSRF headers for mutating auth/session requests.
- Backend route surface is validated against the same contract in `backend/tests/test_contract_sync.py` (path+method parity, excluding intentionally hidden testing routes).
- Generated artifacts now include executor-case payloads and enums such as `TrustedContactRole`, `CaseStatus`, and `CaseTaskStatus`.

## Known Gaps

- Hidden mock-storage routes under `/api/v1/testing/*` are test-only and intentionally excluded from public OpenAPI.
- Manual review, multi-participant case collaboration, evidence upload/download, and notifications are intentionally excluded from the current case contract surface.
- Live Razorpay/Postmark validation still depends on staging credentials and must be executed as part of the launch runbook.
- Alert routing is operationally validated through staging smoke checks; it is not exercised by unit or contract tests.
