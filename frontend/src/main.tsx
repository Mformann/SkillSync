import { createRoot } from "react-dom/client";
import App from "./app/App";
import { AppErrorBoundary } from "./app/components/app-error-boundary";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
