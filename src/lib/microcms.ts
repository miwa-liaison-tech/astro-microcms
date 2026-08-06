import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

export interface MicroCMSSelectValue {
  name?: string;
  value?: string;
}

export type MicroCMSField = string | number | MicroCMSSelectValue | null | undefined;

export interface News {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
  createdAt?: string;
  category?: MicroCMSField;
}

export interface Product {
  id: string;
  product?: string;
  number?: number | string | null;
  manufacturer?: MicroCMSField;
  products_category?: MicroCMSField;
}

const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = import.meta.env.MICROCMS_API_KEY;

const configuredClient =
  serviceDomain && apiKey
    ? createClient({
        serviceDomain,
        apiKey,
      })
    : null;

export const client = configuredClient;

const emptyList = <T>() => ({
  contents: [] as T[],
  totalCount: 0,
  offset: 0,
  limit: 100,
});

export async function getNews(queries?: MicroCMSQueries) {
  if (!client) return emptyList<News>();

  return client.getList<News>({
    endpoint: "news",
    queries: { limit: 100, ...queries },
  });
}

export async function getNewsDetail(id: string) {
  if (!client) return null;

  return client.getListDetail<News>({
    endpoint: "news",
    contentId: id,
  });
}

export async function getProducts(queries?: MicroCMSQueries) {
  if (!client) return emptyList<Product>();

  return client.getList<Product>({
    endpoint: "products",
    queries: { limit: 100, ...queries },
  });
}

export function getFieldText(value: MicroCMSField) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return value.name ?? value.value ?? "";
  }

  return "";
}
