import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { readHomologEnvironment } from "./config/homolog-environment.ts"

export default defineConfig(({ mode }) => {
  const homologEnvironment = mode === "homolog" ? readHomologEnvironment(import.meta.dirname) : undefined
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": import.meta.dirname + "/src" } },
    define: {
      "import.meta.env.VITE_APP_ENVIRONMENT": JSON.stringify(homologEnvironment ? "homolog" : "production"),
      ...(homologEnvironment ? {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(homologEnvironment.url),
        "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(homologEnvironment.anonKey),
      } : {}),
    },
    test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: true },
  }
})
