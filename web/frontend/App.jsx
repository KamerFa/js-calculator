import { Routes, Route } from "react-router-dom";
import { NavMenu } from "@shopify/app-bridge-react";
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
      <NavMenu>
        <a href="/" rel="home">Dashboard</a>
        <a href="/products">Products</a>
        <a href="/reservations">Reservations</a>
        <a href="/calendar">Calendar</a>
        <a href="/settings">Settings</a>
      </NavMenu>
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
