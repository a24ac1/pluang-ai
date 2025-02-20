import dotenv from "dotenv";
import axios from "axios";
import { OpenAI } from "openai";

dotenv.config();

// Pastikan API Key tersedia
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERROR: API Key OpenAI tidak ditemukan. Pastikan sudah diset di .env");
  process.exit(1);
}

// Inisialisasi OpenAI dengan API Key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Daftar aset crypto & saham yang akan dianalisis
const cryptoAssets = ["BTC", "XRP"];
const stockAssets = [
  { symbol: "META", id: "10005" },
  { symbol: "GOOGLE", id: "10006" },
  { symbol: "APPLE", id: "10003" },
  { symbol: "ISRG", id: "10401" },
  { symbol: "NVDA", id: "10058" },
  { symbol: "MSFT", id: "10004" },
];

// Fungsi untuk mengambil data teknikal aset dari Pluang
async function getTechnicalData(asset, category, assetId = null) {
  let url = `https://api-pluang.pluang.com/api/v4/technical-indicators/summary`;
  const params = { timeFrame: "DAILY" };

  if (category === "crypto") {
    params.assetCategory = "cryptocurrency";
    params.assetSymbol = asset;
  } else if (category === "stock") {
    params.assetCategory = "global_stock";
    params.assetId = assetId;
  }

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching Technical Data for ${asset}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk mengambil harga terbaru (OHLC) aset crypto dari Pluang
async function getCryptoPrice(asset) {
  const today = new Date().toISOString().split("T")[0];
  const startDate = `${today}T00:00:00.000Z`;

  try {
    const response = await axios.get(
      `https://api-pluang.pluang.com/api/v4/asset/cryptocurrency/price/ohlcStatsByDateRange/${asset}`,
      {
        params: { timeFrame: "DAILY", startDate },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching OHLC Data for ${asset}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk mengambil harga terbaru saham dari Pluang
async function getStockPrice(stockId) {
  try {
    const response = await axios.get(
      `https://api-pluang.pluang.com/api/v4/asset/global-stock/price/currentPriceByStockIds`,
      {
        params: { globalStockIds: stockId },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching Stock Price for ${stockId}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk menganalisis aset menggunakan OpenAI
async function analyzeAsset(asset, category, assetId = null) {
  const technicalData = await getTechnicalData(asset, category, assetId);
  const priceData = category === "crypto" ? await getCryptoPrice(asset) : await getStockPrice(assetId);

  if (!technicalData || !priceData) {
    console.log(`❌ Gagal mengambil data untuk ${asset}.`);
    return;
  }

  // Format prompt untuk AI
  const prompt = `Berdasarkan data analisis teknikal berikut untuk aset ${asset}:\n\n${JSON.stringify(technicalData, null, 2)}\n\n
  Dan data harga terbaru ${asset}:\n\n${JSON.stringify(priceData, null, 2)}\n\n
  Tolong berikan saran apakah saya harus **membeli, menjual, atau hold** ${asset} saat ini. 
  Jawab dalam format JSON dengan key tanpa highlighting code:\n
  {
    "message": "Ringkasan keputusan untuk ${asset}",
    "sell_price": "Harga jual jika direkomendasikan  dengan format number_format",
    "buy_price": "Harga beli jika direkomendasikan dengan format number_format",
    "stop_loss": "Harga stop loss dengan format number_format",
    "take_profit": "Harga take profit dengan format number_format",
    "status": "buy/sell/netral"
  }`;
  try {
    const response = await openai.chat.completions.create({
      model: "o1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    // Parsing hasil AI menjadi JSON
    const aiResponse = response.choices[0].message.content;
    try {
      const parsedResponse = JSON.parse(aiResponse);
      console.log(`📊 AI Analysis for ${asset}:`, parsedResponse);
    } catch (jsonError) {
      console.error(`⚠️ AI Response for ${asset} is not in JSON format:`, aiResponse);
    }
  } catch (error) {
    console.error(`❌ Error generating AI response for ${asset}:`, error.response?.data || error.message);
  }
}

// Jalankan analisis untuk semua aset
async function analyzeAllAssets() {
  for (const asset of cryptoAssets) {
    await analyzeAsset(asset, "crypto");
  }

  for (const stock of stockAssets) {
    await analyzeAsset(stock.symbol, "stock", stock.id);
  }
}

// Jalankan analisis
analyzeAllAssets();
