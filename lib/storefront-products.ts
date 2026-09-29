type ProductPresentation = {
  id: string;
  category: string;
  image_url: string | null;
};

// Keep imported Shopify metadata out of customer-facing categories.
export function presentStorefrontProduct<T extends ProductPresentation>(product: T): T {
  return {
    ...product,
    category: product.category === "SHOPSTORM_HIDDEN_PRODUCT" ? "Gifts" : product.category,
    image_url: product.id === "8a7edf4f-3f06-4730-8032-35a78ab37772"
      ? "/images/women-cotton-terry-set.jpg"
      : product.image_url,
  };
}
