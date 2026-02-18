import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rentableCount = await db.rentableProduct.count({
    where: { shop: session.shop },
  });

  return { shop: session.shop, rentableCount };
};

export default function Index() {
  const { shop, rentableCount } = useLoaderData<typeof loader>();

  return (
    <Page title="Bike Reservations">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Welcome to Bike Reservations
              </Text>
              <Text as="p" variant="bodyMd">
                Connected to: {shop}
              </Text>
              <Text as="p" variant="bodyMd">
                You have {rentableCount} product{rentableCount !== 1 ? "s" : ""}{" "}
                marked as rentable.
              </Text>
              <Text as="p" variant="bodyMd">
                Go to the "Rentable Products" page to select which products
                customers can rent.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
