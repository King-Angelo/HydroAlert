import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/directions", async (req, res) => {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination are required" });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (apiKey) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;
        const response = await fetch(googleUrl);
        const data: any = await response.json();
        
        if (data.status === "OK") {
          return res.json(data);
        }
      } catch (error) {
        console.error("Google Directions Error:", error);
      }
    }

    // Fallback to OSRM (Open Source Routing Machine) if Google fails or no key
    try {
      const [oLat, oLng] = (origin as string).split(",");
      const [dLat, dLng] = (destination as string).split(",");
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl);
      const data: any = await response.json();
      
      if (data.code === "Ok") {
        return res.json({
          status: "OK",
          provider: "osrm",
          routes: [{
            overview_polyline: {
              points: data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]])
            },
            summary: data.routes[0].weight_name,
            legs: [{
              distance: { text: (data.routes[0].distance / 1000).toFixed(1) + " km" },
              duration: { text: Math.round(data.routes[0].duration / 60) + " mins" }
            }]
          }]
        });
      }
    } catch (error) {
      console.error("OSRM Fallback Error:", error);
    }

    res.status(500).json({ error: "Failed to fetch directions" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files and handle SPA fallback
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
