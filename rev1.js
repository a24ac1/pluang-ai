require('dotenv').config();
const axios = require('axios');
const { OpenAI } = require('openai');

// Buat instance OpenAI dengan API key dari file .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Header yang digunakan untuk semua request ke API Pluang
const headers = {
  accept: 'application/json, text/plain, */*',
  authorization: `Bearer ${process.env.PLUANG_API_TOKEN}`,
  origin: 'https://trade.pluang.com',
  referer: 'https://trade.pluang.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};

// Mapping kode saham ke ID-nya
const stockIDs = {
  	AAPL: "10003",
  	ISRG: "10401",
  	VRSN: "10586",
  	LLY:  "10058",
 	NVDA: "10058",
  	MSFT: "10004",
  	GOOG: "10006",
  	META: "10005"
};

// Fungsi untuk mengambil data asset holdings
async function getHoldings() {
  try {
    const url = 'https://api-pluang.pluang.com/api/v4/portfolio/asset-holdings?isTodayReturn=true&pageSize=50&page=1&currency=USD&category=global_equity&sortKey=value_desc';
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error("Error fetching holdings:", error);
  }
}

// Fungsi untuk mendapatkan harga saham saat ini
async function getCurrentPrice(stockId) {
  try {
    const url = `https://api-pluang.pluang.com/api/v4/asset/global-stock/price/currentPriceByStockIds?globalStockIds=${stockId}`;
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching current price for ${stockId}:`, error);
  }
}

// Fungsi untuk mendapatkan indikator teknis
async function getTechnicalIndicator(stockId) {
  try {
    const url = `https://api-pluang.pluang.com/api/v4/technical-indicators/summary?assetCategory=global_stock&timeFrame=DAILY&assetId=${stockId}`;
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching technical indicator for ${stockId}:`, error);
  }
}

// Fungsi untuk mendapatkan detail posisi saham
async function getStockOverview(stockId) {
  try {
    const url = `https://api-pluang.pluang.com/api/v4/asset/global-stock/${stockId}/overview/position`;
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching stock overview for ${stockId}:`, error);
  }
}

// Fungsi untuk menganalisis data saham menggunakan OpenAI (Chat Completion API)
async function analyzeStockData(stockSymbol, prompt) {
  try { 
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt },
        { role: 'system', content: 'Kamu adalah trader yang memikirkan keuntungan.' }
      ],
      temperature: 0.0,
      functions: [
        {
          name: "execute_trade",
          description:
            "Menjalankan perintah trading untuk saham berdasarkan data holdings, harga terkini, indikator teknikal, dan portofolio saham.",
          parameters: {
            type: "object",
            properties: {
              /*holdings: {
                type: "array",
                description: "Daftar saham yang dimiliki. data diambil dari total Value And Profit dan asset Categories pada holdings",
                items: {
                  type: "object",
                  properties: {
                    kode_saham: {
                      type: "string",
                      description: "Kode unik saham yang dimiliki."
                    },
                    nama_saham: {
                      type: "string",
                      description: "Nama lengkap saham yang dimiliki."
                    },
                    jumlah: {
                      type: "number",
                      description: "Jumlah unit saham yang dimiliki."
                    },
                    nilai_investasi: {
                      type: "number",
                      description: "Nilai investasi saham yang dimiliki."
                    }
                  },
                  required: ["kode_saham", "nama_saham", "jumlah", "nilai_investasi"]
                }
              },*/
              indikator_teknikal: {
                type: "string",
                description: "Data indikator teknikal untuk saham.",
                enum: ["BEARISH", "NEUTRAL", "OVERBOUGHT", "OVERSOLD", "SIDEWAYS", "DIVERGENCE"],
              },
              portofolio_saham: {
                type: "object",
                description: "Informasi portofolio saham yang diamati.",
                properties: {
                  	total_investasi: {
                    	type: "number",
                    	description: "Total nilai investasi pada portofolio."
                  	},
                  	kode_saham: {
	                  type: "string",
	                  description: "Kode saham."
	              	},
	              	profitValue: {
	                  type: "number",
	                  description: "berapa dollar profitValue saham yang diamati."
	              	},
	              	profitValuePercentage: {
	                  type: "number",
	                  description: "berapa profitValuePercentage saham yang diamati."
	              	}
                },
                required: ["total_investasi", "kode_saham", "profitValue", "profitValuePercentage"]
              },
              tindakan_trading: {
                type: "object",
                description:
                  "Perintah trading yang akan diambil berdasarkan analisa data saham yang diamati.",
                properties: {
                  	kode_saham: {
                    	type: "string",
                    	description: "Kode saham untuk tindakan trading."
                  	},
                  	aksi: {
                    	type: "string",
                    	enum: ["BUY", "SELL", "HOLD"],
                    	description: "Tindakan trading yang diambil."
                  	},
                  	alasan: {
                    	type: "string",
                    	description: "Alasan atau sinyal yang mendasari keputusan trading."
                  	},
		            harga_terkini: {
		                type: "number",
		                description: "Harga terkini saham yang diamati.",
		            },
                  	entry_price: {
		              type: "number",
		              description: "Harga masuk yang direkomendasikan pada saham yang diamati jika aksi adalah Buy atau Sell."
		            },
		            stop_loss: {
		              type: "number",
		              description: "Tingkat stop-loss yang direkomendasikan pada saham yang diamati untuk membatasi kerugian."
		            },
		            take_profit: {
		              type: "number",
		              description: "Target take-profit yang direkomendasikan pada saham yang diamati untuk mengamankan keuntungan."
		            },
                },
                required: ["kode_saham", "aksi", "alasan", "entry_price", "stop_loss", "take_profit", "harga_terkini"]
              },
              tindakan_stock: {
                type: "string",
                description: "berikan tanggal dan bulan untuk deviden yang akan dibagikan berikutnya. sarankan beli sebelum kapan."
              },
              status_stock: {
                type: "string",
                description: "apakah hari ini bisa melakukan pembelian saham us."
              }
            },
            required: [
              //"holdings",
            	"tindakan_stock",
              "harga_terkini",
              "indikator_teknikal",
              "portofolio_saham",
              "tindakan_trading"
            ]
          }
        }
      ]
    });

    const message = completion.choices[0].message;
    let analysisResult = "";

    // Cek apakah ada content, jika tidak, coba ambil dari function_call.arguments
    if (message.content && message.content.trim()) {
      analysisResult = message.content.trim();
    } else if (message.function_call && message.function_call.arguments) {
      analysisResult = message.function_call.arguments;
    } else {
      analysisResult = "Tidak ada analisis yang diberikan oleh model.";
    }
    return analysisResult;
  } catch (error) {
    console.error(`Error analyzing data for ${stockSymbol}:`, error);
  }
}
async function fetchStockData(stockId) {
  try {
    const [actionsResponse, balanceSheetResponse, cashflowResponse, incomeStatementResponse] = await Promise.all([
      axios.get(`https://api-pluang.pluang.com/api/v4/asset/global-stock/${stockId}/corporateActions`),
      axios.get(`https://api-pluang.pluang.com/api/v3/asset/global-stock/financials/balanceSheet?stockId=${stockId}&timePeriod=QUARTER&dataFormat=TEXT`),
      axios.get(`https://api-pluang.pluang.com/api/v3/asset/global-stock/financials/cashflowStatement?stockId=${stockId}&timePeriod=QUARTER&dataFormat=TEXT`),
      axios.get(`https://api-pluang.pluang.com/api/v3/asset/global-stock/financials/incomeStatement?stockId=${stockId}&timePeriod=QUARTER&dataFormat=TEXT`)
    ]); 

    return {
      corporateActions: actionsResponse.data.data.upcoming,
      balanceSheet: balanceSheetResponse.data,
      cashflowStatement: cashflowResponse.data,
      incomeStatement: incomeStatementResponse.data
    };
  } catch (error) {
    console.error('Gagal mengambil data saham:', error);
    return null;
  }
}


// Fungsi utama untuk memonitor saham
async function monitorStocks() {
  console.log("Mengambil asset holdings..."); 
  const holdings 			= await getHoldings();
  const today 				= new Date().toISOString().split("T")[0];
  for (const [symbol, id] of Object.entries(stockIDs)) {

    const priceData 		= await getCurrentPrice(id);
    const technicalData 	= await getTechnicalIndicator(id);
    const overviewData 		= await getStockOverview(id);
	const stockData 		= await fetchStockData(id); 


    const datanya = {
      holdings: {
        totalValueAndProfit: holdings.data.totalValueAndProfit,
        assetCategories: holdings.data.assetCategories,
      },
      latest_price: priceData.data[id],
      technical_indicators: technicalData.data,
      portfolio_stock: overviewData.data,
    };

    const prompt = `Analisa data dan fokus pada ${symbol} :
- Hari ini : ${today}
- Holdings:
    - total Value And Profit: ${JSON.stringify(datanya.holdings.totalValueAndProfit, null, 2)}
    - asset Categories: ${JSON.stringify(datanya.holdings.assetCategories, null, 2)}
- Harga Terkini:
    ${JSON.stringify(datanya.latest_price)}
- Indikator Teknikal:
    ${JSON.stringify(datanya.technical_indicators)}
- Portofolio Saham: 
    ${JSON.stringify(datanya.portfolio_stock)}
- Aksi korporasi: 
	${JSON.stringify(stockData.corporateActions)}

Berapa Nilai Total dan Keuntungan saham ${symbol} dan berapa yang saya miliki. Berapa harga terkini ${symbol} , Tindakan trading yang akan diambil: Buy (beli), Sell (jual), atau Hold (tahan).fokus pada saham ${symbol}`; 
    const analysis = await analyzeStockData(symbol, prompt);

    // Tangani parsing JSON dengan try-catch untuk menghindari error bila output tidak valid JSON
    let tradeDecision;
    try {
      tradeDecision = JSON.parse(analysis);
    } catch (error) {
    	console.error('❌ Gagal mengambil data saham:', error);
      	continue; // Lewati ke iterasi berikutnya jika parsing gagal
    }

    console.log("💡 Keputusan AI:", tradeDecision);
    console.log("\r\n=======================================================\r\n");
  }
}


monitorStocks();
