import { Routes, Route } from "react-router-dom";
import { NavigationMenu } from "@shopify/app-bridge-react";
import { Frame } from "@shopify/polaris";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ReservationsPage from "./pages/ReservationsPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Frame>
      <NavigationMenu
        navigationLinks={[
          { label: "Dashboard", destination: "/" },
          { label: "Products", destination: "/products" },
          { label: "Reservations", destination: "/reservations" },
          { label: "Calendar", destination: "/calendar" },
          { label: "Settings", destination: "/settings" },
        ]}
      />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Frame>
  );
}
