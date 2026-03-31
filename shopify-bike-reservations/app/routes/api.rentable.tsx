import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");

  if (!productId || !session?.shop) {
    return json({ rentable: false });
  }

  const fullProductId = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const rentableProduct = await db.rentableProduct.findUnique({
    where: {
      shop_productId: {
        shop: session.shop,
        productId: fullProductId,
      },
    },
  });

  return json({ rentable: !!rentableProduct });
};
