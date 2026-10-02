import "server-only";

import axios from "axios";
import {
  AI_TRANSLATION_API_URL,
  getAITranslationAuthorization,
} from "@/feature/translator/config";

export const serverApiClient = axios.create({
  baseURL: AI_TRANSLATION_API_URL,
  timeout: 60_000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

serverApiClient.interceptors.request.use((config) => {
  const authorization = getAITranslationAuthorization();
  if (authorization) config.headers.set("Authorization", authorization);
  return config;
});