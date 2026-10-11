import type { CatalogService } from './catalog.service.js';

export function createCatalogResolvers(catalogService: CatalogService) {
  return {
    Query: {
      items: (_parent: unknown, args: { search?: string | null }) =>
        catalogService.searchItems(args.search ?? undefined),
      item: (_parent: unknown, args: { id: string }) => catalogService.getItem(args.id),
    },
  };
}
