## Summary
- 

## Delivery Stream
- [ ] Backend
- [ ] Sync / QA / Docs
- [ ] Frontend
- [ ] Infra
- [ ] CI/CD

## Phase Alignment
- [ ] Branch and commit scope follow the active phase stream (`codex/<phase>-backend`, `codex/<phase>-sync`, or `codex/<phase>-frontend`)
- [ ] Backend landed before sync/frontend for any public interface change
- [ ] Frontend only consumes generated request/response types

## Contract Sync
- [ ] `packages/shared/openapi/openapi.yaml` updated first (if public API changed)
- [ ] `packages/shared/openapi/openapi.generated.json` regenerated (if API changed)
- [ ] `frontend/src/lib/generated/api-client.ts` regenerated (if API changed)
- [ ] `frontend/src/api/openapi-types.ts` regenerated (if API changed)
- [ ] Internal-only endpoints stayed out of the public contract

## Validation
- [ ] `npm run verify:sync`
- [ ] relevant backend integration tests
- [ ] `backend-quality`
- [ ] `frontend-quality`
- [ ] `infra-validate`
- [ ] relevant Playwright spec updated for user-visible behavior changes

## Phase Docs
- [ ] `PROGRESS_CHECKLIST.md` updated
- [ ] `PRODUCT_DEVELOPMENT.md` updated
- [ ] `CHANGELOG.md` updated
- [ ] `INTEGRATION_CHECKLIST.md` updated

## Risks / Rollback
- 

## Migration Notes
- [ ] No migration needed
- [ ] Migration included and rollout-safe
