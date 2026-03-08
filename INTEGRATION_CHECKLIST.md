# Integration Checklist

- Generated on: 2026-03-08 21:08 UTC
- Scope: frontend-backend contract sync for `packages/shared/openapi/openapi.yaml`
- Result: contract, generated frontend client, and backend route + enum checks are aligned.

## Endpoint-by-Endpoint Status

| Method | Path | Operation | Request Payload | Success Payload | Verification | Status |
|---|---|---|---|---|---|---|
| `GET` | `/healthz` | `healthz` | `-` | `object` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/signup` | `signup` | `SignupRequest` | `SignupResponse` | Integration test | Synced |
| `POST` | `/api/v1/auth/verify-email` | `verifyEmail` | `EmailVerificationRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/login` | `login` | `LoginRequest` | `TokenPair` | Integration test | Synced |
| `POST` | `/api/v1/auth/refresh` | `refreshSession` | `RefreshRequest` | `TokenPair` | Integration test | Synced |
| `POST` | `/api/v1/auth/logout` | `logout` | `LogoutRequest` | `ApiMessage` | Integration test | Synced |
| `POST` | `/api/v1/auth/logout-all` | `logoutAll` | `-` | `ApiMessage` | Integration test | Synced |
| `POST` | `/api/v1/auth/password-reset/request` | `passwordResetRequest` | `PasswordResetRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/password-reset/confirm` | `passwordResetConfirm` | `PasswordResetConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/request` | `recoveryRequest` | `RecoveryRequest` | `RecoveryRequestResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/assist` | `recoveryAssist` | `RecoveryAssistRequest` | `RecoveryAssistResponse` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/recovery/confirm` | `recoveryConfirm` | `RecoveryConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `POST` | `/api/v1/auth/jurisdiction/confirm` | `confirmJurisdiction` | `JurisdictionConfirmRequest` | `ApiMessage` | Contract + type sync | Synced |
| `GET` | `/api/v1/auth/me` | `currentUser` | `-` | `UserSessionResponse` | Integration test | Synced |
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

- Frontend payload/request-response types are regenerated from the same OpenAPI source into `frontend/src/lib/generated/api-client.ts`.
- Backend route surface is validated against the same contract in `backend/tests/test_contract_sync.py` (path+method parity).
- Shared enum/status sets are validated in `backend/tests/test_contract_sync.py` for: `PolicyType`, `RecoveryMode`, `TrustedContactRole`, `TrustedContactStatus`, `PacketJobStatus`, `ExportJobStatus`, `PaymentStatus`.

## Known Gaps

- Frontend `npm run build` is blocked in this environment by Node runtime version (`20.17.0`), while installed Vite requires `20.19+` or `22.12+`.
- Backend tests pass, but pytest cache directory creation emits a warning due local filesystem permissions on `.pytest_cache`.
- Not all endpoints currently have scenario-level integration tests; untested endpoints are still contract-verified and frontend-type-verified as shown above.

## Redundancy Review (No Deletions Per Request)

- Found generated artifacts and cache/temp folders (`frontend/dist`, `frontend/node_modules`, `backend/.pytest_cache`, `backend/tests/.tmp`, `backend/tmp_pytest`).
- No files/folders were deleted to honor the no-deletion requirement.
