import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { LoginPage } from "./login";
import { initAdminTheme } from "./theme";
import "./style.css";

function LoginRoot() {
  useEffect(() => {
    initAdminTheme(document.getElementById("admin-theme-btn"));
  }, []);
  return <LoginPage />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoginRoot />
  </StrictMode>,
);
