# Integration Checklist

- Updated on: 2026-03-22
- Scope: frontend-backend contract sync for `packages/shared/openapi/openapi.yaml`
- Result: contract, generated frontend client, cookie-auth flow, and backend route coverage are aligned for the shipped planning-mode and executor baseline, including the public Phase A case-review metadata on case summaries. The updated executor review-state Playwright spec is written, but it has not been executed in a real runner from this environment.

## Sync / QA / Docs Operating Model

- Sync stream owns `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md`.
- Backend is the source of truth for public interface changes.
- `packages/shared/openapi/openapi.yaml` must be updated before any generated artifact is regenerated.
- Frontend consumes generated request/response types only; it does not handwrite contract shapes.
- Every completed stream lands on `main`, and every successor stream branch is recreated or reset from the refreshed `main` tip.
- Internal-only routes stay out of the public OpenAPI surface.
- Phase completion is blocked if implementation, contract, generated artifacts, and docs disagree.

## Local Verification Entry Point

- Preferred local command:
  - `npm run verify:sync`
- Add phase-specific backend tests when needed:
  - `npm run verify:sync -- --backend-test backend/tests/test_api_integration_flows.py`
  - `npm run verify:sync -- --backend-test backend/tests/test_api_integration_flows.py --backend-test backend/tests/test_case_flows.py`
- Optional Playwright execution remains available through `npm run verify:sync -- --run-e2e --playwright-spec <spec>` or the existing frontend e2e commands, but a real runner/staging pass is still required for high-confidence frontend validation.

## Per-Phase Verification Checklist

- Pull the backend branch after API or schema changes.
- Update `packages/shared/openapi/openapi.yaml` first, then regenerate:
  - `packages/shared/openapi/openapi.generated.json`
  - `frontend/src/lib/generated/api-client.ts`
  - `frontend/src/api/openapi-types.ts`
- Run:
  - `python -m pytest backend/tests/test_contract_sync.py`
  - relevant backend integration tests for the phase
  - `npm run typecheck`
  - `npm run lint`
- If frontend behavior changes for users, confirm the relevant Playwright spec is updated.
- Update `PROGRESS_CHECKLIST.md`, `PRODUCT_DEVELOPMENT.md`, `CHANGELOG.md`, and `INTEGRATION_CHECKLIST.md` in the same phase.

## Current Contract Boundaries

- The public contract currently covers planning-mode and single-executor after-loss flows.
- The backend now implements internal manual-review routes, but only the public case-summary review metadata is intended to enter OpenAPI during Phase A sync.
- Internal manual-review endpoints remain intentionally excluded from public OpenAPI.
- Family-workspace, crypto, and B2B payloads are intentionally absent until their respective delivery phases start.

## Audit Snapshot (2026-03-22)

- Baseline hygiene is resolved: `codex/pre-phase-a-baseline` now holds the consolidated pre-Phase-A state and the stream branches were cut from it.
- Phase A backend is implemented on `codex/phase-a-backend`: PDF metadata stripping, review-state persistence, hidden `/api/v1/internal/case-reviews/*` endpoints, review activity events, and the schema migration are present.
- Phase A sync is implemented locally on `main`: `packages/shared/openapi/openapi.yaml`, `packages/shared/openapi/openapi.generated.json`, `frontend/src/lib/generated/api-client.ts`, and `frontend/src/api/openapi-types.ts` now include the public case-summary review fields.
- Local backend verification passed on `2026-03-22` with `uv run --project backend pytest backend/tests/test_contract_sync.py backend/tests/test_api_integration_flows.py backend/tests/test_case_flows.py`.
- Frontend review-state UX is implemented locally on `main`, and `frontend/tests/e2e/executor-flow.spec.ts` now covers queued review, rejection, and replacement upload.
- Current-release ordering is explicit: the remaining Phase A sign-off item is a real-runner Playwright execution, then Phase B checkout remains the next current-release blocker.

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
| `GET` | `/api/v1/cases` | `listAccessibleCases` | `-` | `CaseSummaryResponse[]` | Contract + backend verification | Synced |
| `GET` | `/api/v1/cases/{caseId}` | `getCaseSummary` | `-` | `CaseSummaryResponse` | Contract + backend verification | Synced |
| `POST` | `/api/v1/cases/{caseId}/death-certificate/uploads/init` | `initCaseDeathCertificateUpload` | `CaseActivationUploadInitRequest` | `CaseActivationUploadInitResponse` | Integration test | Synced |
| `POST` | `/api/v1/cases/{caseId}/activate` | `activateCase` | `CaseActivationConfirmRequest` | `CaseSummaryResponse` | Contract + backend verification | Synced |
| `POST` | `/api/v1/cases/{caseId}/close` | `closeCase` | `-` | `CaseSummaryResponse` | Contract + backend verification | Synced |
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
- Generated artifacts now include executor-case payloads and enums such as `TrustedContactRole`, `CaseStatus`, `CaseActivationReviewStatus`, and `CaseTaskStatus`, along with the five public Phase A review fields on summary payloads and the closed-case retention metadata on summary/report payloads.
- The current `verify:sync` path validates route parity, backend regressions, frontend typecheck, and lint. Real-runner Playwright execution remains a separate sign-off step for user-visible Phase A changes.

## Known Gaps

- Hidden mock-storage routes under `/api/v1/testing/*` are test-only and intentionally excluded from public OpenAPI.
- Internal manual-review endpoints are intentionally excluded from the public OpenAPI surface by design.
- Multi-participant case collaboration is intentionally excluded from the current public case contract surface until Phase C begins.
- The updated executor review-state Playwright spec still needs to run against a live frontend/backend stack before Phase A is fully signed off.
- Live Razorpay/Postmark validation still depends on staging credentials and must be executed as part of the launch runbook.
- Alert routing is operationally validated through staging smoke checks; it is not exercised by unit or contract tests.
