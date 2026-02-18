import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { login } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const errors = await login(request);
  return json({ errors });
};

export const action = async ({ request }) => {
  const errors = await login(request);
  return json({ errors });
};

export default function Auth() {
  const { errors } = useLoaderData();

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <BlockStack gap="300">
                <Text variant="headingLg">Log in</Text>
                <TextField
                  type="text"
                  name="shop"
                  label="Shop domain"
                  helpText="e.g. my-shop.myshopify.com"
                  autoComplete="on"
                  error={errors?.shop}
                />
                <Button submit variant="primary">
                  Log in
                </Button>
              </BlockStack>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
