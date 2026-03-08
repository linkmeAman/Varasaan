import api from './api';
import { VarasaanApiClient } from './generated/api-client';

export const apiClient = new VarasaanApiClient(api);

export * from './generated/api-client';
