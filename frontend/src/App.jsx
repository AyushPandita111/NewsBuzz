import React, { useState } from "react";
import { Routes, Route, useLocation, useSearchParams } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Box, CssBaseline, AppBar, Grid } from "@mui/material";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyFeed from "./pages/MyFeed";
import UserProfile from "./pages/UserProfile";
import Bookmark from "./pages/Bookmark";
import History from "./pages/History";
import SearchResults from "./pages/SearchResults";
import CreateChannel from "./pages/CreateChannel";
import NewsProviderPage from "./pages/NewsProviderPage";
import PageNotFound from "./pages/PageNotFound";
import { ThemeContextProvider, ThemeContext } from "./context/ThemeContext";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import IconButton from "@mui/material/IconButton";

const theme = createTheme({
  typography: {
    fontFamily: "Quicksand, Arial, sans-serif",
  },
});

function App() {
  const location = useLocation();
  const validRoutes = [
    "/",
  ];
  const hideNavbar_SidebarRoutes = ["/login", "/signup"];

  const shouldShowNavbar_Sidebar =
    validRoutes.includes(location.pathname.split("?")[0]) &&
    !hideNavbar_SidebarRoutes.includes(location.pathname.split("?")[0]);


  return (
    <ThemeProvider theme={theme}>
      <ThemeContextProvider>
        <Box sx={{ display: "flex" }}>
          <CssBaseline />

          <Box sx={{ zIndex: (theme) => theme.zIndex.appBar + 2 }}>
            {shouldShowNavbar_Sidebar && (
              <Grid item md={2} xs={1} sm={1}>
                <div/> {/* sidebar */}
              </Grid>
            )}
          </Box>

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              ml: "60px",
              padding: "24px",
              position: "relative",
            }}
          >
            <AppBar
              position="fixed"
              sx={{
                top: 0,
              }}
            >
              <Box sx={{ marginLeft: "60px" }}>
                {shouldShowNavbar_Sidebar && <div/>} {/* navbar */}
                {/* Show Navbar conditionally */}
              </Box>
            </AppBar>

            {shouldShowNavbar_Sidebar && (
              <ThemeContext.Consumer>
                {({ toggleTheme, mode }) => (
                  <IconButton
                    onClick={toggleTheme}
                    sx={{
                      position: "fixed",
                      top: 10,
                      right: 10,
                      backgroundColor: mode === "dark" ? "white" : "black",
                      color: mode === "dark" ? "black" : "white",
                      zIndex: 999999999,
                    }}
                  >
                    {mode === "dark" ? (
                      <Brightness7Icon />
                    ) : (
                      <Brightness4Icon />
                    )}
                  </IconButton>
                )}
              </ThemeContext.Consumer>
            )}

            <Routes>
              <Route
                path="/"
                element={
                  window.localStorage.getItem("token") ? (
                    <MyFeed />
                  ) : (
                    <Home />
                  )
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/myfeed" element={<MyFeed />} />
              <Route path="/userprofile" element={<UserProfile />} />
              <Route path="/bookmark" element={<Bookmark />} />
              <Route path="/history" element={<History />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/createchannel" element={<CreateChannel />} />
              <Route path="/provider/:id" element={<NewsProviderPage />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Box>
        </Box>
      </ThemeContextProvider>
    </ThemeProvider>
  );
}

export default App;
