import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner, BlockStack, Text } from "@shopify/polaris";

/**
 * Handles the /exitiframe redirect that Shopify's ensureInstalledOnShop
 * middleware uses when re-authentication is needed inside an embedded app.
 * It reads the `redirectUri` query param and navigates the top-level window.
 */
export default function ExitIframe() {
  const [searchParams] = useSearchParams();
  const redirectUri = searchParams.get("redirectUri");

  useEffect(() => {
    if (redirectUri) {
      // Use App Bridge's redirect if available, otherwise fall back to top-level navigation
      if (window.top && window.top !== window.self) {
        window.top.location.href = redirectUri;
      } else {
        window.location.href = redirectUri;
      }
    }
  }, [redirectUri]);

  return (
    <BlockStack align="center" inlineAlign="center">
      <Spinner size="large" />
      <Text as="p">Redirecting...</Text>
    </BlockStack>
  );
}
