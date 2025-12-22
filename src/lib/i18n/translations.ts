export const translations = {
  pt: {
    // App name
    appName: "Caça Pechinchas",
    appNameShort: "C",

    // Navigation
    nav: {
      deals: "Ofertas",
      saved: "Favoritos",
      settings: "Definições",
      admin: "Admin",
    },

    // Deals page
    deals: {
      title: "Encontre as Melhores Ofertas de Carros Usados em Portugal",
      count: "ofertas",
      lastUpdate: "Última Atualização",
      noDeals: "Sem ofertas",
      noDealsDesc: "Execute a recolha para obter listagens.",
      goToAdmin: "Ir para Admin",
      loadMore: "Carregar Mais",
      sortBy: {
        score_desc: "Melhor Pontuação",
        price_asc: "Preço: Menor",
        price_desc: "Preço: Maior",
        year_desc: "Ano: Mais Recente",
        year_asc: "Ano: Mais Antigo",
        mileage_asc: "Quilometragem: Menor",
        mileage_desc: "Quilometragem: Maior",
      },
    },

    // Filters
    filters: {
      title: "Filtros",
      reset: "Limpar",
      dealScore: "Pontuação",
      hideUnavailable: "Ocultar indisponíveis",
      hideUnavailableDesc: "Ocultar listagens removidas do StandVirtual",
      price: "Preço",
      year: "Ano",
      mileage: "Quilometragem",
      make: "Marca",
      allMakes: "Todas as marcas",
      model: "Modelo",
      allModels: "Todos os modelos",
      region: "Região",
      allRegions: "Todas as regiões",
      fuelType: "Combustível",
      gearbox: "Caixa",
      priceEvaluation: "Avaliação de Preço",
      enginePower: "Potência (cv)",
    },

    // Fuel types
    fuel: {
      diesel: "Diesel",
      gasoline: "Gasolina",
      electric: "Elétrico",
      hybrid: "Híbrido",
      "plug-in-hybrid": "Híbrido Plug-in",
      lpg: "GPL",
    },

    // Gearbox
    gearbox: {
      manual: "Manual",
      automatic: "Automático",
    },

    // Price evaluation
    priceEval: {
      below: "Abaixo do Mercado",
      in: "No Mercado",
      above: "Acima do Mercado",
    },

    // Card labels
    card: {
      year: "Ano",
      mileage: "Quilometragem",
      fuel: "Combustível",
      gearbox: "Caixa",
      power: "Potência",
      engine: "Motor",
      viewInStandVirtual: "Ver no StandVirtual",
      addToFavorites: "Adicionar aos Favoritos",
      removeFromFavorites: "Remover dos Favoritos",
      new: "NOVO",
      published: "Publicado",
      score: "Pontuação",
      priceDropped: "Preço baixou",
      priceIncreased: "Preço subiu",
      priceHistory: "Histórico de Preços",
      currentPrice: "Preço atual",
      previousPrice: "Preço anterior",
      noHistory: "Sem histórico de preços",
    },

    // Score breakdown (tooltip)
    scoreBreakdown: {
      title: "Detalhes da Pontuação",
      priceVsSegment: "Preço vs Segmento",
      priceEvaluation: "Avaliação de Preço",
      mileageQuality: "Qualidade da Km",
      pricePerKm: "Preço por Km",
      total: "Total",
    },

    // Saved page (Favorites)
    saved: {
      title: "Favoritos",
      empty: "Nenhum favorito",
      emptyDesc: "Adicione ofertas aos favoritos clicando no coração.",
    },

    // Settings page
    settings: {
      title: "Definições",
      weightsTitle: "Pesos do Algoritmo",
      weightsDesc: "Ajuste a importância de cada fator na pontuação das ofertas.",
      priceVsSegment: "Preço vs Segmento",
      priceVsSegmentDesc: "Compara o preço com veículos similares",
      priceEvaluation: "Avaliação de Preço",
      priceEvaluationDesc: "Avaliação do StandVirtual (Abaixo/No/Acima do mercado)",
      mileageQuality: "Qualidade da Quilometragem",
      mileageQualityDesc: "Avalia a quilometragem em relação à idade",
      pricePerKm: "Preço por Km",
      pricePerKmDesc: "Valor relativo baseado no preço por quilómetro",
      total: "Total",
      mustEqual100: "Os pesos devem somar 100%",
      currentTotal: "Total atual",
      save: "Guardar Pesos",
      saving: "A guardar...",
      saveSuccess: "Pesos guardados com sucesso!",
      saveFailed: "Erro ao guardar pesos",
      recalculate: "Recalcular Pontuações",
      recalculating: "A recalcular...",
      recalculateSuccess: "Pontuações recalculadas para",
      recalculateFailed: "Erro ao recalcular pontuações",
      resetDefaults: "Repor Padrões",
      howItWorks: "Como Funciona",
      howItWorksDesc: "O algoritmo calcula uma pontuação de 0-100 para cada listagem com base nos pesos configurados.",
    },

    // Admin page
    admin: {
      title: "Painel de Administração",
      description: "Gerir a recolha de dados e ver estatísticas da base de dados.",
      stats: "Estatísticas",
      totalListings: "Total de Listagens",
      activeListings: "Listagens Ativas",
      belowMarket: "Abaixo do Mercado",
      inMarket: "No Mercado",
      aboveMarket: "Acima do Mercado",
      lastScrape: "Última Recolha",
      scrapeHistory: "Histórico de Recolhas",
      topMakes: "Marcas Principais",
      runScraper: "Iniciar Recolha",
      running: "A executar...",
      scraperControls: "Controlos de Recolha",
      idle: "Inativo",
      progress: "Progresso",
      page: "Página",
      listingsFound: "listagens encontradas",
      listings: "listagens",
      scraping: "A recolher...",
      startScrape: "Iniciar Recolha",
      scraperStarted: "Recolha iniciada! Veja o progresso abaixo.",
      scrapeCompleted: "Recolha concluída! Estatísticas atualizadas.",
      failedToStart: "Falha ao iniciar a recolha",
      dbStats: "Estatísticas da Base de Dados",
      when: "Quando",
      status: "Estado",
      pages: "Páginas",
      found: "Encontradas",
      new: "Novas",
      updated: "Atualizadas",
      unavailable: "Indisponíveis",
      statusCompleted: "Concluído",
      statusRunning: "A executar",
      statusFailed: "Falhou",
    },

    // Detail page
    detail: {
      backToDeals: "Voltar às Ofertas",
      specifications: "Especificações",
      make: "Marca",
      model: "Modelo",
      version: "Versão",
      year: "Ano",
      mileage: "Quilometragem",
      fuelType: "Combustível",
      gearbox: "Caixa",
      engineCapacity: "Cilindrada",
      enginePower: "Potência",
      location: "Localização",
      seller: "Vendedor",
      dealScore: "Pontuação",
      scoreBreakdown: "Detalhes da Pontuação",
      priceVsSegment: "Preço vs Segmento",
      priceEvaluation: "Avaliação de Preço",
      mileageQuality: "Qualidade da Quilometragem",
      pricePerKm: "Preço por Km",
      viewOnStandVirtual: "Ver no StandVirtual",
      saveDeal: "Guardar Oferta",
      market: "Mercado",
    },

    // Time
    time: {
      justNow: "agora mesmo",
      minutesAgo: "min atrás",
      hoursAgo: "h atrás",
      daysAgo: "d atrás",
    },

    // Language
    language: "Idioma",
    portuguese: "Português",
    english: "English",
  },

  en: {
    // App name
    appName: "Caça Pechinchas",
    appNameShort: "C",

    // Navigation
    nav: {
      deals: "Deals",
      saved: "Favorites",
      settings: "Settings",
      admin: "Admin",
    },

    // Deals page
    deals: {
      title: "Find the Best Used Car Deals in Portugal",
      count: "deals",
      lastUpdate: "Last Update",
      noDeals: "No deals found",
      noDealsDesc: "Run the scraper to fetch listings.",
      goToAdmin: "Go to Admin",
      loadMore: "Load More",
      sortBy: {
        score_desc: "Best Score",
        price_asc: "Price: Low to High",
        price_desc: "Price: High to Low",
        year_desc: "Year: Newest",
        year_asc: "Year: Oldest",
        mileage_asc: "Mileage: Lowest",
        mileage_desc: "Mileage: Highest",
      },
    },

    // Filters
    filters: {
      title: "Filters",
      reset: "Reset",
      dealScore: "Deal Score",
      hideUnavailable: "Hide unavailable",
      hideUnavailableDesc: "Hide listings no longer on StandVirtual",
      price: "Price",
      year: "Year",
      mileage: "Mileage",
      make: "Make",
      allMakes: "All makes",
      model: "Model",
      allModels: "All models",
      region: "Region",
      allRegions: "All regions",
      fuelType: "Fuel Type",
      gearbox: "Gearbox",
      priceEvaluation: "Price Evaluation",
      enginePower: "Engine Power (cv)",
    },

    // Fuel types
    fuel: {
      diesel: "Diesel",
      gasoline: "Gasoline",
      electric: "Electric",
      hybrid: "Hybrid",
      "plug-in-hybrid": "Plug-in Hybrid",
      lpg: "LPG",
    },

    // Gearbox
    gearbox: {
      manual: "Manual",
      automatic: "Automatic",
    },

    // Price evaluation
    priceEval: {
      below: "Below Market",
      in: "At Market",
      above: "Above Market",
    },

    // Card labels
    card: {
      year: "Year",
      mileage: "Mileage",
      fuel: "Fuel",
      gearbox: "Gearbox",
      power: "Power",
      engine: "Engine",
      viewInStandVirtual: "View in StandVirtual",
      addToFavorites: "Add to Favorites",
      removeFromFavorites: "Remove from Favorites",
      new: "NEW",
      published: "Published",
      score: "Score",
      priceDropped: "Price dropped",
      priceIncreased: "Price increased",
      priceHistory: "Price History",
      currentPrice: "Current price",
      previousPrice: "Previous price",
      noHistory: "No price history",
    },

    // Score breakdown (tooltip)
    scoreBreakdown: {
      title: "Score Breakdown",
      priceVsSegment: "Price vs Segment",
      priceEvaluation: "Price Evaluation",
      mileageQuality: "Mileage Quality",
      pricePerKm: "Price per Km",
      total: "Total",
    },

    // Saved page (Favorites)
    saved: {
      title: "Favorites",
      empty: "No favorites",
      emptyDesc: "Add deals to favorites by clicking the heart icon.",
    },

    // Settings page
    settings: {
      title: "Settings",
      weightsTitle: "Algorithm Weights",
      weightsDesc: "Adjust the importance of each factor in the deal score calculation.",
      priceVsSegment: "Price vs Segment",
      priceVsSegmentDesc: "Compares price to similar vehicles",
      priceEvaluation: "Price Evaluation",
      priceEvaluationDesc: "StandVirtual's evaluation (Below/At/Above market)",
      mileageQuality: "Mileage Quality",
      mileageQualityDesc: "Evaluates mileage relative to age",
      pricePerKm: "Price per Km",
      pricePerKmDesc: "Relative value based on price per kilometer",
      total: "Total",
      mustEqual100: "Weights must add up to 100%",
      currentTotal: "Current total",
      save: "Save Weights",
      saving: "Saving...",
      saveSuccess: "Weights saved successfully!",
      saveFailed: "Failed to save weights",
      recalculate: "Recalculate Scores",
      recalculating: "Recalculating...",
      recalculateSuccess: "Recalculated scores for",
      recalculateFailed: "Failed to recalculate scores",
      resetDefaults: "Reset to Defaults",
      howItWorks: "How It Works",
      howItWorksDesc: "The algorithm calculates a 0-100 score for each listing based on the configured weights.",
    },

    // Admin page
    admin: {
      title: "Admin Dashboard",
      description: "Manage the scraper and view database statistics.",
      stats: "Statistics",
      totalListings: "Total Listings",
      activeListings: "Active Listings",
      belowMarket: "Below Market",
      inMarket: "At Market",
      aboveMarket: "Above Market",
      lastScrape: "Last Scrape",
      scrapeHistory: "Scrape History",
      topMakes: "Top Makes",
      runScraper: "Run Scraper",
      running: "Running...",
      scraperControls: "Scraper Controls",
      idle: "Idle",
      progress: "Progress",
      page: "Page",
      listingsFound: "listings found",
      listings: "listings",
      scraping: "Scraping...",
      startScrape: "Start Scrape",
      scraperStarted: "Scraper started! Check progress below.",
      scrapeCompleted: "Scraping completed! Stats updated.",
      failedToStart: "Failed to start scraper",
      dbStats: "Database Statistics",
      when: "When",
      status: "Status",
      pages: "Pages",
      found: "Found",
      new: "New",
      updated: "Updated",
      unavailable: "Unavailable",
      statusCompleted: "Completed",
      statusRunning: "Running",
      statusFailed: "Failed",
    },

    // Detail page
    detail: {
      backToDeals: "Back to Deals",
      specifications: "Specifications",
      make: "Make",
      model: "Model",
      version: "Version",
      year: "Year",
      mileage: "Mileage",
      fuelType: "Fuel Type",
      gearbox: "Gearbox",
      engineCapacity: "Engine Capacity",
      enginePower: "Engine Power",
      location: "Location",
      seller: "Seller",
      dealScore: "Deal Score",
      scoreBreakdown: "Score Breakdown",
      priceVsSegment: "Price vs Segment",
      priceEvaluation: "Price Evaluation",
      mileageQuality: "Mileage Quality",
      pricePerKm: "Price per Km",
      viewOnStandVirtual: "View on StandVirtual",
      saveDeal: "Save Deal",
      market: "Market",
    },

    // Time
    time: {
      justNow: "just now",
      minutesAgo: "m ago",
      hoursAgo: "h ago",
      daysAgo: "d ago",
    },

    // Language
    language: "Language",
    portuguese: "Português",
    english: "English",
  },
} as const;

export type Language = keyof typeof translations;
export type Translations = typeof translations.pt;
