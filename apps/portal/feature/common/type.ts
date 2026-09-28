type CommonMeta = {
  page: number;
  limit: number;
  total: number;
};

export type CommonSuccessResponse<T = unknown> = {
  message?: string;
  meta?: CommonMeta;
  data: T;
};

export type Translate = (key: string) => string;

export type PaginationParams = {
  page: number;
  limit: number;
};
