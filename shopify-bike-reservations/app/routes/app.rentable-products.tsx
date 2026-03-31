import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Badge,
  Banner,
  BlockStack,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const PRODUCTS_QUERY = `
  query getProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          status
          totalInventory
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 50 },
  });
  const { data } = await response.json();

  const products = data.products.edges.map(
    (edge: { node: Record<string, unknown> }) => edge.node,
  );

  const rentableProducts = await db.rentableProduct.findMany({
    where: { shop: session.shop },
  });
  const rentableProductIds = new Set(
    rentableProducts.map((rp) => rp.productId),
  );

  return json({
    products,
    rentableProductIds: Array.from(rentableProductIds),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const productId = formData.get("productId") as string;
  const productTitle = formData.get("productTitle") as string;

  if (actionType === "add") {
    await db.rentableProduct.upsert({
      where: {
        shop_productId: {
          shop: session.shop,
          productId,
        },
      },
      create: {
        shop: session.shop,
        productId,
        title: productTitle,
      },
      update: {
        title: productTitle,
      },
    });
  } else if (actionType === "remove") {
    await db.rentableProduct.deleteMany({
      where: {
        shop: session.shop,
        productId,
      },
    });
  }

  return json({ success: true });
};

export default function RentableProducts() {
  const { products, rentableProductIds } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [successMessage, setSuccessMessage] = useState("");

  const isLoading = navigation.state !== "idle";

  const handleToggleRentable = (
    productId: string,
    productTitle: string,
    isCurrentlyRentable: boolean,
  ) => {
    const formData = new FormData();
    formData.set("actionType", isCurrentlyRentable ? "remove" : "add");
    formData.set("productId", productId);
    formData.set("productTitle", productTitle);
    submit(formData, { method: "post" });
    setSuccessMessage(
      isCurrentlyRentable
        ? `Removed "${productTitle}" from rentable products`
        : `Added "${productTitle}" as a rentable product`,
    );
  };

  return (
    <Page title="Rentable Products" backAction={{ url: "/app" }}>
      <Layout>
        {successMessage && (
          <Layout.Section>
            <Banner
              title={successMessage}
              tone="success"
              onDismiss={() => setSuccessMessage("")}
            />
          </Layout.Section>
        )}
        <Layout.Section>
          <Card padding="0">
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={products}
              loading={isLoading}
              renderItem={(product: {
                id: string;
                title: string;
                handle: string;
                featuredImage?: { url: string; altText?: string };
                status: string;
                totalInventory: number;
              }) => {
                const isRentable = rentableProductIds.includes(product.id);

                return (
                  <ResourceItem
                    id={product.id}
                    media={
                      <Thumbnail
                        source={product.featuredImage?.url || ImageIcon}
                        alt={product.featuredImage?.altText || product.title}
                        size="small"
                      />
                    }
                    accessibilityLabel={`Toggle rentable for ${product.title}`}
                    onClick={() => {}}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="bold">
                          {product.title}
                        </Text>
                        <InlineStack gap="200">
                          {isRentable && (
                            <Badge tone="success">Rentable</Badge>
                          )}
                          <Text as="span" variant="bodySm" tone="subdued">
                            Inventory: {product.totalInventory}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                      <Button
                        variant={isRentable ? "secondary" : "primary"}
                        onClick={() =>
                          handleToggleRentable(
                            product.id,
                            product.title,
                            isRentable,
                          )
                        }
                        loading={isLoading}
                      >
                        {isRentable ? "Remove" : "Make Rentable"}
                      </Button>
                    </InlineStack>
                  </ResourceItem>
                );
              }}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
