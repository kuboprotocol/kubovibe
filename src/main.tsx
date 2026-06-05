import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertFrontendEnv } from "./lib/envCheck";

assertFrontendEnv();

createRoot(document.getElementById("root")!).render(<App />);
