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

// Daftar saham yang akan dianalisis dengan ID dari Pluang
const stockAssets = [
	{ symbol: "VRSN", id: "10586" },
  { symbol: "AAPL", id: "10003" },
  { symbol: "META", id: "10005" },
  { symbol: "GOOG", id: "10006" },
  { symbol: "ISRG", id: "10401" },
  { symbol: "NVDA", id: "10058" },
  { symbol: "MSFT", id: "10004" },
];

// Fungsi untuk mengambil laporan keuangan saham
async function getFinancialData(stockId, type) {
  const baseUrl = "https://api-pluang.pluang.com/api/v3/asset/global-stock/financials/";
  const endpoints = {
    balanceSheet: "balanceSheet",
    cashflowStatement: "cashflowStatement",
    incomeStatement: "incomeStatement",
  };

  try {
    const response = await axios.get(`${baseUrl}${endpoints[type]}`, {
      params: { stockId, timePeriod: "QUARTER", dataFormat: "TEXT" },
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching ${type} for stock ${stockId}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk mengambil berita terkait saham
async function getStockNews(symbol) {
  try {
    const response = await axios.get("https://newsdata.io/api/1/news", {
      params: { apikey: "pub_7081508f1f0798822f64325532e5abcbebb52", q: `${symbol} stock`, language: "en", category: "business" },
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching news for ${symbol}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk mengambil harga saham terkini
async function getCurrentPrice(stockId) {
  const baseUrl = "https://api-pluang.pluang.com/api/v4/asset/global-stock/price/currentPriceByStockIds";
  try {
    const response = await axios.get(baseUrl, {
      params: { globalStockIds: stockId }
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching current price for stock ${stockId}:`, error.response?.data || error.message);
    return null;
  }
}

// Fungsi untuk menganalisis keuangan saham dengan OpenAI
async function analyzeFinancials(stock) {
  const balanceSheet = await getFinancialData(stock.id, "balanceSheet");
  const cashflowStatement = await getFinancialData(stock.id, "cashflowStatement");
  const incomeStatement = await getFinancialData(stock.id, "incomeStatement");
  const currentPriceData = await getCurrentPrice(stock.id);
  const today = new Date().toISOString().split("T")[0];
	

  // Cek apakah fitur getStockNews diaktifkan melalui variabel lingkungan
  let newsData = {};
  if (process.env.ENABLE_STOCK_NEWS === "true") {
    newsData = await getStockNews(stock.symbol);
  } else {
    console.log(`ℹ️ Fitur getStockNews dinonaktifkan untuk ${stock.symbol}.`);
  }

  if (!balanceSheet || !cashflowStatement || !incomeStatement || !currentPriceData) {
    console.log(`❌ Gagal mengambil data keuangan atau harga untuk ${stock.symbol}.`);
    return;
  }

  // "message": "berikan ringkasan hasil analisis dari Balance Sheet , Cash Flow Statement, dan Income Statement.",
  // Format prompt untuk AI
  const prompt = `Berdasarkan laporan keuangan berikut untuk ${stock.symbol}:
  
Balance Sheet:
${JSON.stringify(balanceSheet, null, 2)}

Cash Flow Statement:
${JSON.stringify(cashflowStatement, null, 2)}

Income Statement:
${JSON.stringify(incomeStatement, null, 2)}

Berita terkini:
${JSON.stringify(newsData, null, 2)}

Harga saham terkini pada tanggal ${today} dan saya membeli saham sebesar 10000000 rupiah pada hari ini dengan kurs rupiah ke us Rp. 16.330 :
${JSON.stringify(currentPriceData, null, 2)}

Tolong berikan analisis mengenai kesehatan keuangan perusahaan ini, mencakup profitabilitas, risiko, kelayakan investasi, serta prediksi harga saham untuk kuartal berikutnya pada tahun 2025.
Jawab dalam format JSON dengan key tanpa highlighting code:
{
  "financial_health": "Sehat/Tidak Sehat",
  "profitability": "Tinggi/Sedang/Rendah",
  "risk_level": "Rendah/Sedang/Tinggi",
  "investment_recommendation": "Buy/Sell",
  "sentiment": "Positif/Netral/Negatif",
  "currentPriceData": "harga saham terkini dengan number_format",
  "p_quarterly": "prediksi harga saham berikutnya dengan number_format",
   prediction: {
    percentage_return: 'persentase keuntungan yang telah saya peroleh',
    timeline: 'kapan kuartal berikutnya—sertakan pula bulan pelaksanaannya',
    explanation: 'alasan serta dasar perhitungan persentase tersebut.'
  },
  "confidence": "Tentukan persentase tentang saham ini , peluang kenaikan harga saham atau mungkin penurunan harga saham. Berikan penilaian secara jujur dan sungguh-sungguh, meskipun hasilnya mungkin tidak sempurna."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "o1-mini",
      messages: [{ role: "user", content: prompt }]
    });

    // Parsing hasil AI menjadi JSON
    const aiResponse = response.choices[0].message.content;
    try {
      const parsedResponse = JSON.parse(aiResponse);
      console.log(`📊 AI Financial Analysis for ${stock.symbol}:`, parsedResponse);
    } catch (jsonError) {
      console.error(`⚠️ AI Response for ${stock.symbol} is not in JSON format:`, aiResponse);
    }
  } catch (error) {
    console.error(`❌ Error generating AI response for ${stock.symbol}:`, error.response?.data || error.message);
  }
}

async function analyzeAllStocks() {
  for (const stock of stockAssets) {
    await analyzeFinancials(stock);
  }
}

// Jalankan analisis
analyzeAllStocks();
