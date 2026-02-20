import { Component } from "react";
import { Banner, Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Page title="Something went wrong">
          <Layout>
            <Layout.Section>
              <Banner tone="critical">
                <BlockStack gap="200">
                  <Text as="p">The app encountered an error. Try refreshing the page.</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {this.state.error?.message}
                  </Text>
                </BlockStack>
              </Banner>
            </Layout.Section>
          </Layout>
        </Page>
      );
    }
    return this.props.children;
  }
}
