import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import FeedNewsCard from '../components/FeedNewsCard.jsx';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TextField from '@mui/material/TextField';
import { Box, Grid } from '@mui/material';
import { ThemeContext } from '../context/ThemeContext';
import { GET } from "../api.js";
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Feed endpoints — each represents one topic/text query
const FEED_ENDPOINTS = [
  "/api/myfeed/getmyfeed/text/0",
  "/api/myfeed/getmyfeed/text/1",
  "/api/myfeed/getmyfeed/text/2",
  "/api/myfeed/getmyfeed/text/3",
  "/api/myfeed/getmyfeed/topic/0",
  "/api/myfeed/getmyfeed/topic/1",
];

const PAGE_SIZE = 10;

const parentstyle = {
  marginTop: "100px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px",
  margin: "5px",
};

const MyFeed = () => {
  const { mode } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isDone, setIsDone] = useState(false); // no more content at all

  // Track which endpoint and which page within that endpoint we're on
  const endpointIndexRef = useRef(0);
  const pageRef = useRef(0);
  const isLoadingRef = useRef(false); // sync guard to avoid duplicate fetches

  // Sentinel div ref for IntersectionObserver
  const sentinelRef = useRef(null);

  const loadMoreArticles = useCallback(async () => {
    // Guard: don't fetch if already fetching or fully done
    if (isLoadingRef.current || endpointIndexRef.current >= FEED_ENDPOINTS.length) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      // Auth check
      const checkauth = await GET("/api/checkauth");
      if (checkauth.data?.caught) {
        toast.error(checkauth.data.message);
        navigate("/login");
        return;
      }

      const endpoint = FEED_ENDPOINTS[endpointIndexRef.current];
      const url = `${endpoint}?page=${pageRef.current}`;
      console.log("[MyFeed] Fetching:", url);

      const response = await GET(url);

      if (response.data?.caught) {
        navigate("/login");
        return;
      }

      const newArticles = response.data?.partialArticles || [];
      const hasMore = response.data?.hasMore ?? false;

      if (newArticles.length > 0) {
        setArticles(prev => [...prev, ...newArticles]);
      }

      if (hasMore) {
        // More pages available in this endpoint — advance the page
        pageRef.current += 1;
      } else {
        // This endpoint is exhausted — move to the next one, reset page
        endpointIndexRef.current += 1;
        pageRef.current = 0;

        if (endpointIndexRef.current >= FEED_ENDPOINTS.length) {
          setIsDone(true);
        }
      }
    } catch (error) {
      setIsError(true);
      console.error("[MyFeed] Fetch error:", error);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [navigate]);

  // IntersectionObserver on the sentinel div
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoadingRef.current && !isDone) {
          loadMoreArticles();
        }
      },
      { rootMargin: "200px" } // Start loading 200px before the sentinel is visible
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreArticles, isDone]);

  // Initial load on mount
  useEffect(() => {
    loadMoreArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredArticles = searchQuery
    ? articles.filter(a => a.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : articles;

  return (
    <>
      <div style={{ marginTop: "130px" }}>
        {/* Search bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "10px",
            borderRadius: "25px",
            transition: "width 0.25s ease-in-out",
          }}
        >
          <TextField
            hiddenLabel
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search from given articles..."
            sx={{
              m: 1,
              width: "400px",
              height: "100%",
              borderRadius: "25px",
              bgcolor: mode === "dark" ? "#444" : "rgb(251, 248, 248)",
              transition: "width 0.25s ease-in-out",
              "& .MuiOutlinedInput-root": {
                borderRadius: "25px",
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "transparent" },
                "&.Mui-focused fieldset": { borderColor: "transparent" },
              },
              "&:hover": {
                bgcolor: mode === "dark" ? "#555" : "rgb(240, 240, 240)",
              },
              "&:focus-within": {
                width: "600px",
                bgcolor: mode === "dark" ? "#555" : "rgb(240, 240, 240)",
                "& .MuiInputAdornment-root .MuiSvgIcon-root": {
                  color: "blue",
                  transform: "scale(1.4) rotateY(360deg)",
                  transition: "transform 1.1s ease-in-out, color 0.3s ease-in-out",
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
              sx: {
                "&::placeholder": {
                  color: mode === "dark" ? "#bbb" : "#888",
                },
              },
            }}
          />
        </Box>

        {/* Article cards */}
        <div style={{ marginTop: "50px" }}>
          <Grid container>
            <Grid
              item
              md={12}
              xs={9}
              sm={10}
              sx={{ position: "relative" }}
              style={parentstyle}
            >
              <Grid
                container
                spacing={300}
                style={{
                  padding: "5px",
                  margin: "5px",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {filteredArticles.map((article, index) => (
                  <FeedNewsCard
                    key={`${article.link}-${index}`}
                    title={article.title}
                    someText={article.someText}
                    imgURL={article.imgURL}
                    link={article.link}
                    time={article.time}
                    providerImg={article.providerImg}
                    providerName={article.providerName}
                  />
                ))}
              </Grid>
            </Grid>
          </Grid>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              flexDirection: "column",
              gap: 2,
              mt: 2,
            }}
          >
            {[1, 2, 3].map((_, index) => (
              <Skeleton
                key={index}
                animation="wave"
                variant="rounded"
                width="80%"
                height={160}
                sx={{ maxWidth: 800 }}
              />
            ))}
          </Box>
        )}

        {/* Error message */}
        {isError && (
          <div
            className="alert alert-warning"
            role="alert"
            style={{ width: "50%", margin: "0 auto" }}
          >
            Error fetching articles.
          </div>
        )}

        {/* End of feed message */}
        {isDone && !isLoading && (
          <Box sx={{ textAlign: "center", mt: 4, mb: 4, color: "text.secondary" }}>
            You've reached the end of your feed.
          </Box>
        )}

        {/* Sentinel div — IntersectionObserver watches this */}
        <div ref={sentinelRef} style={{ height: "60px", marginTop: "20px" }} />
      </div>
    </>
  );
};

export default MyFeed;