import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner, BlockStack, Text, Button, Page, Layout, Card } from "@shopify/polaris";

/**
 * Handles the /exitiframe redirect that Shopify's ensureInstalledOnShop
 * middleware uses when re-authentication is needed inside an embedded app.
 *
 * Navigates the iframe (not the top window, which is blocked by cross-origin
 * policy) to the auth URL. The server's auth handler will take it from there.
 */
export default function ExitIframe() {
  const [searchParams] = useSearchParams();
  const redirectUri = searchParams.get("redirectUri");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (redirectUri) {
      try {
        // Navigate the iframe itself to the auth URL (same origin, so it's allowed).
        // The server's auth.begin() handler will redirect to Shopify OAuth from there.
        window.location.assign(redirectUri);
      } catch {
        // If programmatic navigation fails, show a manual button
        setShowManual(true);
      }
    }
  }, [redirectUri]);

  if (showManual || !redirectUri) {
    return (
      <Page title="Authentication required">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="p">This app needs to re-authenticate with Shopify.</Text>
                {redirectUri ? (
                  <a href={redirectUri} target="_top" style={{ textDecoration: "none" }}>
                    <Button variant="primary">Log in</Button>
                  </a>
                ) : (
                  <Text as="p" tone="subdued">No redirect URL provided.</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <BlockStack align="center" inlineAlign="center">
      <Spinner size="large" />
      <Text as="p">Redirecting to login...</Text>
    </BlockStack>
  );
}
