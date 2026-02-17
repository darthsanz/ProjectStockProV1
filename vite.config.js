import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        signup: resolve(__dirname, "signup.html"),
        // Si tienes más páginas (ej. registro.html), añádelas aquí
      },
    },
  },
});
