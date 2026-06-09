// ---------------------------------------------------------------------------
// cnews.js — public homepage news controller
// Serves the aggregated multi-source feed straight from the in-memory cache
// (populated by algorithms/newsAggregator.js). No live fetching here.
//
//   GET /api/news            → all categories with their articles
//   GET /api/news/:category  → articles for one category
//   GET /api/categories      → list of category names
// ---------------------------------------------------------------------------

import { getAll, getCategory, getCategoryNames } from "../algorithms/newsAggregator.js";

const getAllNews = (req, res) => {
  const { categories, lastUpdated } = getAll();
  return res.status(200).json({ success: true, lastUpdated, categories });
};

const getNewsByCategory = (req, res) => {
  const data = getCategory(req.params.category);
  if (!data) {
    return res.status(404).json({
      success: false,
      message: `Unknown category: ${req.params.category}`,
      categories: getCategoryNames(),
    });
  }
  return res.status(200).json({
    success: true,
    category: data.category,
    lastUpdated: data.lastUpdated,
    articles: data.articles,
  });
};

const getCategories = (req, res) => {
  return res.status(200).json({ success: true, categories: getCategoryNames() });
};

export { getAllNews, getNewsByCategory, getCategories };
