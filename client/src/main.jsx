import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Analytics from "./pages/Analytics";
import Budget from "./pages/Budget";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";
import "./index.css";

const NotFound = () => <div className="grid h-screen place-items-center text-center"><div><h1 className="text-5xl font-extrabold">404</h1><p className="my-3 text-slate-400">That page doesn't exist.</p><Link className="btn" to="/">Go home</Link></div></div>;

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter><AuthProvider>
    <Toaster toastOptions={{ style: { background: "#111b2e", color: "#fff", border: "1px solid rgba(255,255,255,.1)" } }} />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
                <Route path="/analytics" element={<Analytics />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthProvider></BrowserRouter>
);
