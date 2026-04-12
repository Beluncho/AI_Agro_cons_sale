import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Mock database state
  let status: "idle" | "pending" | "ready" | "error" = "idle";
  let chunks: any[] = [];

  // API routes
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/status", (req, res) => {
    res.json({ is_parsing: false, total_products: 28 });
  });

  app.get("/api/chunks", (req, res) => {
    const mockChunks = [
      {
        id: "kultivator_kbm",
        title: "Культиватор КБМ(T)",
        text: "Универсальный культиватор для предпосевной обработки почвы. Предназначен для создания идеального семенного ложа, уничтожения сорняков и выравнивания поверхности поля.",
        image: "https://pkyar.ru/upload/iblock/kbm_main.jpg",
        features: {
          "Ширина захвата": "6 м",
          "Мощность трактора": "150–200 л.с.",
          "Производительность": "4.5–6.0 га/ч"
        },
        variants: [
          {
            name: "КБМ-Т 6.0",
            description: "Тяжелая рамная версия для работы по стерне."
          },
          {
            name: "КБМ-Т 8.0",
            description: "Широкозахватная версия для больших площадей."
          }
        ]
      },
      {
        id: "trambovshiki",
        title: "Трамбовщик силосной массы ТСМ-3",
        text: "Специализированное оборудование для качественной трамбовки силоса и сенажа в траншеях. Обеспечивает высокую плотность укладки, что критично для сохранности кормов.",
        image: "https://pkyar.ru/upload/iblock/tsm_main.jpg",
        features: {
          "Рабочая ширина": "3 м",
          "Масса": "3500 кг",
          "Тип": "Навесной"
        },
        variants: [
          {
            name: "ТСМ-3",
            description: "Базовая модель."
          }
        ]
      },
      {
        id: "pritsep_ps_25",
        title: "Полуприцеп ПС-25",
        text: "Самосвальный полуприцеп большой грузоподъемности. Предназначен для транспортировки и разгрузки различных сельскохозяйственных грузов: зерна, силоса, навоза.",
        image: "https://pkyar.ru/upload/iblock/ps25_main.jpg",
        features: {
          "Грузоподъемность": "25 тонн",
          "Объем кузова": "30-40 м³",
          "Мощность трактора": "250+ л.с."
        },
        variants: [
          {
            name: "ПС-25 'Агро'",
            description: "Базовая комплектация для зерновых."
          }
        ]
      },
      {
        id: "borona_bt_9",
        title: "Борона БТ-9",
        text: "Тяжелая дисковая борона для основной и предпосевной обработки почвы. Эффективно измельчает пожнивные остатки и заделывает их в почву.",
        image: "https://pkyar.ru/upload/iblock/bt9_main.jpg",
        features: {
          "Ширина захвата": "9 м",
          "Глубина обработки": "12-15 см",
          "Рабочая скорость": "12-15 км/ч"
        },
        variants: [
          {
            name: "БТ-9 Стандарт",
            description: "Классическая дисковая борона."
          }
        ]
      }
    ];
    res.json({ chunks: mockChunks });
  });

  app.get("/api/image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Missing image URL");
    }

    try {
      console.log(`Proxying image: ${imageUrl}`);
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://pkyar.ru/",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        timeout: 15000,
        maxRedirects: 5
      });
      
      const contentType = response.headers["content-type"];
      if (contentType) res.setHeader("Content-Type", contentType);
      
      // Add CORS headers for the image
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      res.send(Buffer.from(response.data));
    } catch (error: any) {
      console.error(`Image proxy error for ${imageUrl}:`, error.message);
      // Return a reliable fallback image from the proxy itself
      try {
        const fallbackRes = await axios.get('https://picsum.photos/seed/psp/800/600', { responseType: "arraybuffer" });
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(Buffer.from(fallbackRes.data));
      } catch (fallbackError) {
        res.status(500).send("Error proxying image and fallback failed");
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
